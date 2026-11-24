/* ==========================================================================
   series.js — 级数工坊：泰勒逐项 / 级数逐项 / 导数逐阶
   所有结果都叠在图上（overlay），点一下加一项，实时长出来。
   ========================================================================== */
(function (global) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var bridge = null;

  var S = {
    taylor: { src: 'sin(x)', x0: 0, k: 1 },
    series: { term: 'sin(n*x)/n', n0: 1, n1: 1 },
    deriv: { src: 'sin(x)', k: 0 },
    nested: { tpl: 'sqrt(x + R)', term: '0', n1: 1 }
  };

  var PALETTE = ['#111111', '#c0392b', '#2e7d32', '#1f4e79', '#8e44ad', '#d68910', '#117a65'];

  function init(b) {
    bridge = b;
    $('openSeries').addEventListener('click', open);
    $('seriesClose').addEventListener('click', close);
    var modalEl = document.querySelector('#seriesOverlay .modal');
    if (modalEl) makeDraggable(modalEl);
    $('seriesOverlay').addEventListener('click', function (e) {
      if (e.target === $('seriesOverlay')) close();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    Array.prototype.forEach.call(document.querySelectorAll('#seriesTabs .tab'), function (t) {
      t.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('#seriesTabs .tab'), function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        Array.prototype.forEach.call(document.querySelectorAll('[data-spanel]'), function (p) {
          p.classList.toggle('hidden', p.getAttribute('data-spanel') !== t.getAttribute('data-stab'));
        });
        var which = t.getAttribute('data-stab');
        if (which === 'taylor') drawTaylor();
        else if (which === 'series') drawSeries();
        else if (which === 'deriv') drawDeriv();
        else if (which === 'nested') drawNested();
      });
    });

    // 泰勒
    $('tSource').addEventListener('input', function () {
      S.taylor.src = this.value;
      var norm = window.Normalize ? window.Normalize.math(this.value) : this.value;
      if (norm) {
        bridge.liveDraw({ type: 'explicit', expr: norm, label: prettyFn(norm), color: '#1f4e79', width: 2.6 });
        var ci = document.getElementById('cmdInput');
        if (ci) ci.value = norm;
      }
      drawTaylor();
    });
    $('tX0').addEventListener('input', function () { S.taylor.x0 = parseFloat(this.value) || 0; drawTaylor(); });
    $('tPlus').addEventListener('click', function () { S.taylor.k = Math.min(20, S.taylor.k + 1); drawTaylor(); });
    $('tMinus').addEventListener('click', function () { S.taylor.k = Math.max(0, S.taylor.k - 1); drawTaylor(); });
    $('tPlus5').addEventListener('click', function () { S.taylor.k = Math.min(20, S.taylor.k + 5); drawTaylor(); });
    $('tReset').addEventListener('click', function () { S.taylor.k = 0; drawTaylor(); });
    $('tClear').addEventListener('click', function () { bridge.clearOverlay(); });
    $('tFocus').addEventListener('click', function () {
      var x0 = S.taylor.x0 || 0;
      if (bridge.setView) bridge.setView(x0 - 5, x0 + 5, -2, 2);
    });

    // 级数（Σ 上下限 + 通项）
    $('sTerm').addEventListener('input', function () { S.series.term = this.value; drawSeries(); });
    $('sFrom').addEventListener('input', function () {
      var v = parseInt(this.value, 10);
      if (isFinite(v)) S.series.n0 = Math.max(0, Math.min(400, v));
      drawSeries();
    });
    $('sTo').addEventListener('input', function () {
      var raw = String(this.value).trim();
      var v;
      if (/∞|inf|无穷/i.test(raw)) v = 400;
      else v = parseInt(raw, 10);
      if (isFinite(v)) S.series.n1 = Math.max(1, Math.min(400, v));
      drawSeries();
    });
    $('sPlus1').addEventListener('click', function () { S.series.n1 = Math.min(400, S.series.n1 + 1); drawSeries(); });
    $('sMinus1').addEventListener('click', function () { S.series.n1 = Math.max(S.series.n0, S.series.n1 - 1); drawSeries(); });
    $('sPlus10').addEventListener('click', function () { S.series.n1 = Math.min(400, S.series.n1 + 10); drawSeries(); });
    $('sClear').addEventListener('click', function () { bridge.clearOverlay(); });
    $('sPresetSaw').addEventListener('click', function () {
      S.series = { term: 'sin(n*x)/n', n0: 1, n1: 1 }; syncSeriesInputs(); drawSeries();
    });
    $('sPresetSq').addEventListener('click', function () {
      S.series = { term: 'sin((2*n-1)*x)/(2*n-1)', n0: 1, n1: 1 }; syncSeriesInputs(); drawSeries();
    });
    $('sPresetGeo').addEventListener('click', function () {
      S.series = { term: 'x^n', n0: 0, n1: 1 }; syncSeriesInputs(); drawSeries();
    });

    // 导数
    $('dSource').addEventListener('input', function () { S.deriv.src = this.value; drawDeriv(); });
    $('dPlus').addEventListener('click', function () { S.deriv.k = Math.min(8, S.deriv.k + 1); drawDeriv(); });
    $('dMinus').addEventListener('click', function () { S.deriv.k = Math.max(0, S.deriv.k - 1); drawDeriv(); });
    $('dReset').addEventListener('click', function () { S.deriv.k = 0; drawDeriv(); });
    $('dClear').addEventListener('click', function () { bridge.clearOverlay(); });

    // 嵌套根式
    $('nTpl').addEventListener('input', function () { S.nested.tpl = this.value; drawNested(); });
    $('nTerm').addEventListener('input', function () { S.nested.term = this.value; drawNested(); });
    $('nPlus').addEventListener('click', function () { S.nested.n1 = Math.min(80, S.nested.n1 + 1); drawNested(); });
    $('nMinus').addEventListener('click', function () { S.nested.n1 = Math.max(1, S.nested.n1 - 1); drawNested(); });
    $('nPlus10').addEventListener('click', function () { S.nested.n1 = Math.min(80, S.nested.n1 + 10); drawNested(); });
    $('nApply').addEventListener('click', function () {
      var v = parseInt($('nN').value, 10);
      if (isFinite(v)) S.nested.n1 = Math.max(1, Math.min(80, v));
      drawNested();
    });
    $('nClear').addEventListener('click', function () { bridge.clearOverlay(); });
    $('nPre2').addEventListener('click', function () { setNested('sqrt(2 + R)', '0', 12); });
    $('nPreX').addEventListener('click', function () { setNested('sqrt(x + R)', '0', 12); });
    $('nPreGold').addEventListener('click', function () { setNested('sqrt(1 + R)', '0', 12); });
    $('nPreRam').addEventListener('click', function () { setNested('sqrt(1 + k*R)', '1', 12); });
    $('nPreFrac').addEventListener('click', function () { setNested('1 + 1/(1 + R)', '1', 12); });
    $('nPreA').addEventListener('click', function () { setNested('sqrt(a + R)', '0', 12); });
  }

  function makeDraggable(modal) {
    var head = modal.querySelector('.modal-head');
    if (!head) return;
    var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;

    head.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      if (e.target.closest('button') && !e.target.closest('.tab')) return;
      var r = modal.getBoundingClientRect();
      modal.style.position = 'fixed';
      modal.style.margin = '0';
      modal.style.left = r.left + 'px';
      modal.style.top = r.top + 'px';
      modal.style.maxHeight = Math.max(200, window.innerHeight - r.top - 12) + 'px';
      dragging = true;
      modal.classList.add('dragging');
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var w = modal.offsetWidth, h = modal.offsetHeight;
      var nx = Math.min(Math.max(-w + 120, ox + e.clientX - sx), window.innerWidth - 120);
      var ny = Math.min(Math.max(0, oy + e.clientY - sy), window.innerHeight - 60);
      modal.style.left = nx + 'px';
      modal.style.top = ny + 'px';
    });

    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      modal.classList.remove('dragging');
      document.body.style.userSelect = '';
    });
  }

  function open() {
    $('seriesOverlay').classList.remove('hidden');

    // 源函数默认取画布上的当前函数
    var cur = bridge.currentExpr ? bridge.currentExpr() : null;
    if (cur) {
      S.taylor.src = cur;
      S.deriv.src = cur;
      var ti = $('tSource'), di = $('dSource');
      if (ti) ti.value = cur;
      if (di) di.value = cur;
    }
    var active = document.querySelector('#seriesTabs .tab.active');
    var which = active ? active.getAttribute('data-stab') : 'taylor';
    if (which === 'taylor') drawTaylor();
    else if (which === 'series') drawSeries();
    else if (which === 'deriv') drawDeriv();
    else if (which === 'nested') drawNested();
  }
  function close() { $('seriesOverlay').classList.add('hidden'); }

  function out(id, text, isErr) {
    var el = $(id);
    el.textContent = text;
    el.className = 'lab-out' + (isErr ? ' err' : '');
    el.scrollTop = 0;
    if (window.requestAnimationFrame) {
      requestAnimationFrame(function () { el.scrollTop = 0; });
    }
  }

  function params() { return (bridge.state() && bridge.state().params) || {}; }

  /** 把中文/全角/数学符号规范化后再解析 */
  function fmtNum(v) {
    if (!isFinite(v)) return String(v);
    var a = Math.abs(v);
    if (a !== 0 && (a < 1e-4 || a >= 1e6)) return v.toExponential(2);
    return String(Math.round(v * 1e6) / 1e6);
  }

  function parseExpr(src) {
    var s = String(src || '');
    if (window.Normalize) s = window.Normalize.math(s);
    return { ast: MathFn.parse(s), text: s };
  }

  function prettyFn(txt) {
    try { return Calc.pretty(String(txt)); } catch (e) { return String(txt); }
  }

  /* ------------------------------ 泰勒 ------------------------------ */
  function drawTaylor() {
    var st = S.taylor;
    try {
      var parsed = parseExpr(st.src);
      var ast = parsed.ast;
      var srcNorm = parsed.text;
      var v = 'x';
      var t = Calc.taylor(ast, v, st.x0, st.k, params());
      var poly = Calc.toStr(t.poly);

      bridge.setOverlay([
        { type: 'explicit', expr: poly, label: 'P' + st.k + '(x) 部分和', color: '#c0392b', width: 2.8 }
      ]);

      var lines = [];

      // 在 x₀ 处数值检查左右导数：不相等就是不可导，泰勒展开没有意义
      var notDiff = '';
      try {
        var fx = MathFn.compile(srcNorm);
        var x0n = parseFloat(st.x0) || 0;
        var h = Math.max(1e-7, Math.abs(x0n) * 1e-6 + 1e-7);
        var f0 = fx.eval({ x: x0n });
        var dl = (f0 - fx.eval({ x: x0n - h })) / h;
        var dr = (fx.eval({ x: x0n + h }) - f0) / h;
        if (isFinite(dl) && isFinite(dr)) {
          var scale = Math.max(1, Math.abs(dl), Math.abs(dr));
          if (Math.abs(dl - dr) > 1e-3 * scale) {
            notDiff = '⚠ 这个函数在 x₀ = ' + x0n + ' 处不可导（左导 ' + fmtNum(dl) +
              ' ≠ 右导 ' + fmtNum(dr) + '），泰勒展开没有意义。';
          }
        } else if (!isFinite(f0)) {
          notDiff = '⚠ 这个函数在 x₀ = ' + x0n + ' 处没有定义，无法展开。';
        }
      } catch (e) { }

      if (notDiff) lines.push(notDiff);
      lines.push('f(x) = ' + prettyFn(srcNorm) + '，在 x₀ = ' + st.x0 + ' 处展开');
      lines.push('当前阶数 n = ' + st.k + '（共 ' + (st.k + 1) + ' 项：常数项到 x^' + st.k + '）');
      lines.push('');
      lines.push('P' + st.k + '(x) = ' + Calc.pretty(poly));
      lines.push('');
      lines.push('系数：' + t.coeffs.map(function (c, i) { return 'c' + i + '=' + Calc.fmtNum(Math.round(c * 1e6) / 1e6); }).join('  '));
      out('tOut', lines.join('\n'), false);
      $('tK').textContent = String(st.k);
    } catch (e) {
      var m = String(e && e.message ? e.message : e);
      if (/求导|deriv|不支持|无法/.test(m)) {
        out('tOut', '✗ 该函数不可导，无法展开\n\n' + m +
          '\n\n说明：绝对值、取整、min/max 这类函数在部分点没有导数，符号求导会失败。', true);
      } else {
        out('tOut', '✗ ' + m, true);
      }
    }
  }

  /* ------------------------------ 级数 ------------------------------ */
  function subst(term, k) {
    return String(term).replace(/\bn\b/g, '(' + k + ')');
  }

  function syncSeriesInputs() {
    $('sTerm').value = S.series.term;
    $('sFrom').value = String(S.series.n0);
    $('sTo').value = String(S.series.n1);
  }

  function drawSeries() {
    var st = S.series;
    try {
      var termNorm = window.Normalize ? window.Normalize.math(st.term) : st.term;
      MathFn.compile(termNorm); // 只验证语法
      var n0 = Math.max(0, Math.min(400, st.n0 | 0));
      var n = Math.min(st.n1, 400);
      if (n < n0) n = n0;
      bridge.setOverlay([
        {
          type: 'series', expr: st.term, n0: n0, n1: n,
          term: st.term, label: 'S' + n + '(x)：n=' + n0 + '…' + n, color: '#8e44ad', width: 2.6
        }
      ]);
      var preview = [];
      for (var k = st.n0; k <= Math.min(n, st.n0 + 3); k++) preview.push(subst(st.term, k));
      var lines = [];
      lines.push('通项 a(n, x) = ' + prettyFn(termNorm));
      lines.push('求和范围：n = ' + n0 + ' 到 ' + n + '，共 ' + (n - n0 + 1) + ' 项');
      lines.push('');
      lines.push('S(x) = ' + preview.join(' + ') + (n > n0 + 3 ? ' + …' : ''));
      lines.push('');
      lines.push('提示：把通项写成含 n 的形式，例如 sin(n*x)/n；n 由工具自动代入。');
      out('sOut', lines.join('\n'), false);
      $('sFrom').value = String(n0);
      $('sTo').value = (n >= 400) ? '∞ (按400项)' : String(n);
      $('sCount').textContent = String(n - n0 + 1);
    } catch (e) {
      out('sOut', '✗ ' + e.message, true);
    }
  }

  /* ------------------------------ 导数 ------------------------------ */
  var lastDeriv = [];
  function drawDeriv() {
    var st = S.deriv;
    try {
      var parsedD = parseExpr(st.src);
      var ast = parsedD.ast;
      var v = 'x';
      var list = [], lines = [];
      lines.push('f(x) = ' + prettyFn(parsedD.text) + '，当前显示 0 – ' + st.k + ' 阶导');
      lines.push('');
      for (var k = 0; k <= st.k; k++) {
        var d = Calc.deriv(ast, v, k);
        var s = Calc.toStr(d);
        var label = k === 0 ? 'f' : (k === 1 ? "f′" : (k === 2 ? 'f″' : 'f⁽' + k + '⁾'));
        list.push({
          type: 'explicit', expr: s, label: label + '(x)',
          color: PALETTE[k % PALETTE.length], width: k === 0 ? 2.8 : 2.0,
          dash: k === 0 ? [6, 4] : null
        });
        lines.push(' ' + label + '(x) = ' + Calc.pretty(s));
      }
      lastDeriv = list;
      bridge.setOverlay(list);
      out('dOut', lines.join('\n'), false);
      $('dK').textContent = String(st.k);
    } catch (e) {
      var m2 = String(e && e.message ? e.message : e);
      $('dK').textContent = String(S.deriv.k);
      if (/求导|deriv|不支持|无法/.test(m2)) {
        out('dOut', '✗ 该函数不可导（或本工具无法符号求导）\n\n' + m2 +
          '\n\n说明：绝对值 |x|、取整、min/max 等在部分点没有导数；\n' +
          '这类函数只能逐点算数值导数，不能给出统一的导数表达式。', true);
      } else {
        out('dOut', '✗ ' + m2, true);
      }
    }
  }

  function selfTest() {
    var lines = [];
    function brief(id) { return ($(id).textContent || '').replace(/\s+/g, ' ').slice(0, 150); }
    try {
      open();
      $('tPlus').click(); $('tPlus').click(); $('tPlus').click();
      lines.push('TAYLOR k=' + S.taylor.k + ' | ' + brief('tOut'));
      $('sPlus10').click();
      lines.push('SERIES N=' + S.series.n1 + ' | ' + brief('sOut'));
      $('dPlus').click(); $('dPlus').click();
      lines.push('DERIV k=' + S.deriv.k + ' | ' + brief('dOut'));
      $('nPlus').click(); $('nPlus').click(); $('nPlus').click();
      lines.push('NESTED N=' + S.nested.n1 + ' | ' + brief('nOut'));

      // 拖动逻辑自检：直接给标题栏发 mousedown / mousemove / mouseup
      var modalEl = document.querySelector('#seriesOverlay .modal');
      var headEl = modalEl && modalEl.querySelector('.modal-head');
      if (headEl) {
        var r0 = modalEl.getBoundingClientRect();
        headEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r0.left + 300, clientY: r0.top + 14 }));
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r0.left + 380, clientY: r0.top + 94 }));
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        var r1 = modalEl.getBoundingClientRect();
        lines.push('DRAG ' + Math.round(r1.left - r0.left) + ',' + Math.round(r1.top - r0.top));
        modalEl.style.position = '';
        modalEl.style.left = '';
        modalEl.style.top = '';
      }
      lines.push('OVERLAY=' + (bridge.state().overlay || []).length);
    } catch (e) {
      lines.push('ERR: ' + e.message);
    }
    return lines;
  }

  /* ------------------------------ 嵌套根式 ------------------------------ */
  function setNested(tpl, term, layers) {
    if (term == null || term === '') term = '0';
    S.nested = { tpl: tpl, term: String(term), n1: layers || 1 };
    $('nTpl').value = tpl;
    $('nTerm').value = term;
    drawNested();
  }

  /** sqrt(...) → √(...)，乘号/减号也换好看点 */
  function prettyNested(t) {
    return String(t)
      .replace(/\bsqrt\(/g, '√(')
      .replace(/\*/g, '·')
      .replace(/-(?!\d)/g, '−');
  }

  /** 从外往里展开第 i 层，depth 控制展开多少层 */
  function layerText(tpl, term, i, depth) {
    if (depth <= 0) return '…';
    var inner = (i > 1 || depth > 1) ? layerText(tpl, term, i + 1, depth - 1) : term;
    return tpl.replace(/R/g, inner).replace(/\bk\b/g, String(i));
  }

  function evalNested(tpl, term, n1, x) {
    var c = MathFn.compile(tpl);
    var t = MathFn.compile(term);
    var env = { x: x, R: 0, k: 1 };
    var v = t.eval(env);
    for (var k = n1; k >= 1; k--) {
      env.R = v; env.k = k;
      v = c.eval(env);
      if (!isFinite(v)) return NaN;
    }
    return v;
  }

  function drawNested() {
    var st = S.nested;
    try {
      var tplNorm = window.Normalize ? window.Normalize.math(st.tpl) : st.tpl;
      MathFn.compile(tplNorm);
      MathFn.compile(st.term);
      var n = Math.max(1, Math.min(80, st.n1));
      bridge.setOverlay([
        {
          type: 'nested', template: st.tpl, terminal: st.term, n0: 1, n1: 80,
          label: '极限参考 (N=80)', color: '#9aa5b1', width: 1.4, dash: [5, 5]
        },
        {
          type: 'nested', template: st.tpl, terminal: st.term, n0: 1, n1: n,
          label: '嵌套 N=' + n, color: '#c0392b', width: 2.8
        }
      ]);
      var sample = evalNested(st.tpl, st.term, n, 2);
      var hasX = /x/i.test(st.tpl) || /x/i.test(st.term);
      var hint = $('nTplHint');
      if (hint) hint.textContent = '√ 形式：' + prettyNested(tplNorm) + '（sqrt 就是根号 √，R 表示里面那一层）';

      // 嵌套式样：√(3 + √(3 + √(3 + …)))
      var form = '…';
      for (var d = 3; d >= 1; d--) {
        form = st.tpl.replace(/R/g, form).replace(/\bk\b/g, String(d));
      }

      // 最里面那一层：把 R 换成 R₀ 的实际值
      var termTxt = prettyNested(st.term);
      var termSlot = /^[-0-9.]+$/.test(termTxt) ? termTxt : '(' + termTxt + ')';
      var innermost = prettyNested(
        st.tpl.replace(/R/g, termSlot).replace(/\bk\b/g, String(n))
      );

      var lines = [];
      lines.push('无穷形式（跟 R₀ 无关）：' + prettyNested(form));
      lines.push('最里面那一层（这里会跟着 R₀ 变）：' + innermost + '　← R₀ = ' + prettyNested(st.term));
      lines.push('现在一共 ' + n + ' 层' + (st.tpl.indexOf('k') >= 0 ? '；k 是层号 1,2,3…' : ''));
      lines.push('');
      lines.push('逐层数值' + (hasX ? '（取 x = 2 处算）' : '（与 x 无关，只随层数变）') + '：');
      for (var k2 = 1; k2 <= Math.min(n, 5); k2++) {
        lines.push('  ' + k2 + ' 层 → ' + MathFn.fmt(evalNested(st.tpl, st.term, k2, 2), 8));
      }
      if (n > 5) lines.push('  …');
      lines.push('');
      lines.push('逐层展开（每加一层，外面多套一个根号）：');
      for (var i2 = 1; i2 <= Math.min(n, 4); i2++) {
        var txt = prettyNested(layerText(st.tpl, prettyNested(st.term), 1, i2));
        lines.push('  ' + i2 + ' 层：' + (txt.length > 150 ? txt.slice(0, 147) + '…' : txt));
      }
      if (n > 4) lines.push('  …');
      lines.push('');
      lines.push('  ' + n + ' 层 → ' + (isFinite(sample) ? MathFn.fmt(sample, 8) : '—'));
      lines.push('  80 层 → ' + MathFn.fmt(evalNested(st.tpl, st.term, 80, 2), 8) + '（就是极限）');

      out('nOut', lines.join('\n'), false);
      $('nN').value = String(n);
    } catch (e) {
      out('nOut', '✗ ' + e.message, true);
    }
  }

  function setSeries(term, n0, n1) {
    S.series = { term: term, n0: n0 == null ? 1 : n0, n1: n1 == null ? 1 : n1 };
    syncSeriesInputs();
    drawSeries();
  }

  global.SeriesLab = { init: init, open: open, selfTest: selfTest, setSeries: setSeries, setNested: setNested };
})(window);
