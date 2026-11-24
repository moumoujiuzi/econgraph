/* ==========================================================================
   mathfn.js — 一个极小的数学表达式解析器
   支持：数字、变量、+ - * / ^ %、括号、逗号、常用函数、隐式乘法
   例：  "200 + 0.8Y"      -> 200 + 0.8*Y
         "120 - 2*P"       -> 线性需求
         "a + b*x - 3*sin(x)" 
   用法： const c = MathFn.compile("a + b*Y");
          c.vars -> ['a','b','Y']
          c.eval({a:200, b:0.8, Y:100}) -> 280
   ========================================================================== */
(function (global) {
  'use strict';

  var FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp,
    ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2,
    floor: Math.floor, ceil: Math.ceil, round: Math.round,
    sign: Math.sign, trunc: Math.trunc
  };
  var FUNC_ARITY = { min: 2, max: 2, pow: 2, atan2: 2 };

  var CONSTS = { pi: Math.PI, PI: Math.PI, e: Math.E, E: Math.E, Infinity: Infinity, inf: Infinity, INF: Infinity };

  var RE_NUM = /^(?:\d+\.?\d*|\.\d+)/;
  var RE_ID = /^[A-Za-z_\u4e00-\u9fa5][A-Za-z0-9_\u4e00-\u9fa5]*/;

  function tokenize(src) {
    var s = String(src).replace(/\s+/g, '');
    var out = [], i = 0;
    while (i < s.length) {
      var ch = s[i];
      if (/[0-9.]/.test(ch)) {
        var m = s.slice(i).match(RE_NUM);
        if (!m) throw new Error('数字格式错误：' + s.slice(i, i + 8));
        out.push({ t: 'num', v: parseFloat(m[0]) });
        i += m[0].length;
      } else if (/[A-Za-z_\u4e00-\u9fa5]/.test(ch)) {
        var m2 = s.slice(i).match(RE_ID);
        out.push({ t: 'id', v: m2[0] });
        i += m2[0].length;
      } else if ('+-*/^%(),'.indexOf(ch) >= 0) {
        out.push({ t: 'op', v: ch });
        i += 1;
      } else {
        throw new Error('无法识别的字符：' + ch);
      }
    }
    return out;
  }

  function parse(src) {
    var toks = tokenize(src), pos = 0;

    function peek() { return toks[pos]; }
    function next() { return toks[pos++]; }
    function isOp(v) { var t = peek(); return t && t.t === 'op' && t.v === v; }
    function expect(v) {
      if (!isOp(v)) throw new Error('缺少 “' + v + '”');
      pos++;
    }

    function parseExpr() {
      var node = parseTerm();
      while (isOp('+') || isOp('-')) {
        var op = next().v;
        node = { k: 'bin', op: op, a: node, b: parseTerm() };
      }
      return node;
    }

    function parseTerm() {
      var node = parseUnary();
      for (;;) {
        if (isOp('*') || isOp('/') || isOp('%')) {
          var op = next().v;
          node = { k: 'bin', op: op, a: node, b: parseUnary() };
        } else if (startsPrimary()) {
          // 隐式乘法：2Y / 3(x+1) / x y
          node = { k: 'bin', op: '*', a: node, b: parseUnary() };
        } else break;
      }
      return node;
    }

    function startsPrimary() {
      var t = peek();
      if (!t) return false;
      if (t.t === 'num' || t.t === 'id') return true;
      if (t.t === 'op' && t.v === '(') return true;
      return false;
    }

    function parseUnary() {
      if (isOp('-')) { next(); return { k: 'neg', a: parseUnary() }; }
      if (isOp('+')) { next(); return parseUnary(); }
      return parsePower();
    }

    function parsePower() {
      var base = parsePrimary();
      if (isOp('^')) {
        next();
        return { k: 'bin', op: '^', a: base, b: parseUnary() }; // 右结合
      }
      return base;
    }

    function parsePrimary() {
      var t = peek();
      if (!t) throw new Error('表达式不完整');
      if (t.t === 'num') { next(); return { k: 'num', v: t.v }; }
      if (t.t === 'id') {
        next();
        var name = t.v;
        if (isOp('(')) {
          next();
          var args = [];
          if (!isOp(')')) {
            args.push(parseExpr());
            while (isOp(',')) { next(); args.push(parseExpr()); }
          }
          expect(')');
          if (!(name in FUNCS) && !(name in FUNC_ARITY)) {
            throw new Error('未知函数：' + name);
          }
          return { k: 'call', name: name, args: args };
        }
        if (name in CONSTS) return { k: 'num', v: CONSTS[name] };
        return { k: 'var', name: name };
      }
      if (t.t === 'op' && t.v === '(') {
        next();
        var e = parseExpr();
        expect(')');
        return e;
      }
      throw new Error('无法解析：' + t.v);
    }

    var ast = parseExpr();
    if (pos < toks.length) throw new Error('多余的内容：' + toks[pos].v);
    return ast;
  }

  function evalAst(n, env) {
    switch (n.k) {
      case 'num': return n.v;
      case 'var':
        if (Object.prototype.hasOwnProperty.call(env, n.name)) return env[n.name];
        throw new Error('未定义的变量：' + n.name);
      case 'neg': return -evalAst(n.a, env);
      case 'bin': {
        var a = evalAst(n.a, env), b = evalAst(n.b, env);
        switch (n.op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return a / b;
          case '%': return a % b;
          case '^': return Math.pow(a, b);
        }
        throw new Error('未知运算符');
      }
      case 'call': {
        var args = n.args.map(function (x) { return evalAst(x, env); });
        if (n.name === 'min') return Math.min.apply(null, args);
        if (n.name === 'max') return Math.max.apply(null, args);
        if (n.name === 'pow') return Math.pow(args[0], args[1]);
        var f = FUNCS[n.name];
        if (!f) throw new Error('未知函数：' + n.name);
        return f.apply(null, args);
      }
    }
    throw new Error('无效节点');
  }

  function collectVars(n, set) {
    if (!n) return set;
    if (n.k === 'var') set[n.name] = true;
    if (n.k === 'bin') { collectVars(n.a, set); collectVars(n.b, set); }
    if (n.k === 'neg') collectVars(n.a, set);
    if (n.k === 'call') n.args.forEach(function (a) { collectVars(a, set); });
    return set;
  }

  /** 去掉 “C = ...” 这种左侧，返回右侧表达式 */
  function rhs(src) {
    var s = String(src || '').trim();
    var m = s.match(/^[A-Za-z_\u4e00-\u9fa5][A-Za-z0-9_\u4e00-\u9fa5]*\s*=\s*([\s\S]+)$/);
    return m ? m[1] : s;
  }

  function compile(src) {
    var body = rhs(src);
    if (global.Normalize) body = global.Normalize.math(body);
    if (!body) throw new Error('表达式为空');
    var ast = parse(body);
    var vset = collectVars(ast, {});
    var vars = Object.keys(vset);
    return {
      src: src,
      body: body,
      vars: vars,
      eval: function (env) {
        var v = evalAst(ast, env);
        return (typeof v === 'number' && isFinite(v)) ? v : NaN;
      }
    };
  }

  /** 数值格式化：给坐标轴/标签用 */
  function fmt(v, digits) {
    if (!isFinite(v)) return '—';
    var a = Math.abs(v);
    if (a !== 0 && (a >= 1e6 || a < 1e-3)) return v.toExponential(1);
    var d = (digits == null) ? (a >= 100 ? 0 : a >= 10 ? 1 : 2) : digits;
    var s = v.toFixed(d);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s === '-0' ? '0' : s;
  }

  global.MathFn = {
    compile: compile,
    parse: parse,
    fmt: fmt,
    rhs: rhs,
    FUNCS: FUNCS
  };
})(window);
