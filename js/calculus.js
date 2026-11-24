/* ==========================================================================
   calculus.js — 符号计算层（不依赖任何外部库）
   提供：
     · 化简 simplify
     · 符号求导 deriv(ast, var, order)
     · 表达式还原 toStr
     · 泰勒展开 taylor(ast, var, x0, n)
     · 二项式展开 binomialTerms / binomialCoeffs
     · 莱布尼茨公式 leibnizTerms（(uv) 的 n 阶导）
     · 数值微分 numericDeriv（用于病态函数兜底）
   依赖 mathfn.js 的 parse 产物（AST：num / var / bin / neg / call）
   ========================================================================== */
(function (global) {
  'use strict';

  var MF = global.MathFn;

  /* ------------------------------ 构造器 ------------------------------ */
  function num(v) { return { k: 'num', v: v }; }
  function isNum(n, v) {
    return n && n.k === 'num' && (v === undefined || Math.abs(n.v - v) < 1e-12);
  }
  function bin(op, a, b) { return { k: 'bin', op: op, a: a, b: b }; }

  function add(a, b) {
    if (isNum(a, 0)) return b;
    if (isNum(b, 0)) return a;
    if (isNum(a) && isNum(b)) return num(a.v + b.v);
    return bin('+', a, b);
  }
  function sub(a, b) {
    if (isNum(b, 0)) return a;
    if (isNum(a, 0)) return neg(b);
    if (isNum(a) && isNum(b)) return num(a.v - b.v);
    return bin('-', a, b);
  }
  function mul(a, b) {
    if (isNum(a, 0) || isNum(b, 0)) return num(0);
    if (isNum(a, 1)) return b;
    if (isNum(b, 1)) return a;
    if (isNum(a, -1)) return neg(b);
    if (isNum(b, -1)) return neg(a);
    if (isNum(a) && isNum(b)) return num(a.v * b.v);
    // 合并嵌套常数：2*(3*x) -> 6*x
    if (isNum(a) && b.k === 'bin' && b.op === '*' && isNum(b.a)) {
      return mul(num(a.v * b.a.v), b.b);
    }
    if (isNum(b) && a.k === 'bin' && a.op === '*' && isNum(a.a)) {
      return mul(num(b.v * a.a.v), a.b);
    }
    return bin('*', a, b);
  }
  function div(a, b) {
    if (isNum(a, 0)) return num(0);
    if (isNum(b, 1)) return a;
    if (isNum(a) && isNum(b) && b.v !== 0) return num(a.v / b.v);
    return bin('/', a, b);
  }
  function pow(a, b) {
    if (isNum(b, 0)) return num(1);
    if (isNum(b, 1)) return a;
    if (isNum(a, 1)) return num(1);
    if (isNum(a) && isNum(b)) return num(Math.pow(a.v, b.v));
    return bin('^', a, b);
  }
  function neg(a) {
    if (!a) return num(0);
    if (a.k === 'num') return num(-a.v);
    if (a.k === 'neg') return a.a;
    return { k: 'neg', a: a };
  }
  function call(name, args) { return { k: 'call', name: name, args: args }; }

  /* ------------------------------ 工具 ------------------------------ */
  function depends(n, v) {
    if (!n) return false;
    if (n.k === 'var') return n.name === v;
    if (n.k === 'bin') return depends(n.a, v) || depends(n.b, v);
    if (n.k === 'neg') return depends(n.a, v);
    if (n.k === 'call') return n.args.some(function (a) { return depends(a, v); });
    return false;
  }

  function factorial(n) {
    var r = 1;
    for (var i = 2; i <= n; i++) r *= i;
    return r;
  }

  function comb(n, k) {
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    var r = 1;
    for (var i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return Math.round(r);
  }

  /* ------------------------------ 化简 ------------------------------ */
  function simplify(n) {
    if (!n) return n;
    if (n.k === 'num' || n.k === 'var') return n;
    if (n.k === 'neg') return neg(simplify(n.a));
    if (n.k === 'bin') {
      var a = simplify(n.a), b = simplify(n.b);
      switch (n.op) {
        case '+': return add(a, b);
        case '-': return sub(a, b);
        case '*': return mul(a, b);
        case '/': return div(a, b);
        case '^': return pow(a, b);
        case '%': return isNum(a) && isNum(b) ? num(a.v % b.v) : bin('%', a, b);
      }
    }
    if (n.k === 'call') {
      var args = n.args.map(simplify);
      if (args.every(isNum)) {
        var f = MF.FUNCS[n.name];
        if (f) {
          try { return num(f.apply(null, args.map(function (x) { return x.v; }))); } catch (e) { }
        }
      }
      return call(n.name, args);
    }
    return n;
  }

  /* ------------------------------ 求导 ------------------------------ */
  function deriv1(n, v) {
    if (!n) return num(0);
    switch (n.k) {
      case 'num': return num(0);
      case 'var': return num(n.name === v ? 1 : 0);
      case 'neg': return neg(deriv1(n.a, v));
      case 'bin': {
        var a = n.a, b = n.b;
        switch (n.op) {
          case '+': return add(deriv1(a, v), deriv1(b, v));
          case '-': return sub(deriv1(a, v), deriv1(b, v));
          case '*':
            return add(mul(deriv1(a, v), b), mul(a, deriv1(b, v)));
          case '/':
            return div(sub(mul(deriv1(a, v), b), mul(a, deriv1(b, v))), pow(b, num(2)));
          case '^': {
            if (!depends(b, v)) {           // 幂为常数：b·a^(b-1)·a'
              return mul(mul(b, pow(a, sub(b, num(1)))), deriv1(a, v));
            }
            if (!depends(a, v)) {           // 底为常数：a^b·ln(a)·b'
              return mul(mul(pow(a, b), call('ln', [a])), deriv1(b, v));
            }
            // 一般幂：a^b · (b'·ln a + b·a'/a)
            return mul(pow(a, b), add(
              mul(deriv1(b, v), call('ln', [a])),
              div(mul(b, deriv1(a, v)), a)
            ));
          }
        }
        break;
      }
      case 'call': {
        var u = n.args[0];
        var du = deriv1(u, v);
        switch (n.name) {
          case 'sin': return mul(call('cos', [u]), du);
          case 'cos': return neg(mul(call('sin', [u]), du));
          case 'tan': return mul(div(num(1), pow(call('cos', [u]), num(2))), du);
          case 'exp': return mul(call('exp', [u]), du);
          case 'ln': return div(du, u);
          case 'log': return div(du, mul(u, num(Math.LN10)));
          case 'log2': return div(du, mul(u, num(Math.LN2)));
          case 'sqrt': return div(du, mul(num(2), call('sqrt', [u])));
          case 'abs': return mul(call('sign', [u]), du);
          case 'sinh': return mul(call('cosh', [u]), du);
          case 'cosh': return mul(call('sinh', [u]), du);
          case 'tanh': return mul(sub(num(1), pow(call('tanh', [u]), num(2))), du);
          case 'asin': return div(du, call('sqrt', [sub(num(1), pow(u, num(2)))]));
          case 'acos': return neg(div(du, call('sqrt', [sub(num(1), pow(u, num(2)))])));
          case 'atan': return div(du, add(num(1), pow(u, num(2))));
          case 'sign': return num(0);
          case 'pow': return deriv1(bin('^', n.args[0], n.args[1]), v);
        }
        throw new Error('函数 ' + n.name + '() 暂不支持符号求导');
      }
    }
    throw new Error('无法求导的表达式');
  }

  /** n 阶导（n≥0，0 阶表示原函数） */
  function deriv(node, v, order) {
    var times = (order == null) ? 1 : Math.max(0, order | 0);
    var cur = simplify(node);
    for (var i = 0; i < times; i++) {
      cur = simplify(deriv1(cur, v));
      if (cur.k === 'num' && cur.v === 0) break;
    }
    return cur;
  }

  /* ------------------------------ 求值 ------------------------------ */
  function evalNode(n, env) {
    switch (n.k) {
      case 'num': return n.v;
      case 'var':
        if (n.name in env) return env[n.name];
        throw new Error('缺少变量 ' + n.name);
      case 'neg': return -evalNode(n.a, env);
      case 'bin': {
        var a = evalNode(n.a, env), b = evalNode(n.b, env);
        switch (n.op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return a / b;
          case '%': return a % b;
          case '^': return Math.pow(a, b);
        }
        break;
      }
      case 'call': {
        var args = n.args.map(function (x) { return evalNode(x, env); });
        if (n.name === 'min') return Math.min.apply(null, args);
        if (n.name === 'max') return Math.max.apply(null, args);
        var f = MF.FUNCS[n.name];
        if (!f) throw new Error('未知函数 ' + n.name);
        return f.apply(null, args);
      }
    }
    throw new Error('无法求值');
  }

  /* ------------------------------ 还原成字符串 ------------------------------ */
  var PREC = { num: 100, var: 100, call: 100, neg: 90, '^': 80, '*': 70, '/': 70, '%': 70, '+': 60, '-': 60 };

  function fmtNum(v) {
    if (!isFinite(v)) return 'NaN';
    if (Number.isInteger(v)) return String(v);
    var s = v.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s;
  }

  function toStr(n, parentPrec) {
    var s, p;
    switch (n.k) {
      case 'num': s = fmtNum(n.v); p = 100; break;
      case 'var': s = n.name; p = 100; break;
      case 'neg': s = '-' + wrap(n.a, 90); p = 90; break;
      case 'call': s = n.name + '(' + n.args.map(function (a) { return toStr(a); }).join(', ') + ')'; p = 100; break;
      case 'bin': {
        var op = n.op;
        p = PREC[op] || 60;
        if (op === '^') {
          s = wrap(n.a, 81) + '^' + wrap(n.b, 80);
        } else if (op === '*' || op === '/') {
          s = wrap(n.a, 70) + (op === '*' ? '*' : '/') + wrap(n.b, 71);
        } else {
          var ls = wrap(n.a, 60);
          if (op === '+') {
            var rs = wrap(n.b, 61);
            s = rs.charAt(0) === '-' ? ls + ' - ' + rs.slice(1) : ls + ' + ' + rs;
          } else {
            s = ls + ' - ' + wrap(n.b, 61);
          }
        }
        break;
      }
    }
    if (parentPrec != null && p < parentPrec) s = '(' + s + ')';
    return s;
  }

  function wrap(n, need) {
    return toStr(n, need);
  }

  /* ------------------------------ 泰勒展开 ------------------------------ */
  /**
   * 返回 { coeffs:[c0..cn], poly:AST, text, valueAtX0 }
   * 系数 ck = f⁽ᵏ⁾(x0)/k!
   */
  function taylor(ast, v, x0, n, extra) {
    n = Math.max(0, Math.min(12, n | 0));
    var coeffs = [], cur = simplify(ast), terms = [];
    for (var k = 0; k <= n; k++) {
      var val;
      try { val = evalNode(cur, buildEnv(v, x0, extra)); } catch (e) { val = NaN; }
      if (!isFinite(val)) val = 0;
      var c = val / factorial(k);
      coeffs.push(c);

      // 组成 (x - x0)^k 的项
      var xm = x0 === 0 ? { k: 'var', name: v } : sub({ k: 'var', name: v }, num(x0));
      var term = k === 0 ? num(c) :
        (x0 === 0 ? mul(num(c), pow({ k: 'var', name: v }, num(k)))
          : mul(num(c), pow(xm, num(k))));
      terms.push(term);

      if (k < n) {
        try { cur = simplify(deriv1(cur, v)); } catch (e) { break; }
      }
    }
    var poly = terms.reduce(function (acc, t) { return acc ? add(acc, t) : t; }, null) || num(0);
    poly = simplify(poly);
    return {
      coeffs: coeffs,
      poly: poly,
      polyText: toStr(poly),
      text: buildTaylorText(coeffs, v, x0)
    };
  }

  function buildEnv(v, x0, extra) {
    var env = Object.assign({}, extra || {});
    env[v] = x0;
    env.x = x0;
    return env;
  }

  function buildTaylorText(coeffs, v, x0) {
    var parts = [];
    coeffs.forEach(function (c, k) {
      if (Math.abs(c) < 1e-12) return;
      var cs = fmtNum(c);
      var body;
      if (k === 0) body = '';
      else if (k === 1) body = '(' + v + (x0 ? ' − ' + fmtNum(x0) : '') + ')';
      else body = '(' + v + (x0 ? ' − ' + fmtNum(x0) : '') + ')^' + k;
      parts.push((parts.length && c > 0 ? ' + ' : ' ') + (c < 0 ? '− ' : '') + Math.abs(c).toFixed(6).replace(/0+$/, '').replace(/\.$/, '') + '·' + (body || '1'));
    });
    return parts.join('').replace(/^\s*\+\s*/, '') || '0';
  }

  /* ------------------------------ 二项式 ------------------------------ */
  function binomialCoeffs(n) {
    var row = [];
    for (var k = 0; k <= n; k++) row.push(comb(n, k));
    return row;
  }

  function stripParens(s) {
    s = String(s).trim();
    if (s.length > 1 && s.charAt(0) === '(' && s.charAt(s.length - 1) === ')') {
      var depth = 0, ok = true;
      for (var i = 0; i < s.length; i++) {
        if (s.charAt(i) === '(') depth++;
        else if (s.charAt(i) === ')') { depth--; if (depth === 0 && i < s.length - 1) { ok = false; break; } }
      }
      if (ok) return s.slice(1, -1).trim();
    }
    return s;
  }

  /** 生成 (a + b)^n 的各项：返回 [{coef, aPow, bPow, text}] */
  function binomialTerms(aStr, bStr, n) {
    var row = binomialCoeffs(n), out = [];
    var A = stripParens(aStr), B = stripParens(bStr);
    function factor(base, k) {
      if (k === 0) return null;
      if (base === '1') return null;
      if (base === '0') return '0';
      return k === 1 ? base : base + '^' + k;
    }
    for (var k = 0; k <= n; k++) {
      var ap = n - k, bp = k;
      var parts = [];
      if (row[k] !== 1) parts.push(String(row[k]));
      var fa = factor(A, ap), fb = factor(B, bp);
      if (fa) parts.push(fa);
      if (fb) parts.push(fb);
      out.push({
        coef: row[k], aPow: ap, bPow: bp,
        text: parts.join('*') || '1'
      });
    }
    return out;
  }

  /* ------------------------------ 莱布尼茨 ------------------------------ */
  /** (u·v)^(n) = Σ C(n,k) u^(k) v^(n-k) */
  function leibnizTerms(uAst, vAst, uName, vName, n) {
    var out = [];
    for (var k = 0; k <= n; k++) {
      var du, dv;
      try { du = deriv(uAst, uName, k); } catch (e) { du = null; }
      try { dv = deriv(vAst, vName, n - k); } catch (e) { dv = null; }
      out.push({
        coef: comb(n, k),
        k: k,
        uText: du ? toStr(du) : '—',
        vText: dv ? toStr(dv) : '—',
        ok: !!(du && dv)
      });
    }
    return out;
  }

  /* ------------------------------ 数值微分 ------------------------------ */
  function numericDeriv(ast, v, x, order, h) {
    order = order || 1;
    if (!h) h = Math.pow(1e-3, 1 / Math.max(1, order)) * (1 + Math.abs(x));
    var sum = 0;
    for (var k = 0; k <= order; k++) {
      var env = buildEnv(v, x + (order / 2 - k) * h);
      var f = evalNode(ast, env);
      if (!isFinite(f)) return NaN;
      sum += ((k % 2) ? -1 : 1) * comb(order, k) * f;
    }
    return sum / Math.pow(h, order);
  }

  /* ------------------------------ 维尔斯特拉斯函数 ------------------------------ */
  /** f(x) = Σ_{k=0}^{N} a^k·cos(b^k·π·x) */
  function weierstrassExpr(a, b, N) {
    var terms = [];
    for (var k = 0; k <= N; k++) {
      var ak = Math.pow(a, k);
      var bk = Math.pow(b, k);
      terms.push(fmtNum(ak) + '*cos(' + fmtNum(bk) + '*pi*x)');
    }
    return terms.join(' + ');
  }

  /** 显示用美化：* -> ·，- -> −（仅用于界面展示，不能回喂解析器） */
  function pretty(str) {
    return String(str).replace(/\*/g, '·').replace(/-/g, '−');
  }

  global.Calc = {
    num: num, add: add, sub: sub, mul: mul, div: div, pow: pow, neg: neg,
    simplify: simplify, deriv: deriv, deriv1: deriv1, depends: depends,
    evalNode: evalNode, toStr: toStr, fmtNum: fmtNum,
    taylor: taylor, binomialCoeffs: binomialCoeffs, binomialTerms: binomialTerms,
    leibnizTerms: leibnizTerms, numericDeriv: numericDeriv,
    weierstrassExpr: weierstrassExpr, comb: comb, factorial: factorial, pretty: pretty
  };
})(window);
