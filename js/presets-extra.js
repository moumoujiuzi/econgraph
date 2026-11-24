/* ==========================================================================
   presets-extra.js — 宏观 / 金融 / 数学扩展模板（依赖 presets.js 的 PRESETS）
   ========================================================================== */
(function (global) {
  'use strict';
  var f = MathFn.fmt;
  var PRESETS = global.PRESETS;
  /* ======================= 新增：宏观 / 微观 / 金融 / 数学 ======================= */

  /* ---- IS-LM（隐函数） ---- */
  PRESETS.push({
    id: 'islm', name: 'IS–LM 模型', category: '经济学',
    xVar: 'Y', yVar: 'r',
    xLabel: '产出 Y', yLabel: '利率 r',
    title: 'IS–LM：产品市场与货币市场同时均衡',
    view: { xmin: 800, xmax: 1800, ymin: 0, ymax: 10 },
    params: [
      { name: 'G', label: '政府购买 G', min: 120, max: 320, step: 10, value: 200 },
      { name: 'M', label: '货币供给 M', min: 300, max: 800, step: 25, value: 500 }
    ],
    curves: [
      { type: 'implicit', expr: 'x - (100 + 0.75*(x - 100) + 200 - 25*y + G)', label: 'IS：Y = C + I + G', color: '#c0392b', width: 2.6 },
      { type: 'implicit', expr: '0.5*x - 50*y - M', label: 'LM：M = 0.5Y − 50r', color: '#1f4e79', width: 2.6 }
    ],
    annotations: function (p) {
      var r = (900 + 4 * p.G - 2 * p.M) / 200;
      var y = 2 * p.M + 100 * r;
      return [{
        x: y, y: r, color: '#111',
        label: '均衡 E\nY* = ' + f(y, 0) + '，r* = ' + f(r) + '%',
        dx: -14, dy: -30
      }];
    },
    note: 'IS：Y = C(Y−T) + I(r) + G，利率越低投资越多、产出越高，所以向下倾斜；' +
          'LM：M/P = L(Y, r)，收入越高货币需求越大、利率被推高，所以向上倾斜。' +
          '交点同时满足两个市场。G 上升整条 IS 右移（挤出效应），M 上升 LM 右移。'
  });

  /* ---- AD-AS ---- */
  PRESETS.push({
    id: 'adas', name: '总需求—总供给（AD–AS）', category: '经济学',
    xVar: 'Y',
    xLabel: '产出 Y', yLabel: '价格水平 P',
    title: 'AD–AS：短期均衡与长期垂直供给',
    view: { xmin: 0, xmax: 2200, ymin: 0, ymax: 130 },
    params: [
      { name: 'A', label: 'AD 截距', min: 90, max: 140, step: 5, value: 110 },
      { name: 'B', label: 'SRAS 截距', min: 10, max: 40, step: 2, value: 20 }
    ],
    curves: [
      { expr: 'A - 0.05*x', label: '总需求 AD', color: '#c0392b', width: 2.6 },
      { expr: 'B + 0.04*x', label: '短期总供给 SRAS', color: '#2e7d32', width: 2.6 },
      { type: 'implicit', expr: 'x - 1200', label: '长期总供给 LRAS（Y = 1200）', color: '#8e44ad', width: 1.8, dash: [7, 5] }
    ],
    annotations: function (p) {
      var y = (p.A - p.B) / 0.09;
      var price = p.A - 0.05 * y;
      return [{ x: y, y: price, color: '#111', label: '短期均衡\nY = ' + f(y, 0) + '，P = ' + f(price), dx: -14, dy: -34 }];
    },
    note: 'AD 向下：价格下降→实际货币余额上升→利率下降→投资上升。SRAS 向上：短期内价格上升刺激产出。' +
          '长期里价格可自由调整，产出回到自然率 Y=1200（LRAS 垂直），扩张 AD 只推高价格。'
  });

  /* ---- Solow ---- */
  PRESETS.push({
    id: 'solow', name: '索洛模型（稳态）', category: '经济学',
    xVar: 'k',
    xLabel: '人均资本 k', yLabel: '人均产出 / 投资',
    title: '索洛模型：投资曲线与折旧曲线的交点决定稳态',
    view: { xmin: 0, xmax: 20, ymin: 0, ymax: 1.4 },
    params: [
      { name: 's', label: '储蓄率 s', min: 0.1, max: 0.5, step: 0.02, value: 0.3 },
      { name: 'n', label: '人口增长 n', min: 0, max: 0.06, step: 0.005, value: 0.05 },
      { name: 'd', label: '折旧率 δ', min: 0.02, max: 0.12, step: 0.01, value: 0.05 }
    ],
    curves: [
      { expr: 's*sqrt(x)', label: '实际投资 s·f(k)', color: '#1f4e79', width: 2.6 },
      { expr: '(n + d)*x', label: '持平投资 (n+δ)k', color: '#c0392b', width: 2.4 }
    ],
    annotations: function (p) {
      var k = Math.pow(p.s / (p.n + p.d), 2);
      var y = p.s * Math.sqrt(k);
      return [{
        x: k, y: y, color: '#111',
        label: '稳态 k* = ' + f(k) + '\ny* = ' + f(y, 3),
        dx: -14, dy: -34
      }];
    },
    note: '稳态条件：s·f(k) = (n+δ)k。储蓄率上升把投资曲线上抬，稳态资本与产出都提高；' +
          '人口增长或折旧加快会让持平投资更陡，稳态资本下降。'
  });

  /* ---- 等产量线与等成本线 ---- */
  PRESETS.push({
    id: 'isoquant', name: '等产量线与等成本线', category: '经济学',
    xVar: 'L',
    xLabel: '劳动 L', yLabel: '资本 K',
    title: '成本最小化：等成本线与等产量线相切',
    view: { xmin: 0, xmax: 40, ymin: 0, ymax: 40 },
    params: [
      { name: 'w', label: '工资 w', min: 2, max: 12, step: 1, value: 5 },
      { name: 'r', label: '资本价格 r', min: 4, max: 20, step: 1, value: 10 },
      { name: 'C', label: '总成本 C', min: 100, max: 400, step: 10, value: 200 }
    ],
    curves: function (p) {
      return [
        { type: 'implicit', expr: 'x*y - 100', label: '等产量线 Q = 100', color: '#9aa5b1', width: 1.6, dash: [5, 4] },
        { type: 'implicit', expr: 'x*y - 200', label: '等产量线 Q = 200', color: '#c0392b', width: 2.6 },
        { type: 'implicit', expr: 'x*y - 300', label: '等产量线 Q = 300', color: '#9aa5b1', width: 1.6, dash: [5, 4] },
        { expr: '(' + p.C + ' - ' + p.w + '*x)/' + p.r, label: '等成本线 C = wL + rK', color: '#1f4e79', width: 2.4 }
      ];
    },
    annotations: function (p) {
      var L = Math.sqrt(200 * p.r / p.w);
      var K = 200 / L;
      return [{
        x: L, y: K, color: '#111',
        label: '成本最小组合\nL* = ' + f(L, 1) + '，K* = ' + f(K, 1),
        dx: 16, dy: -48
      }];
    },
    note: '等产量线 Q = L·K 是双曲线；等成本线斜率 −w/r。相切处 MRTS = w/r，' +
          '也就是给定产量下成本最低（或给定成本下产量最大）的要素组合。'
  });

  /* ---- 古诺寡头 ---- */
  PRESETS.push({
    id: 'cournot', name: '古诺双寡头反应函数', category: '经济学',
    xVar: 'q1',
    xLabel: '厂商 1 产量 q₁', yLabel: '厂商 2 产量 q₂',
    title: '古诺均衡：两条反应函数的交点',
    view: { xmin: 0, xmax: 60, ymin: 0, ymax: 60 },
    params: [
      { name: 'a', label: '市场反需求截距 a', min: 60, max: 140, step: 5, value: 100 },
      { name: 'c', label: '边际成本 c', min: 0, max: 40, step: 2, value: 10 }
    ],
    curves: [
      { expr: '(a - c)/2 - x/2', label: 'R₁：q₂ = (a−c)/2 − q₁/2', color: '#c0392b', width: 2.6 },
      { expr: '(a - c) - 2*x', label: 'R₂：q₂ = (a−c) − 2q₁', color: '#1f4e79', width: 2.6 }
    ],
    annotations: function (p) {
      var q = (p.a - p.c) / 3;
      return [{
        x: q, y: q, color: '#111',
        label: '古诺均衡\nq₁* = q₂* = ' + f(q, 1),
        dx: 14, dy: -32
      }];
    },
    note: '反应函数把“对手产量”映射成“我的最优产量”。交点即纳什均衡：给定对方产量，谁都不想单独改变。' +
          '把 a 调大或 c 调小，均衡产量整体上移。'
  });

  /* ---- 期权损益 ---- */
  PRESETS.push({
    id: 'option-payoff', name: '期权到期损益图', category: '金融',
    xVar: 'S',
    xLabel: '标的到期价格 S', yLabel: '损益',
    title: '期权损益：买入看涨 / 看跌 / 跨式',
    view: { xmin: 50, xmax: 150, ymin: -12, ymax: 45 },
    params: [
      { name: 'K', label: '行权价 K', min: 80, max: 120, step: 5, value: 100 },
      { name: 'P', label: '权利金', min: 1, max: 15, step: 1, value: 5 }
    ],
    curves: function (p) {
      return [
        { expr: 'max(x - ' + p.K + ', 0) - ' + p.P, label: '买入看涨（多头 Call）', color: '#c0392b', width: 2.6 },
        { expr: 'max(' + p.K + ' - x, 0) - ' + p.P, label: '买入看跌（多头 Put）', color: '#1f4e79', width: 2.6 },
        { expr: 'max(x - ' + p.K + ', 0) + max(' + p.K + ' - x, 0) - 2*' + p.P, label: '跨式组合（Straddle）', color: '#8e44ad', width: 2.2, dash: [6, 4] }
      ];
    },
    annotations: function (p) {
      return [
        { x: p.K, y: -p.P, color: '#666', label: 'K = ' + p.K, dx: 8, dy: 16, r: 3 }
      ];
    },
    note: '买入期权的最大损失就是权利金，收益上不封顶（看涨）。跨式组合在标的远离 K 时赚钱，' +
          '赌的是波动率而不是方向。'
  });

  /* ---- SML ---- */
  PRESETS.push({
    id: 'sml', name: '证券市场线 SML', category: '金融',
    xVar: 'beta',
    xLabel: '贝塔 β', yLabel: '预期收益率 E[R] %',
    title: 'CAPM：预期收益与系统性风险成正比',
    view: { xmin: 0, xmax: 2, ymin: 0, ymax: 16 },
    params: [
      { name: 'rf', label: '无风险利率 r_f', min: 0, max: 8, step: 0.5, value: 3 },
      { name: 'rm', label: '市场收益 E[R_m]', min: 4, max: 15, step: 0.5, value: 9 }
    ],
    curves: function (p) {
      return [{ expr: p.rf + ' + ' + (p.rm - p.rf) + '*x', label: 'SML：E[R] = r_f + β(E[R_m] − r_f)', color: '#1f4e79', width: 2.8 }];
    },
    annotations: function (p) {
      return [
        { x: 0, y: p.rf, color: '#2e7d32', label: '无风险资产 β=0', dx: 10, dy: 14, r: 4 },
        { x: 1, y: p.rm, color: '#c0392b', label: '市场组合 β=1', dx: 10, dy: -16, r: 4 }
      ];
    },
    note: '斜率就是市场风险溢价 E[R_m] − r_f。β 衡量系统性风险：β=1 与市场同步，β=1.5 要求更高补偿。' +
          '落在 SML 上方的资产被低估（同样的 β 给更高收益）。'
  });

  /* ---- 债券价格-收益率 ---- */
  PRESETS.push({
    id: 'bond', name: '债券价格—收益率曲线', category: '金融',
    xVar: 'y',
    xLabel: '到期收益率 y', yLabel: '债券价格',
    title: '10 年期 5% 息票债券：价格是收益率的凸函数',
    view: { xmin: 0, xmax: 0.15, ymin: 40, ymax: 150 },
    params: [],
    curves: [
      {
        expr: '5/(1+x) + 5/(1+x)^2 + 5/(1+x)^3 + 5/(1+x)^4 + 5/(1+x)^5 + 5/(1+x)^6 + 5/(1+x)^7 + 5/(1+x)^8 + 5/(1+x)^9 + 105/(1+x)^10',
        label: 'P(y)：每期 5 元息票 + 到期 100 元本金', color: '#1f4e79', width: 2.8
      },
      { expr: '100', label: '面值 100', color: '#9aa5b1', width: 1.4, dash: [6, 5] }
    ],
    annotations: function () {
      return [{ x: 0.05, y: 100, color: '#c0392b', label: '票面利率 = 收益率\n价格 = 面值', dx: 12, dy: -18 }];
    },
    note: '价格与收益率反向变动，且是凸函数：收益率下降带来的资本利得，大于同等幅度上升带来的损失。' +
          '这就是久期（一阶）与凸性（二阶）的来源。'
  });

  /* ---- 洛伦兹曲线 ---- */
  PRESETS.push({
    id: 'lorenz', name: '洛伦兹曲线与基尼系数', category: '经济学',
    xVar: 'p',
    xLabel: '人口累计占比', yLabel: '收入累计占比',
    title: '洛伦兹曲线：离 45° 线越远，分配越不均',
    view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
    params: [],
    curves: [
      { expr: 'x', label: '绝对平均线', color: '#9aa5b1', width: 1.6, dash: [7, 5] },
      { expr: 'x^2', label: '洛伦兹曲线 L(p) = p²（Gini = 1/3）', color: '#c0392b', width: 2.8 },
      { expr: 'x^3', label: '更不均：L(p) = p³（Gini = 1/2）', color: '#1f4e79', width: 2.2, dash: [6, 4] }
    ],
    annotations: [
      { x: 0.58, y: 0.16, dot: false, label: '基尼系数 = 1 − 2∫L(p)dp', dx: 12, dy: 0, labelColor: '#7b8794', guides: false }
    ],
    note: '横轴是“从最穷到最富累计的人口比例”，纵轴是“他们占有的收入比例”。' +
          'Gini = A/(A+B)，A 是 45° 线与洛伦兹曲线之间的面积。p² 对应 Gini=1/3，p³ 对应 1/2。'
  });

  /* ---- 傅里叶方波 ---- */
  PRESETS.push({
    id: 'fourier', name: '傅里叶级数逼近方波', category: '数学',
    xVar: 'x',
    xLabel: 'x', yLabel: 'y',
    title: '方波的傅里叶部分和：吉布斯现象',
    view: { xmin: -6.6, xmax: 6.6, ymin: -1.8, ymax: 1.8 },
    params: [],
    curves: [
      { expr: 'sin(x)', display: 'Σ(k=1…1) sin((2k−1)x)/(2k−1)', label: '1 项', color: '#9aa5b1', width: 1.4, dash: [5, 4] },
      { expr: 'sin(x) + sin(3*x)/3', display: 'Σ(k=1…2) sin((2k−1)x)/(2k−1)', label: '2 项', color: '#2e7d32', width: 1.8 },
      { expr: 'sin(x) + sin(3*x)/3 + sin(5*x)/5', display: 'Σ(k=1…3) sin((2k−1)x)/(2k−1)', label: '3 项', color: '#d68910', width: 1.8 },
      { expr: 'sin(x) + sin(3*x)/3 + sin(5*x)/5 + sin(7*x)/7 + sin(9*x)/9', display: 'Σ(k=1…5) sin((2k−1)x)/(2k−1)', label: '5 项', color: '#c0392b', width: 2.4 }
    ],
    annotations: [],
    note: '方波 = Σ sin((2k−1)x)/(2k−1)。项数越多越接近方波，但跳变处始终有约 9% 的过冲——' +
          '这就是吉布斯现象，增加项数不会消除它，只会让它变窄。'
  });


  /* ======================= 动态系统 ======================= */

  PRESETS.push({
    id: 'lotka', name: 'Lotka–Volterra 捕食者—猎物', category: '动态',
    xVar: 'x', yVar: 'y',
    xLabel: '猎物 x', yLabel: '捕食者 y',
    title: 'Lotka–Volterra：闭合轨道，中心型平衡点',
    view: { xmin: 0, xmax: 3, ymin: 0, ymax: 3 },
    field: { fx: 'x*(1 - y)', fy: 'y*(x - 1)' },
    seeds: [[0.4, 0.6], [1.7, 0.55], [0.55, 1.8], [2.3, 1.5]],
    params: [],
    curves: [
      { type: 'implicit', expr: 'x*(1 - y)', label: 'ẋ = 0：x = 0 或 y = 1', color: '#c0392b', width: 1.6, dash: [6, 4] },
      { type: 'implicit', expr: 'y*(x - 1)', label: 'ẏ = 0：y = 0 或 x = 1', color: '#2e7d32', width: 1.6, dash: [6, 4] }
    ],
    annotations: [],
    note: 'ẋ = x(1−y)，ẏ = y(x−1)。两条零斜线交点 (1,1) 是中心：轨道闭合、不收敛也不发散，' +
          '这正是“捕食者—猎物”循环的数学来源。点击画布任意位置可以再起一条轨线。'
  });

  PRESETS.push({
    id: 'sir', name: 'SIR 传染病模型', category: '动态',
    xVar: 'S', yVar: 'I',
    xLabel: '易感者 S', yLabel: '感染者 I',
    title: 'SIR：相平面上的疫情轨迹',
    view: { xmin: 0, xmax: 1, ymin: 0, ymax: 0.6 },
    field: { fx: '-0.35*x*y', fy: '0.35*x*y - 0.12*y' },
    seeds: [[0.99, 0.01], [0.9, 0.05], [0.75, 0.15]],
    params: [],
    curves: [
      { type: 'implicit', expr: '0.35*x*y', label: 'Ṡ = 0', color: '#c0392b', width: 1.5, dash: [6, 4] },
      { type: 'implicit', expr: '0.35*x*y - 0.12*y', label: 'İ = 0：I = 0 或 S = R₀⁻¹', color: '#2e7d32', width: 1.5, dash: [6, 4] }
    ],
    annotations: [],
    note: 'β = 0.35、γ = 0.12，基本再生数 R₀ = β/γ ≈ 2.9。轨迹从右下往左上走：' +
          '感染人数先升后降，最终停在 I = 0 的轴上。I 的峰值出现在 S = 1/R₀ ≈ 0.34 处。'
  });

  PRESETS.push({
    id: 'saddle', name: '鞍点：稳定与不稳定流形', category: '动态',
    xVar: 'x', yVar: 'y',
    xLabel: 'x', yLabel: 'y',
    title: 'ẋ = x，ẏ = −y：原点是不稳定鞍点',
    view: { xmin: -2, xmax: 2, ymin: -2, ymax: 2 },
    field: { fx: 'x', fy: '-y' },
    seeds: [[0.15, 0.15], [0.7, 0.12], [-0.5, 0.08], [0.1, -0.6], [-0.12, 0.9], [0.9, 0.5]],
    params: [],
    curves: [],
    annotations: [],
    note: '特征值 +1 与 −1：一条方向向外发散、另一条向内收敛，只有恰好落在稳定流形上的点才收敛到原点。' +
          '这就是“鞍点”的几何含义——宏观里常见的“鞍点路径”（saddle path）就是它的稳定流形。'
  });

  PRESETS.push({
    id: 'spiral', name: '稳定焦点：阻尼振荡', category: '动态',
    xVar: 'x', yVar: 'y',
    xLabel: 'x', yLabel: 'y',
    title: 'ẋ = −0.3x − y，ẏ = x − 0.3y：稳定焦点',
    view: { xmin: -3, xmax: 3, ymin: -3, ymax: 3 },
    field: { fx: '-0.3*x - y', fy: 'x - 0.3*y' },
    seeds: [[2, 0], [0, 2.2], [-1.8, -1.2], [1.2, 2.4]],
    params: [],
    curves: [],
    annotations: [],
    note: '特征值 −0.3 ± i：实部为负所以收敛，虚部不为零所以旋转。轨迹螺旋进入原点，' +
          '对应宏观里“二阶线性系统”的阻尼周期。把实部改成正数就会变成发散的外旋。'
  });

  PRESETS.push({
    id: 'islm-dyn', name: 'IS–LM 调整动态', category: '动态',
    xVar: 'Y', yVar: 'r',
    xLabel: '产出 Y', yLabel: '利率 r',
    title: 'IS–LM 的连续调整：Ŷ = α(AD − Y)，ṙ = β(L − M)',
    view: { xmin: 800, xmax: 1800, ymin: 0, ymax: 10 },
    field: {
      fx: '0.5*((100 + 0.75*(x - 100) + 200 - 25*y + G) - x)',
      fy: '0.05*((0.5*x - 50*y) - M)'
    },
    seeds: [[1000, 8], [1600, 8.5], [1500, 1.5], [900, 2]],
    params: [
      { name: 'G', label: '政府购买 G', min: 120, max: 320, step: 10, value: 200 },
      { name: 'M', label: '货币供给 M', min: 300, max: 800, step: 25, value: 500 }
    ],
    curves: [
      { type: 'implicit', expr: 'x - (100 + 0.75*(x - 100) + 200 - 25*y + G)', label: 'IS（Ẏ = 0）', color: '#c0392b', width: 1.8, dash: [6, 4] },
      { type: 'implicit', expr: '0.5*x - 50*y - M', label: 'LM（ṙ = 0）', color: '#1f4e79', width: 1.8, dash: [6, 4] }
    ],
    annotations: [],
    note: '把 IS-LM 从“比较静态”变成“动态”：产出按 AD−Y 调整，利率按货币缺口调整。' +
          '轨线从任意初值出发都会收敛到 (1350, 3.5%)——它是稳定结点。调 G 或 M 看均衡怎么移动。'
  });

  /* ---- 级数工坊空白画布 ---- */
  PRESETS.push({
    id: 'series', name: '级数工坊（空白）', category: '数学',
    xVar: 'x', xLabel: 'x', yLabel: 'y',
    title: '级数逐项累加',
    view: { xmin: -6.6, xmax: 6.6, ymin: -2.2, ymax: 2.2 },
    params: [],
    curves: [],
    annotations: [
      { x: -6.0, y: 1.9, dot: false, guides: false, dx: 0, dy: 0, labelColor: '#8a97a5',
        label: '点击右上角「∑ 级数工坊」→ 输入通项 → 点 +1 项' }
    ],
    note: '配合「∑ 级数工坊」使用：输入通项（含 n），点 +1 项看部分和一步步逼近目标函数。' +
          '默认的 sin(n*x)/n 累加会收敛到锯齿波，方波请用 sin((2n-1)*x)/(2n-1)。'
  });

  /* ---- 嵌套根式空白画布 ---- */
  PRESETS.push({
    id: 'radical', name: '嵌套根式（空白）', category: '数学',
    xVar: 'x', xLabel: 'x', yLabel: 'y',
    title: '无穷嵌套根式',
    view: { xmin: 0, xmax: 10, ymin: 0, ymax: 4 },
    params: [],
    curves: [],
    annotations: [
      { x: 0.4, y: 3.5, dot: false, guides: false, dx: 0, dy: 0, labelColor: '#8a97a5',
        label: '∑ 级数工坊 → 嵌套根式 → 点 +1 层' }
    ],
    note: '经典例子：√(2+√(2+√(2+…))) 收敛到 2；把外层写成 sqrt(x + R) 就得到函数 (1+√(1+4x))/2；' +
          '拉马努金 √(1+2√(1+3√(…))) = 3。模板里 R 是下一层，k 是层号。'
  });

  global.PRESETS = PRESETS;

})(window);


