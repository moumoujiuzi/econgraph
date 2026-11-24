/* 符号计算层单元测试（Node 运行） */
'use strict';
global.window = global;
require('../js/mathfn.js');
require('../js/calculus.js');
const MathFn = global.MathFn;
const Calc = global.Calc;

let pass = 0, fail = 0;
const fails = [];
function eq(name, got, want, tol) {
  tol = tol == null ? 1e-9 : tol;
  const ok = (typeof want === 'number') ? Math.abs(got - want) <= tol : got === want;
  if (ok) pass++; else { fail++; fails.push(`${name}  got=${got}  want=${want}`); }
}
function ast(s) { return MathFn.parse(s); }
function d(s, v, n) { return Calc.toStr(Calc.deriv(ast(s), v, n === undefined ? 1 : n)); }
function val(s, env) { return Calc.evalNode(ast(s), env); }

/* ---- 求导 ---- */
eq('d/dx x^2', d('x^2', 'x'), '2*x');
eq('d/dx x^3', d('x^3', 'x'), '3*x^2');
eq('d/dx sin', d('sin(x)', 'x'), 'cos(x)');
eq('d/dx cos', d('cos(x)', 'x'), '-sin(x)');
eq('d/dx exp', d('exp(x)', 'x'), 'exp(x)');
eq('d/dx ln', d('ln(x)', 'x'), '1/x');
eq('d/dx sqrt', d('sqrt(x)', 'x'), '1/(2*sqrt(x))');
eq('d/dx 常数', d('200 + 0.8*Y', 'Y'), '0.8');
eq('d/dx 线性', d('60 - 0.5*Q', 'Q'), '-0.5');
eq('乘积法则 d(x·sin)', d('x*sin(x)', 'x'), 'sin(x) + x*cos(x)');
eq('商法则 d(x/(1+x))', d('x/(1+x)', 'x'), '(1 + x - x)/(1 + x)^2');
eq('链式 d(sin(x^2))', d('sin(x^2)', 'x'), 'cos(x^2)*(2*x)');
eq('二阶导 sin', d('sin(x)', 'x', 2), '-sin(x)');
eq('三阶导 x^4', d('x^4', 'x', 3), '24*x');
eq('四阶导 x^4', d('x^4', 'x', 4), '24');

/* ---- 求值一致性 ---- */
eq('求值 d(x^2) 在 3', val(d('x^2', 'x'), { x: 3 }), 6);
eq('求值 d(sin) 在 0', val(d('sin(x)', 'x'), { x: 0 }), 1);
eq('简化 0*x', Calc.toStr(Calc.simplify(ast('0*x'))), '0');
eq('简化 x*1', Calc.toStr(Calc.simplify(ast('x*1'))), 'x');
eq('简化 x^0', Calc.toStr(Calc.simplify(ast('x^0'))), '1');

/* ---- 泰勒 ---- */
const t = Calc.taylor(ast('sin(x)'), 'x', 0, 5);
eq('泰勒 sin 系数 c1', t.coeffs[1], 1);
eq('泰勒 sin 系数 c3', t.coeffs[3], -1 / 6);
eq('泰勒 sin 系数 c5', t.coeffs[5], 1 / 120);
eq('泰勒 sin 在 0.5 近似', Calc.evalNode(t.poly, { x: 0.5 }), Math.sin(0.5), 1e-4);
const t2 = Calc.taylor(ast('exp(x)'), 'x', 1, 3);
eq('泰勒 e^x 在 1 处 c0', t2.coeffs[0], Math.E, 1e-9);

/* ---- 二项式 ---- */
eq('帕斯卡第 5 行', Calc.binomialCoeffs(5).join(','), '1,5,10,10,5,1');
eq('(a+b)^3 展开项数', Calc.binomialTerms('a', 'b', 3).length, 4);
eq('(a+b)^3 第二项', Calc.binomialTerms('a', 'b', 3)[1].text, '3*a^2*b');

/* ---- 莱布尼茨 ---- */
const lz = Calc.leibnizTerms(ast('x^2'), ast('exp(x)'), 'x', 'x', 2);
eq('莱布尼茨项数', lz.length, 3);
eq('莱布尼茨首项系数', lz[0].coef, 1);
eq('莱布尼茨末项系数', lz[lz.length - 1].coef, 1);
const lzSum = Calc.toStr(Calc.add(Calc.add(
  Calc.mul(Calc.num(1), Calc.mul(ast('x^2'), ast('exp(x)'))),
  Calc.mul(Calc.num(2), Calc.mul(Calc.deriv(ast('x^2'), 'x', 1), Calc.deriv(ast('exp(x)'), 'x', 1)))),
  Calc.mul(Calc.num(1), Calc.mul(Calc.deriv(ast('x^2'), 'x', 2), ast('exp(x)')))));
eq('莱布尼茨展开可求值', val(lzSum, { x: 2 }),
   Math.exp(2) * (4 + 8 + 2), 1e-9);

/* ---- 数值微分 ---- */
eq('数值一阶导 sin at 0', Calc.numericDeriv(ast('sin(x)'), 'x', 0, 1), 1, 1e-4);
eq('数值二阶导 x^3 at 2', Calc.numericDeriv(ast('x^3'), 'x', 2, 2), 12, 1e-3);

/* ---- 维尔斯特拉斯 ---- */
const w = Calc.weierstrassExpr(0.5, 3, 3);
eq('维尔斯特拉斯项数', (w.match(/cos/g) || []).length, 4);
eq('维尔斯特拉斯 0 点求和', val(w, { x: 0 }), 0.5 ** 0 + 0.5 + 0.25 + 0.125, 1e-9);

/* ---- 高阶多项式 ---- */
eq('20 次多项式求值', val('x^20 - 2*x^10 + 1', { x: 1 }), 0);
eq('20 次多项式导数', val(d('x^20', 'x'), { x: 2 }), 20 * Math.pow(2, 19), 1e-3);

eq('0 阶导 = 原函数', d('x^2', 'x', 0), 'x^2');
eq('(1+x)^5 展开首项', Calc.binomialTerms('1', 'x', 5)[0].text, '1');
eq('(1+x)^5 展开第二项', Calc.binomialTerms('1', 'x', 5)[1].text, '5*x');
eq('(1+x)^5 展开末项', Calc.binomialTerms('1', 'x', 5)[5].text, 'x^5');

console.log(`pass=${pass} fail=${fail}`);
fails.forEach(f => console.log('FAIL ' + f));
process.exit(fail ? 1 : 0);



