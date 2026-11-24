/* ==========================================================================
   numeric.js — 纯数值工具（不碰 DOM，可在 Node 里跑测试）
   求根、积分、黎曼和、切线、迭代、最小二乘、CSV 解析
   ========================================================================== */
(function (global) {
  'use strict';

  /** 二分求根：要求 f(a)、f(b) 异号（会自动按需夹逼） */
  function bisect(f, a, b, tol) {
    tol = tol || 1e-9;
    var fa = f(a), fb = f(b);
    if (!isFinite(fa) || !isFinite(fb)) return null;
    if (fa === 0) return a;
    if (fb === 0) return b;
    if (fa * fb > 0) return null;
    var lo = a, hi = b, flo = fa;
    for (var i = 0; i < 200; i++) {
      var mid = (lo + hi) / 2, fm = f(mid);
      if (!isFinite(fm)) { lo = mid; continue; }
      if (Math.abs(fm) < tol || (hi - lo) < tol) return mid;
      if (flo * fm <= 0) { hi = mid; } else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  }

  /** 在 [a,b] 上扫描并求所有符号变化的根 */
  function findRoots(f, a, b, n, tol) {
    n = Math.max(50, Math.min(20000, n || 2000));
    var roots = [], prevX = a, prevY = f(a);
    for (var i = 1; i <= n; i++) {
      var x = a + (b - a) * i / n;
      var y = f(x);
      if (!isFinite(y)) { prevX = x; prevY = y; continue; }
      if (isFinite(prevY)) {
        if (y === 0) { roots.push(x); }
        else if (prevY !== 0 && prevY * y < 0) {
          var r = bisect(f, prevX, x, tol || 1e-10);
          if (r !== null) roots.push(r);
        }
      }
      prevX = x; prevY = y;
    }
    // 去重
    var out = [];
    roots.sort(function (p, q) { return p - q; });
    for (var k = 0; k < roots.length; k++) {
      if (!out.length || Math.abs(roots[k] - out[out.length - 1]) > 1e-6) out.push(roots[k]);
    }
    return out;
  }

  /** 复合辛普森积分 */
  function simpson(f, a, b, n) {
    n = Math.max(2, Math.min(20000, (n || 400) | 0));
    if (n % 2) n += 1;
    var h = (b - a) / n, s = f(a) + f(b);
    for (var i = 1; i < n; i++) {
      var v = f(a + i * h);
      if (!isFinite(v)) v = 0;
      s += (i % 2 ? 4 : 2) * v;
    }
    return s * h / 3;
  }

  /** 黎曼和：mode = left | right | mid ；返回 {sum, bars:[{x0,x1,h}]} */
  function riemann(f, a, b, n, mode) {
    n = Math.max(1, Math.min(2000, n || 10));
    mode = mode || 'mid';
    var w = (b - a) / n, sum = 0, bars = [];
    for (var i = 0; i < n; i++) {
      var x0 = a + i * w, x1 = x0 + w;
      var xs = mode === 'left' ? x0 : (mode === 'right' ? x1 : (x0 + x1) / 2);
      var h = f(xs);
      if (!isFinite(h)) h = 0;
      sum += h * w;
      bars.push({ x0: x0, x1: x1, h: h, xs: xs });
    }
    return { sum: sum, bars: bars, width: w };
  }

  /** 中心差分求导 */
  function derivative(f, x, h) {
    h = h || Math.max(1e-6, Math.abs(x) * 1e-6 + 1e-6);
    var y1 = f(x + h), y0 = f(x - h);
    if (!isFinite(y1) || !isFinite(y0)) {
      var y2 = f(x + 2 * h), y3 = f(x - 2 * h);
      if (isFinite(y2) && isFinite(y3)) return (y2 - y3) / (4 * h);
      return NaN;
    }
    return (y1 - y0) / (2 * h);
  }

  /** 切线：返回 {x0, y0, k, expr}，expr 可直接画 */
  function tangentLine(f, x0) {
    var y0 = f(x0);
    var k = derivative(f, x0);
    if (!isFinite(y0) || !isFinite(k)) return null;
    var b = y0 - k * x0;
    var sign = b >= 0 ? '+' : '-';
    return {
      x0: x0, y0: y0, k: k, b: b,
      expr: '(' + trimNum(k) + ')*x ' + sign + ' ' + trimNum(Math.abs(b))
    };
  }

  function trimNum(v) {
    if (!isFinite(v)) return '0';
    var s = v.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
    return s === '-0' ? '0' : s;
  }

  /** 一维迭代（蛛网图）：返回折线点序列 [[x,y],...] */
  function cobweb(f, x0, steps) {
    steps = Math.max(1, Math.min(200, steps || 12));
    var pts = [[x0, 0], [x0, f(x0)]];
    var x = x0;
    for (var i = 0; i < steps; i++) {
      var y = f(x);
      if (!isFinite(y)) break;
      pts.push([y, y]);     // 水平走到 45° 线
      pts.push([y, f(y)]);  // 垂直到曲线
      x = y;
    }
    return pts;
  }

  /** 迭代序列 */
  function iterate(f, x0, steps) {
    var out = [x0], x = x0;
    for (var i = 0; i < (steps || 10); i++) {
      var y = f(x);
      if (!isFinite(y)) break;
      out.push(y); x = y;
      if (Math.abs(y) > 1e12) break;
    }
    return out;
  }

  /** 最小二乘 y = a + b x */
  function ols(xs, ys) {
    var n = Math.min(xs.length, ys.length);
    if (n < 2) return null;
    var sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    for (var i = 0; i < n; i++) {
      var x = xs[i], y = ys[i];
      sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y;
    }
    var mx = sx / n, my = sy / n;
    var den = sxx - n * mx * mx;
    if (Math.abs(den) < 1e-12) return null;
    var b = (sxy - n * mx * my) / den;
    var a = my - b * mx;
    var ssTot = syy - n * my * my;
    var ssRes = 0;
    for (var j = 0; j < n; j++) {
      var e = ys[j] - (a + b * xs[j]);
      ssRes += e * e;
    }
    var r2 = ssTot > 1e-12 ? 1 - ssRes / ssTot : 1;
    return { a: a, b: b, r2: r2, n: n, sse: ssRes };
  }

  /** 解析 CSV/空格/制表符分隔的两列数据 */
  function parseCSV(text) {
    var lines = String(text || '').split(/\r?\n/);
    var out = [], skipped = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var parts = line.split(/[,\t;]+|\s{2,}/).filter(function (s) { return s !== ''; });
      if (parts.length < 2) {
        parts = line.split(/[,\t;\s]+/).filter(Boolean);
      }
      if (parts.length < 2) { skipped++; continue; }
      var x = parseFloat(parts[0]), y = parseFloat(parts[1]);
      if (!isFinite(x) || !isFinite(y)) { skipped++; continue; }
      out.push({ x: x, y: y });
    }
    return { data: out, skipped: skipped };
  }

  global.Num = {
    bisect: bisect, findRoots: findRoots, simpson: simpson,
    riemann: riemann, derivative: derivative, tangentLine: tangentLine,
    cobweb: cobweb, iterate: iterate, ols: ols, parseCSV: parseCSV
  };
})(typeof window !== 'undefined' ? window : globalThis);
