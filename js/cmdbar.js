/* ==========================================================================
   cmdbar.js — 顶部命令栏
   输入：函数 / 算式 / 隐函数 / 参数方程 / 命令
   回车即解析：能算的给数值，能画的直接画，命令交给对应工具。
   ========================================================================== */
(function (global) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var bridge = null;
  var history = [], hIdx = -1, timer = null;

  var EXAMPLES = [
    'sin(x)', 'x^2 - 3*x + 2', '2 + 3*4', 'x^2 + y^2 = 4',
    'taylor(sin(x), 7)', 'series(sin(n*x)/n, 20)', 'nested(sqrt(2 + R), 10)'
  ];

  function init(b) {
    bridge = b;
    var input = $('cmdInput');

    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { preview(input.value); }, 180);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); run(input.value); }
      else if (e.key === 'ArrowUp') {
        if (!history.length) return;
        e.preventDefault();
        hIdx = Math.min(history.length - 1, hIdx + 1);
        input.value = history[history.length - 1 - hIdx];
        preview(input.value);
      } else if (e.key === 'ArrowDown') {
        if (!history.length) return;
        e.preventDefault();
        hIdx = Math.max(-1, hIdx - 1);
        input.value = hIdx < 0 ? '' : history[history.length - 1 - hIdx];
        preview(input.value);
      } else if (e.key === 'Escape') {
        input.value = ''; setHint('', '');
      }
    });

    $('cmdRun').addEventListener('click', function () { run(input.value); });
    $('cmdHelp').addEventListener('click', function () {
      setHint('可输入：函数 sin(x) ｜ 算式 2+3*4 ｜ 隐函数 x^2+y^2=4 ｜ taylor(sin(x),7) ｜ series(通项,N) ｜ nested(模板,N) ｜ deriv(f,k) ｜ preset(模板id) ｜ clear', 'info');
    });
    input.setAttribute('placeholder', '输入函数 / 算式 / 命令，回车执行 —— 例如 ' + EXAMPLES[0]);
  }

  function setHint(text, cls) {
    var el = $('cmdHint');
    el.textContent = text || '';
    el.className = 'cmd-hint' + (cls ? ' ' + cls : '');
  }

  /* ------------------------------ 解析 ------------------------------ */
  function splitTop(s) {
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out.map(function (x) { return x.trim(); });
  }

  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };

  function pretty(s) {
    var p = Calc.pretty(String(s));
    p = p.replace(/\^(-?\d+)/g, function (m0, d) {
      return d.split('').map(function (ch) { return SUP[ch] || ch; }).join('');
    });
    return p;
  }

  function tryCompile(s) {
    try { return { ok: true, c: MathFn.compile(s) }; }
    catch (e) { return { ok: false, err: e.message }; }
  }

  /** 返回 {kind, ...} 描述这条输入 */
  function parse(raw) {
    var s = String(raw || '').trim();
    if (!s) return { kind: 'empty' };
    var low = s.toLowerCase();

    if (low === 'clear' || low === '清空') return { kind: 'clear' };
    if (low === 'help' || low === '帮助') return { kind: 'help' };

    var m = s.match(/^preset\s*\(\s*(.+?)\s*\)$/i) || s.match(/^预设\s*[:：]?\s*(.+)$/i);
    if (m) return { kind: 'preset', id: m[1].trim() };

    m = s.match(/^(add|sum|plus)\s*\(([\s\S]*)\)$/i);
    if (m) {
      var parts = splitTop(m[2]);
      if (parts.length >= 2) return { kind: 'add', args: parts };
    }

    m = s.match(/^(\w+)\s*\(([\s\S]*)\)$/);
    if (m && ['taylor', 'series', 'nested', 'deriv'].indexOf(m[1].toLowerCase()) >= 0) {
      var fn = m[1].toLowerCase();
      var args = splitTop(m[2]);
      return { kind: fn, args: args };
    }

    // taylor sin(x) 7 / series sin(n*x)/n 20 / nested sqrt(2+R) 10 / deriv sin(x) 2
    m = s.match(/^(taylor|series|nested|deriv)\s+([\s\S]+?)\s+(\d+)\s*$/i);
    if (m) return { kind: m[1].toLowerCase(), args: [m[2].trim(), m[3]] };

    // 参数方程 (x(t), y(t))
    m = s.match(/^\(\s*([^,]+),\s*([^)]+)\)\s*$/);
    if (m) {
      var a = tryCompile(m[1]), b = tryCompile(m[2]);
      if (a.ok && b.ok && (a.c.vars.indexOf('t') >= 0 || b.c.vars.indexOf('t') >= 0)) {
        return { kind: 'parametric', x: m[1].trim(), y: m[2].trim() };
      }
    }

    // 去掉 f(x)= / y= 前缀
    var body = s.replace(/^\s*(?:[a-zA-Z]\w*\s*\(\s*[a-zA-Z]\s*\)|y|f)\s*=\s*/i, '');

    // 隐函数：含 = 且两边都有变量
    var eq = body.split('=');
    if (eq.length === 2 && eq[1].trim()) {
      var both = '(' + eq[0] + ') - (' + eq[1] + ')';
      var t = tryCompile(both);
      if (t.ok) {
        if (t.c.vars.indexOf('y') >= 0) return { kind: 'implicit', expr: both };
        return { kind: 'explicit', expr: eq[1].trim(), label: s };
      }
    }

    var c = tryCompile(body);
    if (!c.ok) return { kind: 'error', err: c.err };
    var vars = c.c.vars;
    if (vars.length === 0) {
      var val = c.c.eval({});
      return { kind: 'number', value: val, expr: body };
    }
    if (vars.indexOf('y') >= 0) return { kind: 'implicit', expr: body };
    if (vars.indexOf('n') >= 0) return { kind: 'term', expr: body };
    return { kind: 'explicit', expr: body };
  }

  /* ------------------------------ 预览 ------------------------------ */
  var FUNC_NAMES = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh',
    'ln', 'log', 'log2', 'sqrt', 'exp', 'abs', 'min', 'max', 'pow'];

  /** 表达式里是否有「裸函数名」（sin 后面没跟括号）——说明还没打完 */
  function bareFunc(expr) {
    try {
      var vars = MathFn.compile(expr).vars;
      for (var i = 0; i < vars.length; i++) {
        if (FUNC_NAMES.indexOf(vars[i]) >= 0) return vars[i];
      }
    } catch (e) { return null; }
    return null;
  }

  function isComplete(s) {
    if (!s) return false;
    var depth = 0;
    for (var i = 0; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') { depth--; if (depth < 0) return false; }
    }
    if (depth !== 0) return false;
    if (/[+\-*/^]$/.test(s)) return false;
    if (bareFunc(s)) return false;
    try { MathFn.compile(s); return true; } catch (e) { return false; }
  }

  /** 最长可用的完整前缀 */
  function bestEffort(text) {
    var s = window.Normalize ? window.Normalize.math(text) : String(text);
    for (var k = 0; k < 24 && s.length; k++) {
      if (isComplete(s)) return s;
      var t = s
        .replace(/[+\-*/^(]+$/, '')
        .replace(/\([^()]*$/, '')
        .replace(/(asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|ln|log2|log|sqrt|exp|abs)\(?$/, '')
        .replace(/[a-zA-Z]+$/, '');
      if (t === s) break;
      s = t;
    }
    return null;
  }

  /** 标准书写形式：去掉多余的括号、^ 的括号，供顶栏回显 */
  function canonical(s) {
    if (!window.Normalize) return String(s);
    var t = window.Normalize.math(s);
    t = t.replace(/\^\(([A-Za-z]\w*|\d+(?:\.\d+)?)\)/g, '^$1');   // ^(x) → ^x
    t = t.replace(/\*\(([A-Za-z]\w*)\)/g, '*$1');
    return t;
  }

  function normalizedOf(s) {
    if (!window.Normalize) return s;
    try { return window.Normalize.math(s); } catch (e) { return s; }
  }

  function preview(text) {
    if (!text.trim()) { setHint('', ''); return; }
    var p = parse(text);
    var norm = normalizedOf(text);
    var note = '';
    if (norm && norm !== String(text).replace(/\s+/g, '')) note = '　识别为 ' + norm;

    // 还没打完：按最长完整前缀绘制
    var incomplete = (p.kind === 'error') || (p.kind === 'explicit' && bareFunc(p.expr));
    if (incomplete) {
      var pre = bestEffort(text);
      if (pre && /x/i.test(pre)) {
        bridge.liveDraw({ type: 'explicit', expr: pre, label: pre });
        bridge.showExpr('<b>y = ' + pretty(pre) + '</b>　<span style="color:#9aa5b1">（正在输入…）</span>');
        setHint('补全中，当前显示 y = ' + pre, 'info');
        return;
      }
      if (p.kind === 'error') { setHint('✗ ' + p.err, 'err'); return; }
    }
    switch (p.kind) {
      case 'number': setHint('= ' + MathFn.fmt(p.value, 8) + note, 'ok'); break;
      case 'explicit':
        if (!/x/i.test(p.expr)) { setHint('继续输入含 x 的表达式…', 'info'); break; }
        setHint('将绘制 y = ' + p.expr + note, 'ok');
        bridge.liveDraw({ type: 'explicit', expr: p.expr, label: p.expr });
          bridge.showExpr('<b>y = ' + pretty(cExp) + '</b>');
        break;
      case 'add': setHint('将画 f、g 与 f + g', 'ok'); break;
      case 'implicit':
        if (!/x/i.test(p.expr) || !/y/i.test(p.expr)) { setHint('继续输入含 x、y 的隐函数…', 'info'); break; }
        setHint('隐函数 F(x,y) = 0' + note, 'ok');
        bridge.liveDraw({ type: 'implicit', expr: p.expr, label: 'F(x,y)=0' });
        bridge.showExpr('<b>' + pretty(p.expr) + ' = 0</b>');
        break;
      case 'parametric':
        setHint('参数曲线 (x(t), y(t))' + note, 'ok');
        bridge.liveDraw({ type: 'parametric', expr: p.x, expr2: p.y, label: '参数曲线' });
        bridge.showExpr('<b>x = ' + pretty(p.x) + '，y = ' + pretty(p.y) + '</b>');
        break;
      case 'term': setHint('含 n，用 series(通项, N) 累加', 'warn'); break;
      case 'taylor': case 'series': case 'nested': case 'deriv':
        setHint('命令：' + p.kind + '（回车执行）', 'ok'); break;
      case 'preset': setHint('切换到模板 ' + p.id, 'ok'); break;
      case 'clear': setHint('清空命令曲线与叠加层', 'ok'); break;
      case 'help': setHint('显示帮助', 'ok'); break;
      case 'error': setHint('✗ ' + p.err, 'err'); break;
      default: setHint('', '');
    }
  }

  /* ------------------------------ 执行 ------------------------------ */
  function run(text) {
    var s = String(text || '').trim();
    if (!s) return;
    history.push(s); hIdx = -1;
    var p = parse(s);

    try {
      switch (p.kind) {
        case 'empty': return;
        case 'error': setHint('✗ ' + p.err, 'err'); return;
        case 'help':
          setHint('函数 sin(x) ｜ 相加 add(sin(x), x^2) ｜ 算式 2+3*4 ｜ 隐函数 x^2+y^2=4 ｜ 参数 (cos(t), sin(t)) ｜ taylor(f,n) ｜ series(通项,N) ｜ nested(模板,N) ｜ deriv(f,k) ｜ preset(id) ｜ clear', 'info');
          return;

        case 'number': {
          var v = p.value;
          bridge.liveDraw({
            type: 'explicit', expr: String(v),
            label: '= ' + MathFn.fmt(v, 8), color: '#d68910', width: 1.6, dash: [6, 4]
          });
          if (bridge.fitValue) bridge.fitValue(v);
          bridge.showExpr('<b>= ' + MathFn.fmt(v, 8) + '</b>　（已画成水平参考线）');
          setHint('= ' + MathFn.fmt(v, 8) + '（已画成水平参考线）', 'ok');
          return;
        }

        case 'add': {
          var a = p.args[0], b = p.args[1];
          MathFn.compile(a); MathFn.compile(b);
          var sum = '(' + a + ') + (' + b + ')';
          bridge.ensureBlank(false);
          bridge.cmdCurveSet([
            { type: 'explicit', expr: a, label: 'f(x) = ' + a, color: '#9aa5b1', width: 1.5, dash: [7, 5] },
            { type: 'explicit', expr: b, label: 'g(x) = ' + b, color: '#9aa5b1', width: 1.5, dash: [3, 4] },
            { type: 'explicit', expr: sum, label: 'f + g', color: '#c0392b', width: 2.8 }
          ]);
          bridge.showExpr('<b>y = ' + pretty(a) + ' + ' + pretty(b) + '</b>　（红色为和，灰色虚线为两个分函数）');
          setHint('✓ 已画 f、g 与 f + g', 'ok');
          return;
        }

        case 'explicit':
          var cExp = canonical(p.expr);
          bridge.liveDraw({ type: 'explicit', expr: cExp, label: cExp });
          $('cmdInput').value = cExp;
          bridge.showExpr('<b>y = ' + pretty(cExp) + '</b>');
          setHint('✓ 已绘制 ' + cExp, 'ok');
          return;

        case 'implicit':
          bridge.liveDraw({ type: 'implicit', expr: p.expr, label: 'F(x,y)=0' });
          $('cmdInput').value = canonical(p.expr);
          bridge.showExpr('<b>' + pretty(p.expr) + ' = 0</b>');
          setHint('✓ 已绘制隐函数曲线', 'ok');
          return;

        case 'parametric':
          bridge.liveDraw({ type: 'parametric', expr: p.x, expr2: p.y, label: '参数曲线' });
          bridge.showExpr('<b>x = ' + pretty(p.x) + '，y = ' + pretty(p.y) + '</b>');
          setHint('✓ 已绘制参数曲线', 'ok');
          return;

        case 'term':
          setHint('这个表达式含 n，请用 series(' + p.expr + ', 20) 累加', 'warn');
          return;

        case 'taylor': {
          bridge.ensureBlank(true);
          var src = p.args[0], n = parseInt(p.args[1], 10), x0 = parseFloat(p.args[2] || '0') || 0;
          var ast = MathFn.parse(MathFn.rhs(src));
          var t = Calc.taylor(ast, 'x', x0, Math.max(1, Math.min(12, n || 5)), bridge.state().params);
          var poly = Calc.toStr(t.poly);
          bridge.setOverlay([
            { type: 'explicit', expr: src, label: 'f(x)', color: '#111111', width: 2, dash: [6, 4] },
            { type: 'explicit', expr: poly, label: 'P' + n + '(x)', color: '#c0392b', width: 2.8 }
          ]);
          setHint('P' + n + '(x) = ' + Calc.pretty(poly), 'ok');
          return;
        }

        case 'series': {
          bridge.ensureBlank(true);
          var term = p.args[0];
          var rawN = String(p.args[1] || '');
          var N = /∞|inf|无穷/i.test(rawN) ? 400 : Math.max(1, Math.min(400, parseInt(rawN, 10) || 10));
          MathFn.compile(term);
          bridge.setOverlay([
            { type: 'series', expr: term, n0: 1, n1: N, label: 'S' + N + '(x)', color: '#8e44ad', width: 2.6 }
          ]);
          setHint('✓ 已累加前 ' + N + ' 项', 'ok');
          return;
        }

        case 'nested': {
          bridge.ensureBlank(true);
          var tpl = p.args[0], M = Math.max(1, Math.min(80, parseInt(p.args[1], 10) || 10));
          MathFn.compile(tpl);
          bridge.setOverlay([
            { type: 'nested', template: tpl, terminal: '0', n0: 1, n1: 80, label: '极限参考 (N=80)', color: '#9aa5b1', width: 1.4, dash: [5, 5] },
            { type: 'nested', template: tpl, terminal: '0', n0: 1, n1: M, label: '嵌套 N=' + M, color: '#c0392b', width: 2.8 }
          ]);
          setHint('✓ 已叠加 ' + M + ' 层', 'ok');
          return;
        }

        case 'deriv': {
          bridge.ensureBlank(true);
          var f = p.args[0], k = Math.max(0, Math.min(8, parseInt(p.args[1], 10) || 1));
          var ast2 = MathFn.parse(MathFn.rhs(f));
          var list = [];
          for (var i = 0; i <= k; i++) {
            list.push({
              type: 'explicit', expr: Calc.toStr(Calc.deriv(ast2, 'x', i)),
              label: (i === 0 ? 'f' : 'f⁽' + i + '⁾') + '(x)',
              color: ['#111111', '#c0392b', '#2e7d32', '#1f4e79', '#8e44ad'][i % 5], width: i === 0 ? 2.6 : 2
            });
          }
          bridge.setOverlay(list);
          setHint('✓ 已画 0–' + k + ' 阶导', 'ok');
          return;
        }

        case 'preset':
          if (bridge.applyPreset(p.id)) setHint('✓ 已切换到模板 ' + p.id, 'ok');
          else setHint('✗ 没有模板 ' + p.id, 'err');
          return;

        case 'clear':
          bridge.cmdClear();
          bridge.clearOverlay();
          bridge.hideExpr();
          setHint('已清空命令曲线与叠加层', 'ok');
          return;
      }
    } catch (e) {
      setHint('✗ ' + e.message, 'err');
    }
  }

  function simulate(text) {
    var input = $('cmdInput');
    if (!input) return;
    input.value = text;
    preview(text);
  }

  global.CmdBar = { init: init, run: run, parse: parse, simulate: simulate };
})(window);
