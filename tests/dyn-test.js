/* 动力系统内核单元测试 */
'use strict';
global.window = global;
require('../js/dynsys.js');
const Dyn = global.Dyn;

let pass = 0, fail = 0;
const fails = [];
function eq(name, got, want, tol) {
  tol = tol == null ? 1e-6 : tol;
  const ok = (typeof want === 'number') ? Math.abs(got - want) <= tol : got === want;
  if (ok) pass++; else { fail++; fails.push(`${name} got=${got} want=${want}`); }
}

/* ---- RK4：x'=x, y'=-y 从 (1,1) 出发 ---- */
const p = Dyn.rk4((x, y) => x, (x, y) => -y, 1, 1, 1, 0.01);
const last = p[p.length - 1];
eq('RK4 指数增长 x(1)=e', last[0], Math.E, 1e-3);
eq('RK4 指数衰减 y(1)=1/e', last[1], 1 / Math.E, 1e-3);
eq('RK4 点数', p.length > 90, true);

/* ---- 雅可比 ---- */
const J = Dyn.jacobian((x, y) => x * x + y, (x, y) => x - 2 * y, 1, 2);
eq('J a = 2x', J.a, 2, 1e-4);
eq('J b = 1', J.b, 1, 1e-4);
eq('J c = 1', J.c, 1, 1e-4);
eq('J d = -2', J.d, -2, 1e-4);

/* ---- 特征值 ---- */
const evSaddle = Dyn.eigen2x2({ a: 1, b: 0, c: 0, d: -1 });
eq('鞍点 λ1', evSaddle.l1.re, 1, 1e-9);
eq('鞍点 λ2', evSaddle.l2.re, -1, 1e-9);
eq('鞍点分类', Dyn.classify(evSaddle).type, '鞍点');

const evStable = Dyn.eigen2x2({ a: -1, b: 0, c: 0, d: -2 });
eq('稳定结点', Dyn.classify(evStable).type, '稳定结点');

const evFocus = Dyn.eigen2x2({ a: -0.3, b: -1, c: 1, d: -0.3 });
eq('稳定焦点', Dyn.classify(evFocus).type, '稳定焦点');

const evCenter = Dyn.eigen2x2({ a: 0, b: -1, c: 1, d: 0 });
eq('中心', Dyn.classify(evCenter).type, '中心');

/* ---- 平衡点 ---- */
const lv = Dyn.analyze((x, y) => x * (1 - y), (x, y) => y * (x - 1),
  { xmin: 0, xmax: 3, ymin: 0, ymax: 3 }, 10);
const lvEq = lv.filter(e => Math.abs(e.x - 1) < 1e-3 && Math.abs(e.y - 1) < 1e-3)[0];
eq('LV 存在 (1,1)', !!lvEq, true);
eq('LV 平衡点类型 = 中心', lvEq.type, '中心');

const linear = Dyn.analyze((x, y) => x, (x, y) => -y,
  { xmin: -2, xmax: 2, ymin: -2, ymax: 2 }, 8);
const origin = linear.filter(e => Math.abs(e.x) < 1e-6 && Math.abs(e.y) < 1e-6)[0];
eq('线性鞍点存在', !!origin, true);
eq('线性鞍点分类', origin.type, '鞍点');

/* ---- 向量场 ---- */
const f = Dyn.field((x, y) => x, (x, y) => -y, { xmin: -1, xmax: 1, ymin: -1, ymax: 1 }, 4, 4);
eq('向量场点数', f.length, 25);
eq('向量场幅值 at (1,1)', Math.abs(f.filter(q => Math.abs(q.x - 1) < 1e-9 && Math.abs(q.y - 1) < 1e-9)[0].mag - Math.SQRT2) < 1e-9, true);

/* ---- IS-LM 调整动态应当收敛 ---- */
const alpha = 0.5, beta = 0.2, G = 200, M = 500;
const fx = (Y, r) => alpha * ((100 + 0.75 * (Y - 100) + 200 - 25 * r + G) - Y);
const fy = (Y, r) => beta * ((0.5 * Y - 50 * r) - M);
const islm = Dyn.analyze(fx, fy, { xmin: 800, xmax: 1800, ymin: 0, ymax: 10 }, 10);
const eqp = islm.filter(e => Math.abs(e.x - 1350) < 1 && Math.abs(e.y - 3.5) < 0.1)[0];
eq('IS-LM 均衡存在', !!eqp, true);
eq('IS-LM 均衡稳定', eqp.stable, true);

console.log(`pass=${pass} fail=${fail}`);
fails.forEach(f => console.log('FAIL ' + f));
process.exit(fail ? 1 : 0);
