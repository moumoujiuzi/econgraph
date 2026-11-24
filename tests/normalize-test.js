/* 输入规范化测试 */
'use strict';
global.window = global;
require('../js/normalize.js');
const N = global.Normalize;

let pass = 0, fail = 0;
const fails = [];
function eq(name, got, want) {
  if (got === want) pass++; else { fail++; fails.push(`${name}  got=${got}  want=${want}`); }
}

/* 中文数字 */
eq('十', N.cnToNumber('十'), 10);
eq('十二', N.cnToNumber('十二'), 12);
eq('二十三', N.cnToNumber('二十三'), 23);
eq('一百零五', N.cnToNumber('一百零五'), 105);
eq('三点一四', N.cnToNumber('三点一四'), 3.14);
eq('非数字', N.cnToNumber('abc'), null);

/* 分数 */
eq('五分之三', N.math('五分之三'), '(3)/(5)');
eq('二分之一加三分之一', N.math('二分之一加三分之一'), '(1)/(2)+(1)/(3)');
eq('x分之1', N.math('x分之1'), '(1)/(x)');

/* 幂 */
eq('x的十次方', N.math('x的十次方'), 'x^(10)');
eq('x的平方', N.math('x的平方'), 'x^2');
eq('x²', N.math('x²'), 'x^2');
eq('(x+1)的立方', N.math('(x+1)的立方'), '(x+1)^3');

/* 根号 / 函数 */
eq('根号x', N.math('根号x'), 'sqrt(x)');
eq('根号(x+1)', N.math('根号(x+1)'), 'sqrt((x+1))');
eq('sin x', N.math('sin x'), 'sin(x)');

/* 全角与符号 */
eq('全角 ３＋４', N.math('３＋４'), '3+4');
eq('π', N.math('π'), 'pi');
eq('∞', N.math('∞'), 'Infinity');
eq('无穷大', N.math('无穷大'), 'Infinity');
eq('x乘以2', N.math('x乘以2'), 'x*2');

/* 组合 */
eq('三x加二', N.math('三x加二'), '3x+2');
eq('保留 ASCII', N.math('2*x^2 - 3'), '2*x^2-3');

/* 复合幂：底数/指数都可能带括号或分式 */
eq('e的x分之一次方', N.math('e的x分之一次方'), 'exp((1)/(x))');
eq('e乘(二分之一的x次方)', N.math('e乘（二分之一的x次方）'), 'e*(((1)/(2))^(x))');
eq('x的n次方', N.math('x的n次方'), 'x^(n)');
eq('复合表达式', N.math('3的x次方加e的（x分之一）次方'), '3^(x)+exp(((1)/(x)))');

console.log(`pass=${pass} fail=${fail}`);
fails.forEach(f => console.log('FAIL ' + f));
process.exit(fail ? 1 : 0);
