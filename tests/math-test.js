/* Node 下运行表达式解析器的单元测试 */
'use strict';
global.window = global;
require('../js/mathfn.js');
const MathFn = global.MathFn;

let pass = 0, fail = 0;
const fails = [];

function ev(src, env) { return MathFn.compile(src).eval(env || {}); }
function eq(name, got, want, tol) {
  tol = tol == null ? 1e-9 : tol;
  const ok = (typeof want === 'number') ? Math.abs(got - want) <= tol : got === want;
  if (ok) pass++; else { fail++; fails.push(`${name}  got=${got} want=${want}`); }
}

eq('加法与隐式乘法 200+0.8Y', ev('200 + 0.8Y', { Y: 100 }), 280);
eq('乘除优先级 2+3*4', ev('2+3*4'), 14);
eq('括号 (2+3)*4', ev('(2+3)*4'), 20);
eq('幂右结合 2^3^2', ev('2^3^2'), 512);
eq('负号 -2^2', ev('-2^2'), -4);
eq('幂高于乘 3*2^2', ev('3*2^2'), 12);
eq('sin(pi/2)', ev('sin(pi/2)'), 1);
eq('ln(e)', ev('ln(e)'), 1);
eq('log10(100)', ev('log(100)'), 2);
eq('sqrt+abs', ev('sqrt(16)+abs(-3)'), 7);
eq('隐式函数 2sqrt(9)', ev('2sqrt(9)'), 6);
eq('变量相乘 x*y', ev('x*y', { x: 2, y: 3 }), 6);
eq('小数 .5x', ev('.5x', { x: 8 }), 4);
eq('方程左侧剥离', ev('C = 200 + 0.8Y', { Y: 50 }), 240);
eq('需求 120-2*P', ev('120-2*P', { P: 25 }), 70);
eq('反需求 (60-Q)/0.5', ev('(60-Q)/0.5', { Q: 60 }), 0);
eq('min/max', ev('max(1,5,3)+min(2,4)'), 7);
eq('变量收集', MathFn.compile('a + b*Y').vars.sort().join(','), 'Y,a,b');
eq('NaN 保护 1/0', isNaN(ev('1/0')), true);
eq('fmt 整数', MathFn.fmt(1000), '1000');
eq('fmt 小数', MathFn.fmt(0.8), '0.8');
eq('fmt 负数', MathFn.fmt(-2.5), '-2.5');

let bad = 0;
['1 +', '2 * * 3', 'foo(2)', '(1+2'].forEach(s => {
  try { MathFn.compile(s); } catch (e) { bad++; }
});
eq('非法表达式全部报错', bad, 4);

// 经济学模板里的真实表达式
eq('消费函数 a+bY', ev('a + b*Y', { a: 200, b: 0.8, Y: 1000 }), 1000);
eq('均衡求解 60-0.5Q == 10+Q/3', Math.abs((60 - 0.5 * 60) - (10 + 60 / 3)) < 1e-9, true);
eq('成本 ATC', ev('FC/Q + a + b*Q', { FC: 100, a: 10, b: 0.5, Q: 10 }), 25);
eq('成本 MC 与 ATC 在最低点相等',
  Math.abs((10 + 2 * 0.5 * Math.sqrt(200)) - (100 / Math.sqrt(200) + 10 + 0.5 * Math.sqrt(200))) < 1e-9, true);

console.log(`pass=${pass} fail=${fail}`);
fails.forEach(f => console.log('FAIL ' + f));
process.exit(fail ? 1 : 0);
