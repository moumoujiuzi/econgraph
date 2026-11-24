/* ==========================================================================
   tools.js — 数值工具面板 + 数据拟合（DOM 层，数值算法在 numeric.js）
   ========================================================================== */
(function (global) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var bridge = null;
  var last = { roots: null, tan: null, integral: null, riemann: null, iter: null, data: null };

  function init(b) {
    bridge = b;

    $('openTools').addEventListener('click', open);
    $('toolsClose').addEventListener('click', close);
    $('toolsOverlay').addEventListener('click', function (e) {
      if (e.target === $('toolsOverlay')) close();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    Array.prototype.forEach.call(document.querySelectorAll('#toolsTabs .tab'), function (t) {
      t.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('#toolsTabs .tab'), function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        Array.prototype.forEach.call(document.querySelectorAll('[data-tpanel]'), function (p) {
          p.classList.toggle('hidden', p.getAttribute('data-tpanel') !== t.getAttribute('data-ttab'));
        });
      });
    });

    // 求根
    $('numRootRun').addEventListener('click', runRoot);
    $('numRootPlot').addEventListener('click', plotRoot);
    // 切线
    $('numTanRun').addEventListener('click', runTangent);
    $('numTanPlot').addEventListener('click', plotTangent);
    // 积分
    $('numIntRun').addEventListener('click', runIntegral);
    $('numIntPlot').addEventListener('click', plotIntegral);
    // 黎曼
    $('numRieRun').addEventListener('click', runRiemann);
    $('numRiePlot').addEventListener('click', plotRiemann);
    // 迭代
    $('numIterRun').addEventListener('click', runIter);
    $('numIterPlot').addEventListener('click', plotIter);
    // 数据
    $('numDataRun').addEventListener('click', runData);
    $('numDataPlot').addEventListener('click', plotData);
  }

  function open() {
    $('toolsOverlay').classList.remove('hidden');
    fillSelects();
    var st = bridge.state();
    if ($('numRootA1').value === '') $('numRootA1').value = round(st.view.xmin);
    if ($('numRootB1').value === '') $('numRootB1').value = round(st.view.xmax);
    if ($('numIntA').value === '') $('numIntA').value = round(st.view.xmin);
    if ($('numIntB').value === '') $('numIntB').value = round(st.view.xmax);
    if ($('numRieA').value === '') $('numRieA').value = round(st.view.xmin);
    if ($('numRieB').value === '') $('numRieB').value = round(st.view.xmax);
  }
  function close() { $('toolsOverlay').classList.add('hidden'); }

  function round(v) { return Math.round(v * 1000) / 1000; }

  function fillSelects() {
    var opts = bridge.curveOptions();
    ['numRootA', 'numRootB', 'numTanSrc', 'numIntSrc', 'numRieSrc'].forEach(function (id) {
      var sel = $(id);
      var prev = sel.value;
      sel.innerHTML = '';
      if (id === 'numRootB') {
        var none = document.createElement('option');
        none.value = '-1'; none.textContent = '（不比较）';
        sel.appendChild(none);
      }
      if (!opts.length) {
        var ph = document.createElement('option');
        ph.value = '-2';
        ph.textContent = '（当前图形没有 y=f(x) 曲线）';
        sel.appendChild(ph);
        sel.disabled = true;
        return;
      }
      sel.disabled = false;
      opts.forEach(function (o) {
        var el = document.createElement('option');
        el.value = String(o.index);
        el.textContent = (o.index + 1) + '. ' + o.label;
        sel.appendChild(el);
      });
      if (prev && prev !== '-1') sel.value = prev;
    });
  }

  function selectedExpr(id) {
    var idx = parseInt($(id).value, 10);
    if (!(idx >= 0)) return null;
    var o = bridge.curveOptions().filter(function (x) { return x.index === idx; })[0];
    return o ? o.expr : null;
  }

  function makeFn(expr) {
    var c = MathFn.compile(expr);
    return function (x) {
      var st = bridge.state();
      var env = Object.assign({}, st.params || {});
      env.x = x;
      env[st.xVar || 'x'] = x;
      try {
        var v = c.eval(env);
        return isFinite(v) ? v : NaN;
      } catch (e) { return NaN; }
    };
  }

  function numOr(id, fallback) {
    var v = parseFloat($(id).value);
    return isFinite(v) ? v : fallback;
  }

  function viewRange() {
    var v = bridge.state().view;
    return { a: v.xmin, b: v.xmax };
  }

  function out(id, text, isErr) {
    var el = $(id);
    el.textContent = text;
    el.className = 'lab-out' + (isErr ? ' err' : '');
  }

  /* ------------------------------ 求根 ------------------------------ */
  function runRoot() {
    try {
      var src = selectedExpr('numRootA');
      if (!src) throw new Error('请先选择一条显函数曲线');
      var fa = makeFn(src);
      var bIdx = parseInt($('numRootB').value, 10);
      var f;
      if (bIdx >= 0) {
        var sb = selectedExpr('numRootB');
        var fb = makeFn(sb);
        f = function (x) { return fa(x) - fb(x); };
      } else {
        f = fa;
      }
      var vr = viewRange();
      var a = numOr('numRootA1', vr.a);
      var b = numOr('numRootB1', vr.b);
      if (!isFinite(a) || !isFinite(b) || b <= a) throw new Error('区间无效：要求 b > a');

      var roots = Num.findRoots(f, a, b, 4000, 1e-10);
      last.roots = { roots: roots, f: f, hasSecond: bIdx >= 0 };
      if (!roots.length) {
        out('numRootOut', '区间 [' + a + ', ' + b + '] 内没有找到实根。\n' +
          '提示：检查区间是否覆盖变号点，或把区间放宽。', true);
        return;
      }
      var lines = ['在 [' + a + ', ' + b + '] 内找到 ' + roots.length + ' 个根：', ''];
      roots.forEach(function (r, i) {
        lines.push('  x' + (i + 1) + ' = ' + MathFn.fmt(r, 8) + '    f = ' + MathFn.fmt(f(r), 6));
      });
      out('numRootOut', lines.join('\n'), false);
    } catch (e) {
      out('numRootOut', '✗ ' + e.message, true);
    }
  }

  function plotRoot() {
    if (!last.roots) return runRoot();
    var pts = last.roots.roots.map(function (r) {
      return { x: r, y: last.roots.hasSecond ? makeFn(selectedExpr('numRootA'))(r) : last.roots.f(r), color: '#c0392b', r: 6 };
    });
    bridge.addPoints(pts);
    if (!last.roots.roots.length) out('numRootOut', '没有根可以标注。', true);
  }

  /* ------------------------------ 切线 ------------------------------ */
  function runTangent() {
    try {
      var src = selectedExpr('numTanSrc');
      if (!src) throw new Error('请先选择一条显函数曲线');
      var x0 = parseFloat($('numTanX').value);
      if (!isFinite(x0)) throw new Error('切点 x₀ 无效');
      var f = makeFn(src);
      var tl = Num.tangentLine(f, x0);
      if (!tl) throw new Error('该点不可导（或函数在此无定义）');
      last.tan = { tl: tl };
      out('numTanOut',
        'f(' + MathFn.fmt(x0, 6) + ') = ' + MathFn.fmt(tl.y0, 6) + '\n' +
        "f'(" + MathFn.fmt(x0, 6) + ') ≈ ' + MathFn.fmt(tl.k, 6) + '\n\n' +
        '切线：y = ' + MathFn.fmt(tl.k, 6) + '·x ' + (tl.b >= 0 ? '+ ' : '− ') + MathFn.fmt(Math.abs(tl.b), 6), false);
    } catch (e) {
      out('numTanOut', '✗ ' + e.message, true);
    }
  }

  function plotTangent() {
    if (!last.tan) return runTangent();
    var tl = last.tan.tl;
    bridge.addCurve({ type: 'explicit', expr: tl.expr, label: '切线 @ x=' + MathFn.fmt(tl.x0, 3), dash: [6, 4], color: '#d68910' });
    bridge.addPoints([{ x: tl.x0, y: tl.y0, color: '#d68910', r: 6 }]);
  }

  /* ------------------------------ 定积分 ------------------------------ */
  function runIntegral() {
    try {
      var src = selectedExpr('numIntSrc');
      if (!src) throw new Error('请先选择一条显函数曲线');
      var vr2 = viewRange();
      var a = numOr('numIntA', vr2.a);
      var b = numOr('numIntB', vr2.b);
      if (!isFinite(a) || !isFinite(b) || b <= a) throw new Error('区间无效：要求 b > a');
      var f = makeFn(src);
      var v = Num.simpson(f, a, b, 800);
      last.integral = { src: src, a: a, b: b, value: v };
      out('numIntOut',
        '∫ from ' + a + ' to ' + b + '  f(x) dx ≈ ' + MathFn.fmt(v, 8) + '\n\n' +
        '（复合辛普森，800 段；被积函数：' + src + '）', false);
    } catch (e) {
      out('numIntOut', '✗ ' + e.message, true);
    }
  }

  function plotIntegral() {
    if (!last.integral) return runIntegral();
    var it = last.integral;
    bridge.addShade({ type: 'between', curve: it.src, line: 0, from: it.a, to: it.b, color: 'rgba(192,57,43,0.16)' });
    bridge.refresh();
  }

  /* ------------------------------ 黎曼和 ------------------------------ */
  function runRiemann() {
    try {
      var src = selectedExpr('numRieSrc');
      if (!src) throw new Error('请先选择一条显函数曲线');
      var vr3 = viewRange();
      var a = numOr('numRieA', vr3.a);
      var b = numOr('numRieB', vr3.b);
      var n = parseInt($('numRieN').value, 10);
      var mode = $('numRieMode').value;
      if (!isFinite(a) || !isFinite(b) || b <= a) throw new Error('区间无效：要求 b > a');
      if (!(n > 0)) throw new Error('子区间个数需为正整数');
      var f = makeFn(src);
      var res = Num.riemann(f, a, b, n, mode);
      var exact = Num.simpson(f, a, b, 2000);
      last.riemann = { src: src, a: a, b: b, n: n, mode: mode, sum: res.sum };
      var modeName = { left: '左端点', right: '右端点', mid: '中点' }[mode] || mode;
      out('numRieOut',
        modeName + '黎曼和，n = ' + n + '：\n' +
        '  R_n = ' + MathFn.fmt(res.sum, 8) + '\n' +
        '  积分 ≈ ' + MathFn.fmt(exact, 8) + '\n' +
        '  误差 = ' + MathFn.fmt(res.sum - exact, 8), false);
    } catch (e) {
      out('numRieOut', '✗ ' + e.message, true);
    }
  }

  function plotRiemann() {
    if (!last.riemann) return runRiemann();
    var r = last.riemann;
    bridge.addShade({
      type: 'rects', curve: r.src, from: r.a, to: r.b, n: r.n, mode: r.mode,
      color: 'rgba(31,78,121,0.14)', stroke: 'rgba(31,78,121,0.45)'
    });
    bridge.refresh();
  }

  /* ------------------------------ 迭代 / 蛛网 ------------------------------ */
  function runIter() {
    try {
      var src = ($('numIterF').value || '').trim();
      if (!src) throw new Error('请填写迭代函数 f(x)');
      var x0 = parseFloat($('numIterX0').value);
      var n = parseInt($('numIterN').value, 10);
      if (!isFinite(x0)) throw new Error('初值 x₀ 无效');
      var f = makeFn(src);
      var seq = Num.iterate(f, x0, n);
      last.iter = { src: src, x0: x0, n: n, seq: seq };
      out('numIterOut',
        'x₀ = ' + MathFn.fmt(x0, 6) + '，迭代 ' + (seq.length - 1) + ' 次：\n' +
        seq.slice(0, 12).map(function (v, i) { return '  x' + i + ' = ' + MathFn.fmt(v, 6); }).join('\n') +
        (seq.length > 12 ? '\n  …' : '') +
        '\n\n末项 ≈ ' + MathFn.fmt(seq[seq.length - 1], 8), false);
    } catch (e) {
      out('numIterOut', '✗ ' + e.message, true);
    }
  }

  function plotIter() {
    if (!last.iter) return runIter();
    var it = last.iter;
    var f = makeFn(it.src);
    bridge.addCurve({ type: 'explicit', expr: it.src, label: 'f(x)', color: '#1f4e79' });
    bridge.addCurve({ type: 'explicit', expr: 'x', label: 'y = x', color: '#9aa5b1', dash: [6, 5] });
    bridge.addPath(Num.cobweb(f, it.x0, it.n), { color: '#8e44ad', width: 1.8 });
    bridge.refresh();
  }

  /* ------------------------------ 数据拟合 ------------------------------ */
  function runData() {
    try {
      var text = $('numDataText').value;
      var parsed = Num.parseCSV(text);
      if (parsed.data.length < 2) throw new Error('至少需要两行有效数据（两列：x, y）');
      var xs = parsed.data.map(function (d) { return d.x; });
      var ys = parsed.data.map(function (d) { return d.y; });
      var reg = Num.ols(xs, ys);
      if (!reg) throw new Error('x 没有变化，无法拟合');
      last.data = { data: parsed.data, reg: reg };
      out('numDataOut',
        '样本 n = ' + reg.n + '（跳过 ' + parsed.skipped + ' 行）\n' +
        '拟合：ŷ = ' + MathFn.fmt(reg.a, 6) + ' + ' + MathFn.fmt(reg.b, 6) + '·x\n' +
        'R² = ' + MathFn.fmt(reg.r2, 6) + '\n' +
        'SSE = ' + MathFn.fmt(reg.sse, 8), false);
    } catch (e) {
      out('numDataOut', '✗ ' + e.message, true);
    }
  }

  function plotData() {
    if (!last.data) return runData();
    var d = last.data;
    bridge.addCurve({
      type: 'explicit', expr: '(' + d.reg.a + ') + (' + d.reg.b + ')*x',
      label: 'OLS 拟合（R²=' + MathFn.fmt(d.reg.r2, 3) + '）', color: '#c0392b', width: 2.4
    });
    bridge.addPoints(d.data.map(function (p) { return { x: p.x, y: p.y, r: 4, color: 'rgba(31,78,121,.75)' }; }));
    bridge.refresh();
  }

  /* ------------------------------ 自检 ------------------------------ */
  function selfTest() {
    var lines = [];
    function grab(id) { return ($(id).textContent || '').replace(/\s+/g, ' ').slice(0, 180); }
    try {
      fillSelects();
      $('numRootRun').click(); lines.push('ROOT: ' + grab('numRootOut'));
      $('numTanRun').click(); lines.push('TAN: ' + grab('numTanOut'));
      $('numIntRun').click(); lines.push('INT: ' + grab('numIntOut'));
      $('numRieRun').click(); lines.push('RIEMANN: ' + grab('numRieOut'));
      $('numIterRun').click(); lines.push('ITER: ' + grab('numIterOut'));
      $('numDataRun').click(); lines.push('DATA: ' + grab('numDataOut'));
      $('numRootPlot').click();
      $('numIntPlot').click();
      $('numRiePlot').click();
      lines.push('PLOTS: shades=' + bridge.state().shades.length + ' points=' + bridge.state().points.length);
    } catch (e) {
      lines.push('ERR: ' + e.message);
    }
    return lines;
  }

  global.Tools = { init: init, open: open, selfTest: selfTest };
})(window);
