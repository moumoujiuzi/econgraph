/* ==========================================================================
   normalize.js — 输入规范化
   把中文/全角/数学符号转成解析器能吃的 ASCII：
     五分之三   → (3)/(5)
     x的十次方  → x^(10)
     x的平方    → x^2
     根号x      → sqrt(x)
     x² + π     → x^2 + pi
     ∞          → Infinity
     全角 ＋ － × ÷ ＝ → 半角 + - * / =
   纯函数，可在 Node 里测试
   ========================================================================== */
(function (global) {
  'use strict';

  var CN = { '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  var UNIT = { '十': 10, '百': 100, '千': 1000, '万': 10000, '亿': 100000000 };
  var CN_CHARS = '零〇一二两三四五六七八九十百千万亿';

  /** 中文数字 → 数字；失败返回 null */
  function cnToNumber(s) {
    s = String(s).trim();
    if (!s) return null;
    if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);

    // 小数：三点一四
    if (s.indexOf('点') >= 0) {
      var parts = s.split('点');
      var ip = cnToNumber(parts[0]);
      var dp = '';
      for (var i = 0; i < parts[1].length; i++) {
        var d = CN[parts[1][i]];
        if (d == null) return null;
        dp += d;
      }
      if (ip == null) return null;
      return parseFloat(ip + '.' + (dp || '0'));
    }

    var total = 0, section = 0, num = 0, ok = false;
    for (var k = 0; k < s.length; k++) {
      var ch = s[k];
      if (ch in CN) { num = CN[ch]; ok = true; continue; }
      if (ch in UNIT) {
        ok = true;
        var u = UNIT[ch];
        if (u >= 10000) { total = (total + section + num) * u; section = 0; num = 0; }
        else { section += (num || 1) * u; num = 0; }
        continue;
      }
      return null;
    }
    if (!ok) return null;
    return total + section + num;
  }

  /** 全角 → 半角 */
  function toHalfWidth(s) {
    return s.replace(/[\uFF01-\uFF5E]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    }).replace(/\u3000/g, ' ');
  }

  /** e^(...) → exp(...)，支持任意层嵌套括号 */
  function expify(s) {
    var out = '', i = 0;
    while (i < s.length) {
      var idx = s.indexOf('e^(', i);
      if (idx < 0) { out += s.slice(i); break; }
      if (idx > 0 && /[A-Za-z0-9_]/.test(s.charAt(idx - 1))) {
        out += s.slice(i, idx + 3);
        i = idx + 3;
        continue;
      }
      var depth = 0, j = idx + 2;
      for (; j < s.length; j++) {
        if (s.charAt(j) === '(') depth++;
        else if (s.charAt(j) === ')') { depth--; if (depth === 0) break; }
      }
      if (j >= s.length) { out += s.slice(i); break; }
      out += s.slice(i, idx) + 'exp(' + s.slice(idx + 3, j) + ')';
      i = j + 1;
    }
    return out;
  }

  function math(input) {
    var s = String(input == null ? '' : input);
    if (!s) return '';

    s = toHalfWidth(s);

    // 1) 中文分数：五分之三 → (3)/(5)；x分之1 → (1)/(x)
    s = s.replace(/([零〇一二两三四五六七八九十百千万亿\d.]+)分之([零〇一二两三四五六七八九十百千万亿\d.]+)/g,
      function (m0, a, b) {
        var na = cnToNumber(a), nb = cnToNumber(b);
        if (na == null || nb == null) return m0;
        return '(' + nb + ')/(' + na + ')';
      });
    // 复合分母/分子：3x分之1 → (1)/(3x)；x的3x分之一 也走这里
    var FR = '(?:[0-9a-zA-Z_.^]+(?:\\*[0-9a-zA-Z_.^]+)*|[零〇一二两三四五六七八九十百千万亿]+)';
    s = s.replace(new RegExp('(' + FR + ')分之(' + FR + ')', 'g'), function (m0, a, b) {
      var na = cnToNumber(a); if (na != null) a = String(na);
      var nb = cnToNumber(b); if (nb != null) b = String(nb);
      return '(' + b + ')/(' + a + ')';
    });
    s = s.replace(/([a-zA-Z]\w*)分之(\d+(?:\.\d+)?)/g, '($2)/($1)');
    s = s.replace(/(\d+(?:\.\d+)?)分之([a-zA-Z]\w*)/g, '($2)/($1)');

    // 2) 幂：底数和指数都允许是复合式
    //    x的十次方 / x的n次方 / e的x分之一次方 / (1)/(2)的x次方
    var TERM = '(?:\\([^()]*\\)|[A-Za-z]\\w*|\\d+(?:\\.\\d+)?)';
    var COMPOUND = '(' + TERM + '(?:[*/]' + TERM + ')*)';
    var POWER = new RegExp(COMPOUND + '的([^的]+?)次(?:方|幂)', 'g');
    s = s.replace(POWER, function (m0, base, p) {
      var np = cnToNumber(p);
      var exp = (np == null) ? p : String(np);
      var needParen = /[+\-*/]/.test(base) && !/^\([^()]*\)$/.test(base);
      return (needParen ? '(' + base + ')' : base) + '^(' + exp + ')';
    });

    // 3) 平方 / 立方
    s = s.replace(/([a-zA-Z]\w*|\([^()]*\)|[\d.]+)的?平方/g, '$1^2');
    s = s.replace(/([a-zA-Z]\w*|\([^()]*\)|[\d.]+)的?立方/g, '$1^3');

    // 4) e 的 x 次方 → exp(x)（含嵌套括号）
    s = expify(s);

    // 4) 根号 / 绝对值
    s = s.replace(/根号\s*(\([^()]*\)|[a-zA-Z]\w*|\d+(?:\.\d+)?)/g, 'sqrt($1)');
    s = s.replace(/绝对值/g, 'abs');
    s = s.replace(/绝对值\(/g, 'abs(');

    // 5) 运算符与「的」
    s = s.replace(/乘以|乘|×|·|∙/g, '*');
    s = s.replace(/除以|除|÷/g, '/');
    s = s.replace(/加上|加/g, '+');
    s = s.replace(/减去|减/g, '-');
    s = s.replace(/等于|＝|=/g, '=');
    s = s.replace(/的/g, '*');

    // 6) 符号
    s = s.replace(/[−–—]/g, '-');
    s = s.replace(/√/g, 'sqrt');
    s = s.replace(/π/g, 'pi');
    s = s.replace(/θ/g, 'theta');
    s = s.replace(/∞|无穷大|无穷/g, 'Infinity');
    s = s.replace(/[²]/g, '^2').replace(/[³]/g, '^3').replace(/[⁴]/g, '^4');
    s = s.replace(/[⁵]/g, '^5').replace(/[⁶]/g, '^6').replace(/[⁷]/g, '^7');
    s = s.replace(/[⁸]/g, '^8').replace(/[⁹]/g, '^9').replace(/[ⁿ]/g, '^n');
    s = s.replace(/½/g, '(1/2)').replace(/⅓/g, '(1/3)').replace(/¼/g, '(1/4)');

    // 7) 中文数字整体替换（剩余独立的）
    s = s.replace(/[零〇一二两三四五六七八九十百千万亿]+/g, function (m0) {
      var n = cnToNumber(m0);
      return n == null ? m0 : String(n);
    });

    // 8) 函数名 + 空格 + 单变量：sin x → sin(x)
    s = s.replace(/\b(sin|cos|tan|asin|acos|atan|ln|log|log2|sqrt|exp|abs|sinh|cosh|tanh)\s+([a-zA-Z]\w*|\d+(?:\.\d+)?)/g,
      '$1($2)');

    // 9) 函数名紧贴变量/数字：sinx → sin(x)，sin2 → sin(2)
    s = s.replace(/\b(asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|ln|log2|log|sqrt|exp|abs)([a-zA-Z]|\d+(?:\.\d+)?)/g,
      function (m0, fn, arg) { return fn + '(' + arg + ')'; });

    // 9.5) 再来一次分数/幂（处理嵌套括号里的残留）
    s = s.replace(/([a-zA-Z]\w*)分之(\d+(?:\.\d+)?)/g, '($2)/($1)');
    s = s.replace(/(\d+(?:\.\d+)?)分之([a-zA-Z]\w*)/g, '($2)/($1)');

    // 10) 清理多余空格与连续符号
    s = s.replace(/\s+/g, '');
    s = s.replace(/\*\*/g, '*');
    return s;
  }

  global.Normalize = { math: math, cnToNumber: cnToNumber, toHalfWidth: toHalfWidth };
})(typeof window !== 'undefined' ? window : globalThis);
