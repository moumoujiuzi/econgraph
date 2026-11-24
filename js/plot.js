/* ==========================================================================
   plot.js — 轻量级函数绘图引擎（Canvas 2D，无依赖）
   支持：多条 y=f(x)、虚线、参数、区域填色、关键点标注、图例、
         滚轮缩放、拖拽平移、悬停十字准星读数、导出 PNG
   ========================================================================== */
(function (global) {
  'use strict';

  var PALETTE = ['#1f4e79', '#c0392b', '#2e7d32', '#8e44ad', '#d68910', '#117a65', '#6c3483', '#b03a2e'];

  function niceStep(span, target) {
    if (!(span > 0)) return 1;
    var raw = span / Math.max(2, target);
    var p = Math.pow(10, Math.floor(Math.log10(raw)));
    var n = raw / p;
    var m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return m * p;
  }

  function tickLabel(v, step) {
    if (Math.abs(v) >= 1e5) {
      var e = Math.exp(Math.log(Math.abs(v)));
      return v.toExponential(1).replace('e+', 'e');
    }
    var dec = step >= 1 ? 0 : Math.max(0, Math.min(4, Math.ceil(-Math.log10(step)) + 1));
    var s = Math.abs(v) < 1e-9 ? '0' : v.toFixed(dec);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }

  function Plot(canvas, overlay, tooltip) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.overlay = overlay;
    this.octx = overlay.getContext('2d');
    this.tooltip = tooltip;
    this.state = null;
    this.dpr = Math.min(3, global.devicePixelRatio || 1);
    this.pad = { l: 88, r: 30, t: 34, b: 58 };
    this.hover = null;
    this._bind();
  }

  Plot.prototype._bind = function () {
    var self = this;
    var wrap = this.canvas.parentElement;
    var dragging = false, last = null;

    wrap.addEventListener('wheel', function (e) {
      if (!self.state) return;
      e.preventDefault();
      var r = self.canvas.getBoundingClientRect();
      var mx = e.clientX - r.left, my = e.clientY - r.top;
      var v = self.state.view;
      var x = self.xAt(mx), y = self.yAt(my);
      var k = Math.max(0.5, Math.min(2, Math.exp(-e.deltaY * 0.0016)));
      self.state.view = {
        xmin: x + (v.xmin - x) / k, xmax: x + (v.xmax - x) / k,
        ymin: y + (v.ymin - y) / k, ymax: y + (v.ymax - y) / k
      };
      self.render();
      if (self.onViewChange) self.onViewChange(self.state.view);
    }, { passive: false });

    wrap.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      dragging = true; last = { x: e.clientX, y: e.clientY };
      self._moved = false;
      wrap.style.cursor = 'grabbing';
    });
    wrap.addEventListener('click', function (e) {
      if (!self.onClick || self._moved || !self.state) return;
      var rr = self.canvas.getBoundingClientRect();
      var mx = e.clientX - rr.left, my = e.clientY - rr.top;
      if (mx < self.pad.l || mx > rr.width - self.pad.r || my < self.pad.t || my > rr.height - self.pad.b) return;
      self.onClick(self.xAt(mx), self.yAt(my));
    });
    global.addEventListener('mousemove', function (e) {
      if (!dragging || !self.state) return;
      var dx = e.clientX - last.x, dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      if (Math.abs(dx) + Math.abs(dy) > 3) self._moved = true;
      var v = self.state.view, W = self.plotW(), H = self.plotH();
      var wx = dx / W * (v.xmax - v.xmin);
      var wy = dy / H * (v.ymax - v.ymin);
      self.state.view = {
        xmin: v.xmin - wx, xmax: v.xmax - wx,
        ymin: v.ymin + wy, ymax: v.ymax + wy
      };
      self.render();
      if (self.onViewChange) self.onViewChange(self.state.view);
    });
    global.addEventListener('mouseup', function () {
      dragging = false;
      wrap.style.cursor = 'crosshair';
    });

    wrap.addEventListener('mousemove', function (e) {
      if (!self.state || dragging) return;
      var r = self.canvas.getBoundingClientRect();
      var mx = e.clientX - r.left, my = e.clientY - r.top;
      if (mx < self.pad.l || mx > r.width - self.pad.r || my < self.pad.t || my > r.height - self.pad.b) {
        self.hover = null; self.drawOverlay(); self.tooltip.style.display = 'none';
        return;
      }
      self.hover = { mx: mx, my: my, x: self.xAt(mx), y: self.yAt(my) };
      self.drawOverlay();
      self.showTooltip(e);
    });
    wrap.addEventListener('mouseleave', function () {
      self.hover = null;
      self.drawOverlay();
      self.tooltip.style.display = 'none';
    });
  };

  Plot.prototype.plotW = function () {
    var r = this.canvas.getBoundingClientRect();
    return r.width - this.pad.l - this.pad.r;
  };
  Plot.prototype.plotH = function () {
    var r = this.canvas.getBoundingClientRect();
    return r.height - this.pad.t - this.pad.b;
  };
  Plot.prototype.xAt = function (px) {
    var v = this.state.view;
    return v.xmin + (px - this.pad.l) / this.plotW() * (v.xmax - v.xmin);
  };
  Plot.prototype.yAt = function (py) {
    var v = this.state.view;
    return v.ymax - (py - this.pad.t) / this.plotH() * (v.ymax - v.ymin);
  };
  Plot.prototype.sx = function (x) {
    var v = this.state.view;
    return this.pad.l + (x - v.xmin) / (v.xmax - v.xmin) * this.plotW();
  };
  Plot.prototype.sy = function (y) {
    var v = this.state.view;
    return this.pad.t + (v.ymax - y) / (v.ymax - v.ymin) * this.plotH();
  };

  /** 绘图区（去掉刻度留白后）的像素尺寸 */
  Plot.prototype.plotRect = function () {
    var r = this.canvas.getBoundingClientRect();
    return {
      w: Math.max(1, r.width - this.pad.l - this.pad.r),
      h: Math.max(1, r.height - this.pad.t - this.pad.b)
    };
  };

  Plot.prototype.resize = function () {
    var host = this.canvas.parentElement;
    var r = (host && host.getBoundingClientRect().width > 0)
      ? host.getBoundingClientRect()
      : this.canvas.getBoundingClientRect();
    var w = Math.max(320, Math.round(r.width)), h = Math.max(240, Math.round(r.height));
    var dpr = Math.min(3, global.devicePixelRatio || 1);
    [this.canvas, this.overlay].forEach(function (c) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = w + 'px';
      c.style.height = h + 'px';
    });
    this.dpr = dpr;
    this.render();
    this.drawOverlay();
  };

  Plot.prototype.setState = function (state) {
    this.state = state;
    this.render();
    this.drawOverlay();
  };

  /* ------------------------------ 主绘制 ------------------------------ */
  Plot.prototype.render = function () {
    if (!this.state) return;
    var ctx = this.ctx, st = this.state, v = st.view;
    var r = this.canvas.getBoundingClientRect();
    var W = r.width, H = r.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    if (!(v.xmax > v.xmin) || !(v.ymax > v.ymin)) return;

    var L = this.pad.l, R = W - this.pad.r, T = this.pad.t, B = H - this.pad.b;

    // 等比例坐标：x、y 每单位占同样像素（必要时扩大较窄的那个方向）
    if (st.equalAspect) {
      var pw = R - L, ph = B - T;
      var xs0 = v.xmax - v.xmin, ys0 = v.ymax - v.ymin;
      if (pw > 0 && ph > 0 && xs0 > 0 && ys0 > 0) {
        var kA = Math.min(pw / xs0, ph / ys0);
        if (kA > 0 && isFinite(kA)) {
          var nx = pw / kA, ny = ph / kA;
          var cx0 = (v.xmin + v.xmax) / 2, cy0 = (v.ymin + v.ymax) / 2;
          if (Math.abs(nx - xs0) > xs0 * 1e-9 || Math.abs(ny - ys0) > ys0 * 1e-9) {
            v.xmin = cx0 - nx / 2; v.xmax = cx0 + nx / 2;
            v.ymin = cy0 - ny / 2; v.ymax = cy0 + ny / 2;
            if (st.baseView) {
              st.baseView.xmin = v.xmin; st.baseView.xmax = v.xmax;
              st.baseView.ymin = v.ymin; st.baseView.ymax = v.ymax;
            }
          }
        }
      }
    }
    var x0 = v.xmin, x1 = v.xmax, y0 = v.ymin, y1 = v.ymax;

    var xstep = niceStep(x1 - x0, Math.max(4, Math.round((R - L) / 90)));
    var ystep = niceStep(y1 - y0, Math.max(3, Math.round((B - T) / 70)));

    var gx = Math.ceil(x0 / xstep) * xstep;
    var gy = Math.ceil(y0 / ystep) * ystep;
    var x, y, px, py;

    ctx.save();
    ctx.beginPath(); ctx.rect(L, T, R - L, B - T); ctx.clip();

    // ---- 网格 ----
    ctx.strokeStyle = '#eef1f4'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (x = gx; x <= x1 + 1e-9; x += xstep) {
      px = Math.round(this.sx(x)) + 0.5;
      ctx.moveTo(px, T); ctx.lineTo(px, B);
    }
    for (y = gy; y <= y1 + 1e-9; y += ystep) {
      py = Math.round(this.sy(y)) + 0.5;
      ctx.moveTo(L, py); ctx.lineTo(R, py);
    }
    ctx.stroke();

    // ---- 对照快照（比较静态） ----
    if (st.ghost && st.ghost.curves && st.ghost.curves.length) {
      this._drawGhost(ctx, st.ghost, L, R, T, B);
    }

    // ---- 方向场 ----
    if (st.field) this._drawField(ctx, st.field, L, R, T, B);

    // ---- 区域填色 ----
    (st.shades || []).forEach(function (sh) { this._drawShade(ctx, sh, L, R, T, B); }, this);

    // ---- 曲线 ----
    this._compiled = (st.curves || []).map(function (c) {
      var src = (c.expr || '') + '\u0001' + (c.expr2 || '');
      if (c._src !== src) {
        try { c._fn = MathFn.compile(c.expr); c._err = null; }
        catch (err) { c._fn = null; c._err = err.message; }
        if (c.type === 'parametric') {
          try { c._fn2 = MathFn.compile(c.expr2); c._err2 = null; }
          catch (e2) { c._fn2 = null; c._err2 = e2.message; }
        } else { c._fn2 = null; }
        c._src = src;
      }
      return c;
    });

    this._compiled.forEach(function (c) {
      if (c.visible === false) return;
      this._drawCurve(ctx, c, L, R, T, B);
    }, this);

    // ---- 工具叠加层（级数工坊 / 逐阶导数） ----
    this._overlay = (st.overlay || []).map(function (c) {
      var src = (c.expr || '');
      if (c._src !== src) {
        try { c._fn = MathFn.compile(c.expr); c._err = null; }
        catch (err) { c._fn = null; c._err = err.message; }
        c._src = src;
      }
      return c;
    });
    this._overlay.forEach(function (c) {
      if (c.visible === false) return;
      this._drawCurve(ctx, c, L, R, T, B);
    }, this);

    // ---- 路径（蛛网、辅助线） ----
    (st.paths || []).forEach(function (p) { this._drawPath(ctx, p, L, R, T, B); }, this);

    // ---- 散点 ----
    if (st.points && st.points.length) this._drawPoints(ctx, st.points, L, R, T, B);

    ctx.restore();

    // ---- 坐标轴 ----
    this._drawAxes(ctx, L, R, T, B, xstep, ystep);

    // ---- 轴标题 ----
    ctx.save();
    ctx.fillStyle = '#2b2b2b';
    ctx.font = '600 13px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(st.xLabel || 'x', (L + R) / 2, H - 12);
    var xSp = v.xmax - v.xmin;
    var xInsideTitle = v.xmin + xSp * 0.08 <= 0 && 0 <= v.xmax - xSp * 0.08;
    var ayPos = (!st.axisAtEdge && xInsideTitle) ? this.sx(0) : L;
    ctx.translate(Math.max(20, ayPos - 16), (T + B) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(st.yLabel || 'y', 0, 0);
    ctx.restore();

    // ---- 标注 ----
    (st.annotations || []).forEach(function (an) { this._drawAnnotation(ctx, an); }, this);

    // ---- 图例 ----
    this._drawLegend(ctx, R, T);

    // ---- 图表标题 ----
    if (st.title && st.showTitle) {
      ctx.save();
      ctx.fillStyle = '#1a1a1a';
      ctx.font = '600 15px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(st.title, L, 8);
      ctx.restore();
    }
  };

  Plot.prototype._drawShade = function (ctx, sh, L, R, T, B) {
    var self = this;
    ctx.save();
    ctx.beginPath(); ctx.rect(L, T, R - L, B - T); ctx.clip();

    if (sh.type === 'vstrip') {
      var xa = this.sx(sh.x1), xb = this.sx(sh.x2);
      var ya = this.sy(sh.y1), yb = this.sy(sh.y2);
      ctx.fillStyle = sh.color;
      ctx.fillRect(Math.min(xa, xb), Math.min(ya, yb), Math.abs(xb - xa), Math.abs(yb - ya));
    } else if (sh.type === 'between') {
      var fn = null;
      try { fn = MathFn.compile(sh.curve).eval; } catch (e) { fn = null; }
      if (fn) {
        var env0 = Object.assign({}, this.state.params || {});
        var from = Math.max(sh.from, this.state.view.xmin);
        var to = Math.min(sh.to, this.state.view.xmax);
        if (to > from) {
          var pa = self.sx(from), pb = self.sx(to);
          var top = [], bot = [];
          for (var px = pa; px <= pb; px += 1) {
            var xv = self.xAt(px);
            var env = Object.assign({}, env0);
            env[this.state.xVar || 'x'] = xv; env.x = xv;
            var yv = fn(env);
            if (!isFinite(yv)) continue;
            top.push([px, self.sy(Math.max(yv, sh.line))]);
            bot.push([px, self.sy(Math.min(yv, sh.line))]);
          }
          if (top.length > 1) {
            ctx.beginPath();
            ctx.moveTo(top[0][0], top[0][1]);
            for (var i = 1; i < top.length; i++) ctx.lineTo(top[i][0], top[i][1]);
            for (var j = bot.length - 1; j >= 0; j--) ctx.lineTo(bot[j][0], bot[j][1]);
            ctx.closePath();
            ctx.fillStyle = sh.color;
            ctx.fill();
          }
        }
      }
    } else if (sh.type === 'rects') {
      // 黎曼和矩形
      var rfn = null;
      try { rfn = MathFn.compile(sh.curve).eval; } catch (e) { rfn = null; }
      if (rfn) {
        var n = Math.max(1, Math.min(400, sh.n || 10));
        var a0 = Math.max(sh.from, this.state.view.xmin);
        var b0 = Math.min(sh.to, this.state.view.xmax);
        var w = (sh.to - sh.from) / n;
        var envR = Object.assign({}, this.state.params || {});
        ctx.fillStyle = sh.color || 'rgba(31,78,121,0.16)';
        ctx.strokeStyle = sh.stroke || 'rgba(31,78,121,0.45)';
        ctx.lineWidth = 1;
        for (var k = 0; k < n; k++) {
          var xa0 = sh.from + k * w;
          var xb0 = xa0 + w;
          if (xb0 < a0 || xa0 > b0) continue;
          var sample = sh.mode === 'left' ? xa0 : (sh.mode === 'right' ? xb0 : (xa0 + xb0) / 2);
          var eR = Object.assign({}, envR);
          eR[this.state.xVar || 'x'] = sample; eR.x = sample;
          var hR;
          try { hR = rfn(eR); } catch (e) { hR = NaN; }
          if (!isFinite(hR)) continue;
          var rx = self.sx(xa0), ry = self.sy(hR), rw = self.sx(xb0) - rx, rh = self.sy(0) - ry;
          ctx.fillRect(rx, Math.min(ry, self.sy(0)), Math.max(1, rw - 0.6), Math.abs(rh));
          ctx.strokeRect(rx + 0.5, Math.min(ry, self.sy(0)) + 0.5, Math.max(1, rw - 1), Math.abs(rh));
        }
      }
    }
    ctx.restore();

    if (sh.label) {
      var cx = this.sx(sh.lx), cy = this.sy(sh.ly);
      ctx.save();
      ctx.font = '12px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = sh.labelColor || '#6b6b6b';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sh.label, cx, cy);
      ctx.restore();
    }
  };

  /* 按曲线类型分发 */
  Plot.prototype._drawCurve = function (ctx, c, L, R, T, B) {
    var type = c.type || 'explicit';
    if (type === 'implicit') return this._drawImplicit(ctx, c, L, R, T, B);
    if (type === 'parametric') return this._drawParametric(ctx, c, L, R, T, B);
    if (type === 'polar') return this._drawPolar(ctx, c, L, R, T, B);
    if (type === 'series') return this._drawSeries(ctx, c, L, R, T, B);
    if (type === 'nested') return this._drawNested(ctx, c, L, R, T, B);
    return this._drawExplicit(ctx, c, L, R, T, B);
  };

  Plot.prototype._drawExplicit = function (ctx, c, L, R, T, B) {
    if (!c._fn) return;
    var st = this.state;
    var envBase = Object.assign({}, st.params || {});
    var width = R - L;
    if (width <= 0) return;

    // 每个像素列取多少个样本：放大越多越密（以模板视图为基准）
    var base = st.baseView || { xmin: -8, xmax: 8 };
    var baseSpan = Math.abs((base.xmax - base.xmin) || 16);
    var curSpan = Math.abs((st.view.xmax - st.view.xmin) || 16);
    var zoomRatio = Math.max(1, baseSpan / curSpan);
    var S = Math.min(96, Math.round(16 * Math.sqrt(zoomRatio)));

    var cols = Math.max(2, Math.round(width));
    var yMin = new Float64Array(cols);
    var yMax = new Float64Array(cols);
    var yMid = new Float64Array(cols);
    var ok = new Uint8Array(cols);

    for (var ci = 0; ci < cols; ci++) {
      var px = L + ci;
      var xa = this.xAt(px - 0.5), xb = this.xAt(px + 0.5);
      var lo = Infinity, hi = -Infinity, mid = NaN, allFit = true;

      for (var k = 0; k < S; k++) {
        var xv = xa + (xb - xa) * (k + 0.5) / S;
        var env = Object.assign({}, envBase);
        env[st.xVar || 'x'] = xv; env.x = xv;

        var yv;
        try { yv = c._fn.eval(env); } catch (e) { yv = NaN; }
        if (!isFinite(yv)) { allFit = false; break; }

        var py = this.sy(yv);
        if (!isFinite(py) || Math.abs(py) > 1e6) { allFit = false; break; }
        if (py < lo) lo = py;
        if (py > hi) hi = py;
        if (k === (S >> 1)) mid = py;
      }

      if (allFit && isFinite(lo) && isFinite(hi)) {
        // 限制到画布附近，避免竖直渐近线把坐标撑爆
        yMin[ci] = Math.max(T - 4000, lo);
        yMax[ci] = Math.min(B + 4000, hi);
        yMid[ci] = mid;
        ok[ci] = 1;
      } else {
        ok[ci] = 0;
      }
    }

    ctx.save();
    ctx.beginPath(); ctx.rect(L, T, R - L, B - T); ctx.clip();
    ctx.strokeStyle = c.color || '#1f4e79';
    ctx.fillStyle = c.color || '#1f4e79';
    ctx.lineWidth = c.width || 2.2;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.setLineDash(c.dash || []);

    // ① 中值连线：曲线本身
    ctx.beginPath();
    var started = false;
    for (var i2 = 0; i2 < cols; i2++) {
      if (!ok[i2]) { started = false; continue; }
      var x2 = L + i2, y2 = yMid[i2];
      if (!started) { ctx.moveTo(x2, y2); started = true; }
      else ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    // ② 振荡包络：一列内起伏超过 1.5px 时，用虚线连出这一段的上下界
    var bandCount = 0;
    var hasLo = false, hasHi = false;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, (c.width || 2.2) * 0.55);
    ctx.setLineDash([4, 4]);

    // 上界
    ctx.beginPath();
    for (var i3 = 0; i3 < cols; i3++) {
      if (!ok[i3] || (yMax[i3] - yMin[i3]) <= 1.5) { hasHi = false; continue; }
      var xh = L + i3;
      if (!hasHi) { ctx.moveTo(xh, yMax[i3]); hasHi = true; }
      else ctx.lineTo(xh, yMax[i3]);
      bandCount++;
    }
    ctx.stroke();

    // 下界
    ctx.beginPath();
    hasLo = false;
    for (var i4 = 0; i4 < cols; i4++) {
      if (!ok[i4] || (yMax[i4] - yMin[i4]) <= 1.5) { hasLo = false; continue; }
      var xl = L + i4;
      if (!hasLo) { ctx.moveTo(xl, yMin[i4]); hasLo = true; }
      else ctx.lineTo(xl, yMin[i4]);
    }
    ctx.stroke();
    ctx.restore();

    ctx.setLineDash([]);
    ctx.restore();
    this._bandCols = bandCount;
  };

  /* ---------------------- 隐函数：marching squares ---------------------- */
  Plot.prototype._drawImplicit = function (ctx, c, L, R, T, B) {
    if (!c._fn) return;
    var st = this.state;
    var envBase = Object.assign({}, st.params || {});
    var cols = Math.max(60, Math.min(200, Math.round((R - L) / 5)));
    var rows = Math.max(60, Math.min(200, Math.round((B - T) / 5)));
    var dx = (R - L) / cols, dy = (B - T) / rows;
    var vals = new Float64Array((cols + 1) * (rows + 1));
    var i, j, xv, yv, env, v;

    for (j = 0; j <= rows; j++) {
      yv = this.yAt(T + j * dy);
      for (i = 0; i <= cols; i++) {
        xv = this.xAt(L + i * dx);
        env = Object.assign({}, envBase);
        env.x = xv; env.y = yv;
        env[st.xVar || 'x'] = xv; env[st.yVar || 'y'] = yv;
        try { v = c._fn.eval(env); } catch (e) { v = NaN; }
        vals[j * (cols + 1) + i] = isFinite(v) ? v : NaN;
      }
    }

    ctx.save();
    ctx.beginPath(); ctx.rect(L, T, R - L, B - T); ctx.clip();
    ctx.strokeStyle = c.color || '#1f4e79';
    ctx.lineWidth = c.width || 2.2;
    ctx.setLineDash(c.dash || []);
    ctx.beginPath();

    function V(ii, jj) { return vals[jj * (cols + 1) + ii]; }
    function ip(p, q) { var d = p - q; return Math.abs(d) < 1e-12 ? 0.5 : p / d; }

    for (j = 0; j < rows; j++) {
      for (i = 0; i < cols; i++) {
        var a = V(i, j), b = V(i + 1, j), cc = V(i + 1, j + 1), d = V(i, j + 1);
        if (!isFinite(a) || !isFinite(b) || !isFinite(cc) || !isFinite(d)) continue;
        var idx = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (cc > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
        if (idx === 0 || idx === 15) continue;
        var x0 = L + i * dx, y0 = T + j * dy;
        var top = [x0 + dx * ip(a, b), y0];
        var right = [x0 + dx, y0 + dy * ip(b, cc)];
        var bottom = [x0 + dx * ip(d, cc), y0 + dy];
        var left = [x0, y0 + dy * ip(a, d)];

        function seg(p1, p2) { ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); }

        switch (idx) {
          case 1: case 14: seg(left, top); break;
          case 2: case 13: seg(top, right); break;
          case 3: case 12: seg(left, right); break;
          case 4: case 11: seg(right, bottom); break;
          case 6: case 9: seg(top, bottom); break;
          case 7: case 8: seg(left, bottom); break;
          case 5: seg(left, top); seg(right, bottom); break;
          case 10: seg(top, right); seg(left, bottom); break;
        }
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };

  /* ---------------------- 参数方程 ---------------------- */
  Plot.prototype._drawParametric = function (ctx, c, L, R, T, B) {
    if (!c._fn || !c._fn2) return;
    var st = this.state;
    var envBase = Object.assign({}, st.params || {});
    var t0 = (c.tmin == null) ? 0 : c.tmin;
    var t1 = (c.tmax == null) ? Math.PI * 2 : c.tmax;
    var N = 1200;

    ctx.save();
    ctx.beginPath(); ctx.rect(L, T, R - L, B - T); ctx.clip();
    ctx.strokeStyle = c.color || '#1f4e79';
    ctx.lineWidth = c.width || 2.2;
    ctx.setLineDash(c.dash || []);
    ctx.beginPath();

    var started = false, prevX = null, prevY = null;
    for (var i = 0; i <= N; i++) {
      var t = t0 + (t1 - t0) * i / N;
      var env = Object.assign({}, envBase);
      env.t = t; env.theta = t;
      var xv, yv;
      try { xv = c._fn.eval(env); yv = c._fn2.eval(env); } catch (e) { xv = NaN; yv = NaN; }
      if (!isFinite(xv) || !isFinite(yv)) { started = false; prevX = null; continue; }
      var px = this.sx(xv), py = this.sy(yv);
      if (prevX !== null && (Math.abs(px - prevX) > (R - L) || Math.abs(py - prevY) > (B - T))) started = false;
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
      prevX = px; prevY = py;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };

  /* ---------------------- 极坐标 ---------------------- */
  Plot.prototype._drawPolar = function (ctx, c, L, R, T, B) {
    if (!c._fn) return;
    var st = this.state;
    var envBase = Object.assign({}, st.params || {});
    var t0 = (c.tmin == null) ? 0 : c.tmin;
    var t1 = (c.tmax == null) ? Math.PI * 2 : c.tmax;
    var N = 1600;

    ctx.save();
    ctx.beginPath(); ctx.rect(L, T, R - L, B - T); ctx.clip();
    ctx.strokeStyle = c.color || '#1f4e79';
    ctx.lineWidth = c.width || 2.2;
    ctx.setLineDash(c.dash || []);
    ctx.beginPath();

    var started = false, prevX = null, prevY = null;
    for (var i = 0; i <= N; i++) {
      var th = t0 + (t1 - t0) * i / N;
      var env = Object.assign({}, envBase);
      env.t = th; env.theta = th;
      var r;
      try { r = c._fn.eval(env); } catch (e) { r = NaN; }
      if (!isFinite(r)) { started = false; prevX = null; continue; }
      var px = this.sx(r * Math.cos(th)), py = this.sy(r * Math.sin(th));
      if (prevX !== null && (Math.abs(px - prevX) > (R - L) || Math.abs(py - prevY) > (B - T))) started = false;
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
      prevX = px; prevY = py;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };

  /* ---------------------- 方向场 ---------------------- */
  Plot.prototype._drawField = function (ctx, fld, L, R, T, B) {
    if (!fld._fx) {
      try {
        fld._fx = MathFn.compile(fld.fx).eval;
        fld._fy = MathFn.compile(fld.fy).eval;
      } catch (e) { fld._err = e.message; return; }
    }
    var st = this.state;
    var env0 = Object.assign({}, st.params || {});
    var cols = Math.max(8, Math.min(22, Math.round((R - L) / 64)));
    var rows = Math.max(6, Math.min(18, Math.round((B - T) / 64)));
    var dxp = (R - L) / cols, dyp = (B - T) / rows;
    var raw = [], maxMag = 0;

    for (var j = 0; j <= rows; j++) {
      for (var i = 0; i <= cols; i++) {
        var px = L + i * dxp, py = T + j * dyp;
        var xv = this.xAt(px), yv = this.yAt(py);
        var env = Object.assign({}, env0);
        env.x = xv; env.y = yv;
        env[st.xVar || 'x'] = xv; env[st.yVar || 'y'] = yv;
        var u, v;
        try { u = fld._fx(env); v = fld._fy(env); } catch (e) { continue; }
        if (!isFinite(u) || !isFinite(v)) continue;
        var mag = Math.sqrt(u * u + v * v);
        if (!isFinite(mag)) continue;
        if (mag > maxMag) maxMag = mag;
        raw.push({ px: px, py: py, u: u, v: v, mag: mag });
      }
    }
    if (!raw.length || maxMag <= 0) return;

    var maxLen = Math.min(dxp, dyp) * 0.72;
    ctx.save();
    ctx.beginPath(); ctx.rect(L, T, R - L, B - T); ctx.clip();
    ctx.lineWidth = 1.3;

    for (var k = 0; k < raw.length; k++) {
      var q = raw[k];
      var frac = Math.log(1 + q.mag) / Math.log(1 + maxMag);
      var len = Math.max(4, maxLen * (0.35 + 0.65 * frac));
      var ux = q.u / q.mag, uy = q.v / q.mag;
      var ex = q.px + ux * len, ey = q.py - uy * len;

      ctx.strokeStyle = 'rgba(90,120,170,' + (0.25 + 0.55 * frac).toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(q.px - ux * len * 0.45, q.py + uy * len * 0.45);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // 箭头
      var ah = Math.max(3, len * 0.34);
      var ang = Math.atan2(-uy, ux);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - ah * Math.cos(ang - 0.42), ey - ah * Math.sin(ang - 0.42));
      ctx.lineTo(ex - ah * Math.cos(ang + 0.42), ey - ah * Math.sin(ang + 0.42));
      ctx.closePath();
      ctx.fillStyle = 'rgba(90,120,170,' + (0.30 + 0.55 * frac).toFixed(3) + ')';
      ctx.fill();
    }
    ctx.restore();
  };

  /* ---------------------- 级数部分和 Σ_{n=n0}^{n1} term(n,x) ---------------------- */
  Plot.prototype._drawSeries = function (ctx, c, L, R, T, B) {
    if (!c._fn) return;
    var st = this.state;
    var envBase = Object.assign({}, st.params || {});
    var n0 = (c.n0 == null) ? 1 : c.n0;
    var n1 = (c.n1 == null) ? 1 : c.n1;
    if (n1 < n0) return;
    var pxStep = (n1 - n0) > 200 ? 2 : 1;

    ctx.save();
    ctx.beginPath(); ctx.rect(L, T, R - L, B - T); ctx.clip();
    ctx.strokeStyle = c.color || '#8e44ad';
    ctx.lineWidth = c.width || 2.2;
    ctx.setLineDash(c.dash || []);
    ctx.beginPath();

    var started = false, prevY = null, jump = (B - T) * 2.2;
    for (var px = L; px <= R; px += pxStep) {
      var xv = this.xAt(px);
      var sum = 0, bad = false;
      for (var n = n0; n <= n1; n += 1) {
        var env = Object.assign({}, envBase);
        env.x = xv; env.n = n; env.k = n;
        env[st.xVar || 'x'] = xv;
        var v;
        try { v = c._fn.eval(env); } catch (e) { bad = true; break; }
        if (!isFinite(v)) { bad = true; break; }
        sum += v;
      }
      if (bad || !isFinite(sum)) { started = false; prevY = null; continue; }
      var py = this.sy(sum);
      if (prevY !== null && Math.abs(py - prevY) > jump) started = false;
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
      prevY = py;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };

  /* ---------------------- 嵌套根式 sqrt(a + sqrt(a + ...)) ---------------------- */
  Plot.prototype._drawNested = function (ctx, c, L, R, T, B) {
    if (!c._tpl) {
      try {
        c._tpl = MathFn.compile(c.template);
        c._term = MathFn.compile(c.terminal || '0');
      } catch (e) { c._err = e.message; return; }
    }
    var st = this.state;
    var envBase = Object.assign({}, st.params || {});
    var n0 = (c.n0 == null) ? 1 : c.n0;
    var n1 = (c.n1 == null) ? 10 : c.n1;

    ctx.save();
    ctx.beginPath(); ctx.rect(L, T, R - L, B - T); ctx.clip();
    ctx.strokeStyle = c.color || '#c0392b';
    ctx.lineWidth = c.width || 2.6;
    ctx.setLineDash(c.dash || []);
    ctx.beginPath();

    var started = false, prevY = null, jump = (B - T) * 2.2;
    for (var px = L; px <= R; px += 1) {
      var xv = this.xAt(px);
      var env = Object.assign({}, envBase);
      env.x = xv; env[this.state.xVar || 'x'] = xv;

      var v;
      try { v = c._term.eval(env); } catch (e) { v = NaN; }
      if (isFinite(v)) {
        for (var k = n1; k >= n0; k--) {
          env.R = v; env.k = k;
          try { v = c._tpl.eval(env); } catch (e) { v = NaN; break; }
          if (!isFinite(v)) break;
        }
      }
      if (!isFinite(v)) { started = false; prevY = null; continue; }
      var py = this.sy(v);
      if (prevY !== null && Math.abs(py - prevY) > jump) started = false;
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
      prevY = py;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };

  /* ---------------------- 散点 ---------------------- */
  Plot.prototype._drawPoints = function (ctx, pts, L, R, T, B) {
    ctx.save();
    ctx.beginPath(); ctx.rect(L, T, R - L, B - T); ctx.clip();
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var px = this.sx(p.x), py = this.sy(p.y);
      ctx.beginPath();
      ctx.arc(px, py, p.r || 4, 0, Math.PI * 2);
      ctx.fillStyle = p.color || 'rgba(192,57,43,.85)';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = p.stroke || 'rgba(255,255,255,.9)';
      ctx.stroke();
    }
    ctx.restore();
  };

  /* ---------------------- 路径（蛛网、辅助线） ---------------------- */
  Plot.prototype._drawPath = function (ctx, p, L, R, T, B) {
    if (!p.pts || p.pts.length < 2) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(L, T, R - L, B - T); ctx.clip();
    ctx.strokeStyle = p.color || '#8e44ad';
    ctx.lineWidth = p.width || 1.8;
    ctx.setLineDash(p.dash || []);
    ctx.beginPath();
    var started = false, prevX = null, prevY = null;
    var maxJumpX = (R - L) * 0.35, maxJumpY = (B - T) * 0.35;
    for (var i = 0; i < p.pts.length; i++) {
      var q = p.pts[i];
      if (!q || !isFinite(q[0]) || !isFinite(q[1])) { started = false; prevX = null; continue; }
      var px = this.sx(q[0]), py = this.sy(q[1]);
      if (prevX !== null && (Math.abs(px - prevX) > maxJumpX || Math.abs(py - prevY) > maxJumpY)) {
        started = false;
      }
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
      prevX = px; prevY = py;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };

  /* ---------------------- 对照快照 ---------------------- */
  Plot.prototype._drawGhost = function (ctx, ghost, L, R, T, B) {
    var realParams = this.state.params;
    this.state.params = ghost.params || {};
    var self = this;
    (ghost.curves || []).forEach(function (c) {
      if (c.visible === false) return;
      var clone = {
        type: c.type || 'explicit',
        expr: c.expr, expr2: c.expr2,
        tmin: c.tmin, tmax: c.tmax,
        color: '#9aa5b1', width: 1.4, dash: [7, 5], visible: true
      };
      try {
        clone._fn = MathFn.compile(clone.expr);
        if (clone.type === 'parametric') clone._fn2 = MathFn.compile(clone.expr2);
      } catch (e) { return; }
      try { self._drawCurve(ctx, clone, L, R, T, B); } catch (e) { }
    });
    this.state.params = realParams;
  };

  Plot.prototype._drawAxes = function (ctx, L, R, T, B, xstep, ystep) {
    var v = this.state.view;
    var edge = !!this.state.axisAtEdge;
    // 0 落在视图内侧 8% 以上才把轴画在原点处，贴着边缘时改画在边上，
    // 免得缩放时轴线在边框附近来回跳（看起来像零点乱跑）
    var yspan = v.ymax - v.ymin, xspan = v.xmax - v.xmin;
    var yInside = v.ymin + yspan * 0.08 <= 0 && 0 <= v.ymax - yspan * 0.08;
    var xInside = v.xmin + xspan * 0.08 <= 0 && 0 <= v.xmax - xspan * 0.08;
    var ax = (!edge && yInside) ? this.sy(0) : B;
    var ay = (!edge && xInside) ? this.sx(0) : L;

    ctx.save();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(L, Math.round(ax) + 0.5); ctx.lineTo(R, Math.round(ax) + 0.5);
    ctx.moveTo(Math.round(ay) + 0.5, T); ctx.lineTo(Math.round(ay) + 0.5, B);
    ctx.stroke();

    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.moveTo(R + 9, ax); ctx.lineTo(R, ax - 4); ctx.lineTo(R, ax + 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ay, T - 9); ctx.lineTo(ay - 4, T); ctx.lineTo(ay + 4, T); ctx.closePath(); ctx.fill();

    ctx.font = '11px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#5a5a5a';

    var x = Math.ceil(v.xmin / xstep) * xstep;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (; x <= v.xmax + 1e-9; x += xstep) {
      var px = Math.round(this.sx(x)) + 0.5;
      ctx.strokeStyle = '#333';
      ctx.beginPath(); ctx.moveTo(px, ax); ctx.lineTo(px, ax + 4); ctx.stroke();
      if (Math.abs(x) > 1e-9) ctx.fillText(tickLabel(x, xstep), px, Math.min(ax + 7, B + 4));
    }

    var y = Math.ceil(v.ymin / ystep) * ystep;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (; y <= v.ymax + 1e-9; y += ystep) {
      var py = Math.round(this.sy(y)) + 0.5;
      ctx.strokeStyle = '#333';
      ctx.beginPath(); ctx.moveTo(ay, py); ctx.lineTo(ay - 4, py); ctx.stroke();
      if (Math.abs(y) > 1e-9) ctx.fillText(tickLabel(y, ystep), ay - 7, py);
    }

    var atEdgeX = ax >= B - 0.5, atEdgeY = ay <= L + 0.5;
    if (!(atEdgeX && atEdgeY)) {
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#777';
      ctx.fillText('0', ay - 5, ax + 5);
    }
    ctx.restore();
  };

  Plot.prototype._drawAnnotation = function (ctx, an) {
    if (an.x == null || an.y == null) return;
    var px = this.sx(an.x), py = this.sy(an.y);
    var color = an.color || '#b03a2e';
    ctx.save();
    ctx.strokeStyle = color;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.1;
    ctx.globalAlpha = 0.75;
    if (an.guides !== false) {
      var g = an.guides;
      if (g === true || g == null || g.x !== false) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, this.sy(Math.max(this.state.view.ymin, 0)));
        ctx.stroke();
      }
      if (g === true || g == null || g.y !== false) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(this.sx(Math.max(this.state.view.xmin, 0)), py);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    if (an.dot !== false) {
      ctx.beginPath();
      ctx.arc(px, py, an.r || 4.5, 0, Math.PI * 2);
      ctx.fillStyle = an.dotColor || color;
      ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
    }

    if (an.label) {
      var lines = String(an.label).split('\n');
      var dx = an.dx == null ? 12 : an.dx;
      var dy = an.dy == null ? -14 : an.dy;
      ctx.font = (an.bold === false ? '' : '600 ') + '12.5px "Microsoft YaHei", sans-serif';
      var lh = 16;
      var tw = 0;
      for (var m = 0; m < lines.length; m++) tw = Math.max(tw, ctx.measureText(lines[m]).width);
      var rect = this.canvas.getBoundingClientRect();
      var limitL = this.pad.l + 4, limitR = rect.width - this.pad.r - 4;
      var limitT = this.pad.t + 6, limitB = rect.height - this.pad.b - 4;
      var rightAligned = dx < 0;
      var tx0 = px + dx;
      if (!rightAligned && tx0 + tw > limitR) { rightAligned = true; tx0 = px - 12; }
      if (rightAligned && tx0 - tw < limitL) { rightAligned = false; tx0 = px + 12; }
      ctx.textAlign = rightAligned ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      var totalH = (lines.length - 1) * lh;
      var startY = py + dy - totalH / 2;
      startY = Math.min(Math.max(startY, limitT), limitB - totalH);
      for (var k = 0; k < lines.length; k++) {
        var tx = tx0, ty = startY + k * lh;
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.95)';
        ctx.strokeText(lines[k], tx, ty);
        ctx.fillStyle = an.labelColor || '#222';
        ctx.fillText(lines[k], tx, ty);
      }
    }
    ctx.restore();
  };

  Plot.prototype._drawLegend = function (ctx, R, T) {
    var all = (this.state.curves || []).concat(this.state.overlay || []);
    var items = all.filter(function (c) {
      return c.label && c.visible !== false && !c.noLegend;
    });
    if (!items.length) return;
    ctx.save();
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    var wMax = 0;
    items.forEach(function (c) { wMax = Math.max(wMax, ctx.measureText(c.label).width); });
    var bw = wMax + 46, bh = items.length * 20 + 12;
    var bx = R - bw - 10, by = T + 10;
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.strokeStyle = '#e2e6ea'; ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 6); else ctx.rect(bx, by, bw, bh);
    ctx.fill(); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    items.forEach(function (c, i) {
      var y = by + 16 + i * 20;
      ctx.strokeStyle = c.color; ctx.lineWidth = c.width || 2.2;
      ctx.setLineDash(c.dash || []);
      ctx.beginPath(); ctx.moveTo(bx + 10, y); ctx.lineTo(bx + 34, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#333';
      ctx.fillText(c.label, bx + 40, y);
    });
    ctx.restore();
  };

  /* ---------------------------- 悬停读数 ---------------------------- */
  Plot.prototype.showTooltip = function (e) {
    var st = this.state;
    if (!st) return;
    var rows = ['x = ' + MathFn.fmt(this.hover.x, 2)];
    var envBase = Object.assign({}, st.params || {});
    (st.curves || []).forEach(function (c) {
      if (c.visible === false || !c._fn) return;
      if ((c.type || 'explicit') !== 'explicit') return;
      var env = Object.assign({}, envBase);
      env[st.xVar || 'x'] = this.hover.x; env.x = this.hover.x;
      var yv;
      try { yv = c._fn.eval(env); } catch (err) { yv = NaN; }
      if (isFinite(yv)) {
        rows.push('<span style="color:' + c.color + '">■</span> ' +
          (c.label || c.expr) + ' = ' + MathFn.fmt(yv, 3));
      }
    }, this);

    var t = this.tooltip;
    t.innerHTML = rows.join('<br>');
    t.style.display = 'block';
    var wrapRect = this.canvas.parentElement.getBoundingClientRect();
    var x = e.clientX - wrapRect.left + 16, y = e.clientY - wrapRect.top + 14;
    t.style.left = Math.min(x, wrapRect.width - t.offsetWidth - 8) + 'px';
    t.style.top = Math.min(y, wrapRect.height - t.offsetHeight - 8) + 'px';
  };

  Plot.prototype.drawOverlay = function () {
    var ctx = this.octx, r = this.canvas.getBoundingClientRect();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    if (!this.hover || !this.state) return;
    var mx = this.hover.mx, my = this.hover.my;
    ctx.save();
    ctx.strokeStyle = '#9aa5b1'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(mx, this.pad.t); ctx.lineTo(mx, r.height - this.pad.b);
    ctx.moveTo(this.pad.l, my); ctx.lineTo(r.width - this.pad.r, my);
    ctx.stroke();
    ctx.restore();
  };

  Plot.prototype.exportPNG = function (filename) {
    this.state.showTitle = true;
    this.render();
    var url = this.canvas.toDataURL('image/png');
    var a = document.createElement('a');
    a.href = url; a.download = filename || 'econ-graph.png';
    document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); }, 500);
    this.state.showTitle = false;
    this.render();
  };

  global.Plot = Plot;
  global.PLOT_PALETTE = PALETTE;
})(window);


