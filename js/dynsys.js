/* ==========================================================================
   dynsys.js — 二维动力系统数值内核
     · RK4 轨线积分
     · 雅可比矩阵与特征值
     · 平衡点求解（网格扫描 + 牛顿迭代）
     · 平衡点稳定性判别
   纯函数，可在 Node 里测试
   ========================================================================== */
(function (global) {
  'use strict';

  /** 四点 RK4；返回 [[x,y], ...]，最多 maxPts 个点 */
  function rk4(fx, fy, x0, y0, T, h, maxPts) {
    h = h || 0.01;
    var n = Math.min(maxPts || 4000, Math.max(1, Math.round(T / h)));
    var pts = [[x0, y0]];
    var x = x0, y = y0;
    for (var i = 0; i < n; i++) {
      var d1x = fx(x, y), d1y = fy(x, y);
      if (!isFinite(d1x) || !isFinite(d1y)) break;

      var d2x = fx(x + h * d1x / 2, y + h * d1y / 2);
      var d2y = fy(x + h * d1x / 2, y + h * d1y / 2);

      var d3x = fx(x + h * d2x / 2, y + h * d2y / 2);
      var d3y = fy(x + h * d2x / 2, y + h * d2y / 2);

      var d4x = fx(x + h * d3x, y + h * d3y);
      var d4y = fy(x + h * d3x, y + h * d3y);

      x += h * (d1x + 2 * d2x + 2 * d3x + d4x) / 6;
      y += h * (d1y + 2 * d2y + 2 * d3y + d4y) / 6;

      if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 1e9 || Math.abs(y) > 1e9) break;
      pts.push([x, y]);
    }
    return pts;
  }

  /** 数值雅可比 [[a,b],[c,d]] */
  function jacobian(fx, fy, x, y) {
    var e = 1e-5 * (1 + Math.abs(x) + Math.abs(y));
    var a = (fx(x + e, y) - fx(x - e, y)) / (2 * e);
    var b = (fx(x, y + e) - fx(x, y - e)) / (2 * e);
    var c = (fy(x + e, y) - fy(x - e, y)) / (2 * e);
    var d = (fy(x, y + e) - fy(x, y - e)) / (2 * e);
    return { a: a, b: b, c: c, d: d };
  }

  /** 2×2 特征值（可能为复数） */
  function eigen2x2(J) {
    var tr = J.a + J.d;
    var det = J.a * J.d - J.b * J.c;
    var disc = tr * tr - 4 * det;
    if (disc >= 0) {
      var s = Math.sqrt(disc);
      return {
        l1: { re: (tr + s) / 2, im: 0 },
        l2: { re: (tr - s) / 2, im: 0 },
        tr: tr, det: det, disc: disc
      };
    }
    var s2 = Math.sqrt(-disc);
    return {
      l1: { re: tr / 2, im: s2 / 2 },
      l2: { re: tr / 2, im: -s2 / 2 },
      tr: tr, det: det, disc: disc
    };
  }

  /** 稳定性分类（中文） */
  function classify(ev) {
    var re1 = ev.l1.re, re2 = ev.l2.re;
    var im1 = Math.abs(ev.l1.im);
    var eps = 1e-7;
    if (im1 > eps) {
      if (Math.abs(re1) < eps) return { type: '中心', stable: null };
      return re1 < 0 ? { type: '稳定焦点', stable: true } : { type: '不稳定焦点', stable: false };
    }
    if (Math.abs(re1) < eps || Math.abs(re2) < eps) return { type: '临界情形', stable: null };
    if (re1 < 0 && re2 < 0) return { type: '稳定结点', stable: true };
    if (re1 > 0 && re2 > 0) return { type: '不稳定结点', stable: false };
    return { type: '鞍点', stable: false };
  }

  /** 牛顿法求平衡点，从 (x0,y0) 出发 */
  function newton(fx, fy, x0, y0, maxIter) {
    var x = x0, y = y0;
    for (var k = 0; k < (maxIter || 40); k++) {
      var f1 = fx(x, y), f2 = fy(x, y);
      if (!isFinite(f1) || !isFinite(f2)) return null;
      if (Math.abs(f1) + Math.abs(f2) < 1e-10) break;
      var J = jacobian(fx, fy, x, y);
      var det = J.a * J.d - J.b * J.c;
      if (Math.abs(det) < 1e-12) return null;
      var dx = (-f1 * J.d + f2 * J.b) / det;
      var dy = (-J.a * f2 + J.c * f1) / det;
      // 阻尼步，避免跑飞
      var step = 1;
      for (var s = 0; s < 12; s++) {
        var nx = x + step * dx, ny = y + step * dy;
        var nf = Math.abs(fx(nx, ny)) + Math.abs(fy(nx, ny));
        if (isFinite(nf) && nf < Math.abs(f1) + Math.abs(f2)) { x = nx; y = ny; break; }
        step *= 0.5;
        if (s === 11) return null;
      }
    }
    var f1e = fx(x, y), f2e = fy(x, y);
    if (!isFinite(f1e) || !isFinite(f2e)) return null;
    if (Math.abs(f1e) + Math.abs(f2e) > 1e-6) return null;
    return { x: x, y: y };
  }

  /** 在矩形区域网格扫描并求所有平衡点 */
  function equilibria(fx, fy, box, n) {
    n = n || 12;
    var out = [];
    var tol = Math.max(1e-6, (box.xmax - box.xmin) * 1e-4);
    for (var i = 0; i <= n; i++) {
      for (var j = 0; j <= n; j++) {
        var x0 = box.xmin + (box.xmax - box.xmin) * i / n;
        var y0 = box.ymin + (box.ymax - box.ymin) * j / n;
        var eq = newton(fx, fy, x0, y0);
        if (!eq) continue;
        if (eq.x < box.xmin - tol || eq.x > box.xmax + tol) continue;
        if (eq.y < box.ymin - tol || eq.y > box.ymax + tol) continue;
        var dup = out.some(function (q) {
          return Math.abs(q.x - eq.x) < tol * 5 && Math.abs(q.y - eq.y) < tol * 5;
        });
        if (!dup) out.push(eq);
      }
    }
    return out;
  }

  /** 一次性给出平衡点 + 分类 */
  function analyze(fx, fy, box, n) {
    return equilibria(fx, fy, box, n).map(function (eq) {
      var J = jacobian(fx, fy, eq.x, eq.y);
      var ev = eigen2x2(J);
      var cls = classify(ev);
      return {
        x: eq.x, y: eq.y, J: J, eigen: ev,
        type: cls.type, stable: cls.stable,
        trace: ev.tr, det: ev.det
      };
    });
  }

  /** 向量场采样：返回 [{x,y,dx,dy,mag}] */
  function field(fx, fy, box, nx, ny) {
    nx = nx || 16; ny = ny || 12;
    var out = [];
    for (var i = 0; i <= nx; i++) {
      for (var j = 0; j <= ny; j++) {
        var x = box.xmin + (box.xmax - box.xmin) * i / nx;
        var y = box.ymin + (box.ymax - box.ymin) * j / ny;
        var dx = fx(x, y), dy = fy(x, y);
        if (!isFinite(dx) || !isFinite(dy)) continue;
        var mag = Math.sqrt(dx * dx + dy * dy);
        out.push({ x: x, y: y, dx: dx, dy: dy, mag: mag });
      }
    }
    return out;
  }

  global.Dyn = {
    rk4: rk4, jacobian: jacobian, eigen2x2: eigen2x2, classify: classify,
    newton: newton, equilibria: equilibria, analyze: analyze, field: field
  };
})(typeof window !== 'undefined' ? window : globalThis);
