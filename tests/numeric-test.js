/* 数值工具单元测试 */
'use strict';
global.window = global;
require('../js/numeric.js');
const Num = global.Num;

let pass = 0, fail = 0;
const fails = [];
function eq(name, got, want, tol) {
  tol = tol == null ? 1e-6 : tol;
  const ok = (typeof want === 'number') ? Math.abs(got - want) <= tol : got === want;
  if (ok) pass++; else { fail++; fails.push(`${name} got=${got} want=${want}`); }
}

const f = x => x * x - 2;
eq('二分求根 √2', Num.bisect(f, 0, 3), Math.SQRT2, 1e-6);
eq('扫描求根 x²-1', Num.findRoots(x => x * x - 1, -3, 3, 2000).length, 2);
eq('求根值', Math.abs(Num.findRoots(x => x * x - 1, -3, 3, 2000)[0] + 1) < 1e-5, true);
eq('无根', Num.findRoots(x => x * x + 1, -3, 3, 2000).length, 0);

eq('辛普森 ∫x² 0..1', Num.simpson(x => x * x, 0, 1, 200), 1 / 3, 1e-9);
eq('辛普森 ∫sin 0..π', Num.simpson(Math.sin, 0, Math.PI, 400), 2, 1e-6);

eq('黎曼中点 ∫x 0..1', Num.riemann(x => x, 0, 1, 100, 'mid').sum, 0.5, 1e-9);
eq('黎曼左端 ∫x 0..1', Num.riemann(x => x, 0, 1, 100, 'left').sum, 0.495, 1e-9);
eq('黎曼右端 ∫x 0..1', Num.riemann(x => x, 0, 1, 100, 'right').sum, 0.505, 1e-9);

eq('数值求导 x² @3', Num.derivative(x => x * x, 3), 6, 1e-4);
const tl = Num.tangentLine(x => x * x, 2);
eq('切线斜率', tl.k, 4, 1e-4);
eq('切线截距', tl.b, -4, 1e-3);

const cb = Num.cobweb(x => 2.5 * x * (1 - x), 0.2, 5);
eq('蛛网点数', cb.length, 12);
eq('蛛网起点', cb[0][0], 0.2);

eq('迭代不动点 0.5x+0.5', Num.iterate(x => 0.5 * x + 0.5, 0, 40).pop(), 1, 1e-6);

const reg = Num.ols([1, 2, 3, 4], [2, 4, 6, 8]);
eq('OLS 斜率', reg.b, 2, 1e-9);
eq('OLS 截距', reg.a, 0, 1e-9);
eq('OLS R²', reg.r2, 1, 1e-9);
const reg2 = Num.ols([1, 2, 3], [1, 2, 4]);
eq('OLS 残差存在', reg2.r2 < 1, true);

const csv = Num.parseCSV('x,y\n1,2\n2,4.1\n3,5.9\n');
eq('CSV 解析行数', csv.data.length, 3);
eq('CSV 首行 y', csv.data[0].y, 2);
eq('CSV 跳过表头', csv.skipped, 1);

console.log(`pass=${pass} fail=${fail}`);
fails.forEach(f => console.log('FAIL ' + f));
process.exit(fail ? 1 : 0);
