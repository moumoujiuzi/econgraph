/* ==========================================================================
   presets.js — 模板库
   每个模板描述：坐标轴、视图范围、曲线、参数、关键点标注、填色区域、说明
   曲线/标注/填色都可以写成函数 (params) => 值，随滑杆实时重算
   ========================================================================== */
(function (global) {
  'use strict';
  var f = MathFn.fmt;

  var PRESETS = [

    /* ---------------------------- 1. 消费函数 ---------------------------- */
    {
      id: 'consumption',
      name: '消费函数（凯恩斯 45° 线）',
      xVar: 'Y',
      xLabel: '可支配收入 Y',
      yLabel: '消费 C',
      title: '凯恩斯消费函数：C = a + bY',
      view: { xmin: 0, xmax: 2000, ymin: 0, ymax: 2000 },
      params: [
        { name: 'a', label: '自主消费 a', min: 0, max: 600, step: 10, value: 200 },
        { name: 'b', label: '边际消费倾向 MPC = b', min: 0.1, max: 0.95, step: 0.01, value: 0.8 }
      ],
      curves: [
        { expr: 'a + b*Y', label: '消费函数 C = a + bY', color: '#1f4e79', width: 2.8 },
        { expr: 'Y', label: '45° 线（C = Y）', color: '#8c8c8c', width: 1.6, dash: [7, 5] }
      ],
      annotations: function (p) {
        var be = p.a / (1 - p.b);
        return [{
          x: be, y: be, color: '#b03a2e',
          label: '收支相抵点\nY* = ' + f(be, 0) + '，此时 C = Y',
          dx: -14, dy: -26
        }];
      },
      shades: function (p) {
        return [{
          type: 'between', curve: 'a + b*Y', line: 0, from: 0, to: p.a / (1 - p.b),
          color: 'rgba(31,78,121,0.07)', label: '负储蓄区', lx: p.a / (2 * (1 - p.b)), ly: p.a * 0.25
        }];
      },
      note: 'C = a + bY：a 是收入为零时也要发生的消费，b 是每多 1 元收入带来的消费增量（0<b<1）。' +
            '45° 线代表“收入全部用于消费”，两条线的交点就是收支相抵点；交点左侧 C>Y（负储蓄），右侧 C<Y（正储蓄）。'
    },

    /* --------------------------- 2. 需求与供给 --------------------------- */
    {
      id: 'demand-supply',
      name: '需求—供给与市场均衡',
      xVar: 'Q',
      xLabel: '数量 Q',
      yLabel: '价格 P',
      title: '需求、供给与市场均衡',
      view: { xmin: 0, xmax: 140, ymin: 0, ymax: 70 },
      params: [
        { name: 'A', label: '需求截距（P 轴）', min: 40, max: 90, step: 2, value: 60 },
        { name: 'B0', label: '供给截距（P 轴）', min: 0, max: 30, step: 2, value: 10 }
      ],
      curves: [
        { expr: 'A - 0.5*Q', label: '需求 D：P = A − 0.5Q', color: '#c0392b', width: 2.6 },
        { expr: 'B0 + Q/3', label: '供给 S：P = B0 + Q/3', color: '#2e7d32', width: 2.6 }
      ],
      annotations: function (p) {
        var q = (p.A - p.B0) / (0.5 + 1 / 3);
        var price = p.A - 0.5 * q;
        return [{
          x: q, y: price, color: '#111',
          label: '均衡点 E\nP* = ' + f(price) + '，Q* = ' + f(q, 1),
          dx: 10, dy: -42
        }];
      },
      shades: function (p) {
        var q = (p.A - p.B0) / (0.5 + 1 / 3);
        var price = p.A - 0.5 * q;
        return [
          {
            type: 'between', curve: 'A - 0.5*Q', line: price, from: 0, to: q,
            color: 'rgba(192,57,43,0.10)', label: '消费者剩余', lx: q * 0.45, ly: price + (p.A - price) * 0.33
          },
          {
            type: 'between', curve: 'B0 + Q/3', line: price, from: 0, to: q,
            color: 'rgba(46,125,50,0.10)', label: '生产者剩余', lx: q * 0.45, ly: price - (price - p.B0) * 0.33
          }
        ];
      },
      note: '需求曲线向右下（价格越低、需求量越大），供给曲线向右上。交点 E 是市场均衡：' +
            '价格高于 P* 会出现过剩，低于 P* 会出现短缺。曲线上方到价格线之间的面积是消费者剩余，下方是生产者剩余。'
    },

    /* ----------------------------- 3. 价格上限 ----------------------------- */
    {
      id: 'price-ceiling',
      name: '价格上限与短缺',
      xVar: 'Q',
      xLabel: '数量 Q',
      yLabel: '价格 P',
      title: '价格上限（P_c < P*）造成短缺',
      view: { xmin: 0, xmax: 140, ymin: 0, ymax: 70 },
      params: [
        { name: 'A', label: '需求截距（P 轴）', min: 40, max: 90, step: 2, value: 60 },
        { name: 'B0', label: '供给截距（P 轴）', min: 0, max: 30, step: 2, value: 10 },
        { name: 'Pc', label: '管制价格 P_c', min: 5, max: 55, step: 1, value: 20 }
      ],
      curves: [
        { expr: 'A - 0.5*Q', label: '需求 D', color: '#c0392b', width: 2.6 },
        { expr: 'B0 + Q/3', label: '供给 S', color: '#2e7d32', width: 2.6 },
        { expr: 'Pc', label: '价格上限 P_c', color: '#8e44ad', width: 1.8, dash: [6, 4] }
      ],
      annotations: function (p) {
        var qd = (p.A - p.Pc) / 0.5;
        var qs = (p.Pc - p.B0) * 3;
        var list = [{
          x: qd, y: p.Pc, color: '#c0392b', label: 'Qd = ' + f(qd, 1), dx: 10, dy: -16, r: 3.5
        }, {
          x: qs, y: p.Pc, color: '#2e7d32', label: 'Qs = ' + f(qs, 1), dx: -10, dy: -16, r: 3.5
        }];
        if (qs < qd) {
          list.push({
            x: (qs + qd) / 2, y: p.Pc * 0.45, color: '#b03a2e', dot: false, guides: false,
            label: '短缺 ' + f(qd - qs, 1), dx: 0, dy: 0, bold: true, labelColor: '#b03a2e'
          });
        }
        return list;
      },
      shades: function (p) {
        var qd = (p.A - p.Pc) / 0.5;
        var qs = (p.Pc - p.B0) * 3;
        if (qs >= qd) return [];
        return [{
          type: 'vstrip', x1: qs, x2: qd, y1: 0, y2: p.Pc,
          color: 'rgba(176,58,46,0.13)', label: '', lx: 0, ly: 0
        }];
      },
      note: '当政府把价格压在均衡价以下，需求量大于供给量，缺口就是“短缺”。' +
            '把 P_c 拖到 P* 以上，缺口会变成“过剩”（此时相当于价格下限）。'
    },

    /* -------------------------- 4. 无差异曲线 -------------------------- */
    {
      id: 'indifference',
      name: '无差异曲线与预算约束',
      xVar: 'X',
      xLabel: '商品 X 的数量',
      yLabel: '商品 Y 的数量',
      title: '消费者最优：预算线与无差异曲线相切',
      view: { xmin: 0, xmax: 60, ymin: 0, ymax: 26 },
      params: [
        { name: 'I', label: '收入 I', min: 40, max: 200, step: 10, value: 100 },
        { name: 'Px', label: 'X 的价格 Px', min: 1, max: 6, step: 0.5, value: 2 },
        { name: 'Py', label: 'Y 的价格 Py', min: 1, max: 10, step: 0.5, value: 5 }
      ],
      curves: function (p) {
        var k = (p.I * p.I) / (4 * p.Px * p.Py);
        return [
          { expr: '(' + p.I + ' - ' + p.Px + '*X)/' + p.Py, label: '预算线：Px·X + Py·Y = I', color: '#1f4e79', width: 2.4 },
          { expr: (k * 0.60) + '/X', label: '无差异曲线 U₁（较低效用）', color: '#9aa5b1', width: 1.6, dash: [5, 4] },
          { expr: k + '/X', label: '无差异曲线 U₂（最优）', color: '#c0392b', width: 2.6 },
          { expr: (k * 1.45) + '/X', label: '无差异曲线 U₃（无法实现）', color: '#9aa5b1', width: 1.6, dash: [5, 4] }
        ];
      },
      annotations: function (p) {
        var x = p.I / (2 * p.Px), y = p.I / (2 * p.Py);
        return [{
          x: x, y: y, color: '#111',
          label: '最优组合\nX* = ' + f(x, 1) + '，Y* = ' + f(y, 1),
          dx: 12, dy: -38
        }];
      },
      note: '预算线斜率是 −Px/Py，无差异曲线斜率是边际替代率 MRS。' +
            '相切处 MRS = Px/Py，就是效用最大化的消费组合。收入或价格一变，切点随之移动。'
    },

    /* ---------------------------- 5. 成本曲线 ---------------------------- */
    {
      id: 'cost',
      name: '短期成本曲线（MC / ATC / AVC）',
      xVar: 'Q',
      xLabel: '产量 Q',
      yLabel: '成本',
      title: '边际成本穿过平均总成本的最低点',
      view: { xmin: 0, xmax: 40, ymin: 0, ymax: 70 },
      params: [
        { name: 'FC', label: '固定成本 FC', min: 20, max: 200, step: 10, value: 100 },
        { name: 'a', label: '单位可变成本 a', min: 2, max: 20, step: 1, value: 10 },
        { name: 'b', label: '边际成本斜率 b', min: 0.1, max: 1.5, step: 0.1, value: 0.5 }
      ],
      curves: [
        { expr: 'FC/Q + a + b*Q', label: '平均总成本 ATC', color: '#1f4e79', width: 2.6 },
        { expr: 'a + b*Q', label: '平均可变成本 AVC', color: '#2e7d32', width: 2.2 },
        { expr: 'a + 2*b*Q', label: '边际成本 MC', color: '#c0392b', width: 2.4 }
      ],
      annotations: function (p) {
        var q = Math.sqrt(p.FC / p.b);
        var atc = p.a + 2 * Math.sqrt(p.FC * p.b);
        return [{
          x: q, y: atc, color: '#111',
          label: '有效规模\nQ = ' + f(q, 1) + '，ATC 最低 ' + f(atc),
          dx: -14, dy: -34
        }];
      },
      note: 'MC 从 ATC 最低点穿过：MC < ATC 时 ATC 下降，MC > ATC 时 ATC 上升。' +
            '固定成本只影响 ATC，不改变 MC；这也是“利润最大化时 P = MC”的几何来源。'
    },

    /* ---------------------------- 6. 自由绘制 ---------------------------- */
    {
      id: 'free',
      name: '自由绘制（任意函数）',
      xVar: 'x',
      xLabel: 'x',
      yLabel: 'y',
      title: '自定义函数',
      view: { xmin: -8, xmax: 8, ymin: -6, ymax: 10 },
      params: [],
      curves: [
        { expr: 'x^2', label: 'y = x²', color: '#1f4e79', width: 2.4 }
      ],
      annotations: [],
      note: '直接改左边曲线里的表达式即可，例如：2*x^2 - 3*sin(x) + a*ln(x)。' +
            '表达式里出现的字母（如 a）会自动变成可拖动的参数滑杆。'
    }
  ];

  /* -------------------------- 7. 维尔斯特拉斯 -------------------------- */
  PRESETS.push({
    id: 'weierstrass',
    name: '维尔斯特拉斯病态函数',
    xVar: 'x',
    xLabel: 'x',
    yLabel: 'W(x)',
    title: '维尔斯特拉斯函数：处处连续、处处不可导',
    view: { xmin: -2, xmax: 2, ymin: -2.1, ymax: 2.1 },
    params: [
      { name: 'a', label: '振幅衰减 a（0<a<1）', min: 0.1, max: 0.9, step: 0.05, value: 0.5 },
      { name: 'b', label: '频率倍增 b（奇整数）', min: 3, max: 15, step: 2, value: 3 },
      { name: 'N', label: '求和项数 N', min: 0, max: 12, step: 1, value: 6 }
    ],
    curves: function (p) {
      var S = (1 - Math.pow(p.a, Math.round(p.N) + 1)) / (1 - p.a);   // Σ a^k 的解析上界
      return [{
        expr: Calc.weierstrassExpr(p.a, p.b, Math.round(p.N)),
        display: 'Σ(k=0…N) a^k · cos(b^k · π · x)',
        label: 'W(x) = Σ aᵏ·cos(bᵏπx)',
        color: '#1f4e79', width: 1.5
      }, {
        expr: f(S, 4),
        label: '解析振幅上界 ±' + f(S, 3) + '（曲线不会越出）',
        color: '#95a5a6', width: 1, dash: [5, 5], visible: true
      }, {
        expr: '-' + f(S, 4),
        label: '解析振幅下界',
        noLegend: true,
        color: '#95a5a6', width: 1, dash: [5, 5], visible: true
      }];
    },
    annotations: [],
    note: 'W(x) = Σ_{k=0}^{N} aᵏ·cos(bᵏ·π·x)。当 0<a<1、b 为奇数且 ab>1+3π/2 时，' +
          '这个函数处处连续却处处不可导——放大任何一段，锯齿都还在。' +
          '把 N 调大看它越来越"毛"，再把 a 调大看它越来越"抖"。'
  });

  /* --------------------------- 8. 高次多项式 --------------------------- */
  PRESETS.push({
    id: 'polynomial-high',
    name: '高次多项式与其导数',
    xVar: 'x',
    xLabel: 'x',
    yLabel: 'y',
    title: '十次多项式与它的导数',
    view: { xmin: -3, xmax: 3, ymin: -6, ymax: 8 },
    params: [
      { name: 'a', label: '首项系数 a', min: -0.02, max: 0.02, step: 0.001, value: 0.01 }
    ],
    curves: [
      { expr: 'a*x^10 - 0.3*x^8 + 2*x^6 - 3*x^4 + 2*x^2', label: 'f(x) 十次多项式', color: '#1f4e79', width: 2.6 },
      { expr: '10*a*x^9 - 2.4*x^7 + 12*x^5 - 12*x^3 + 4*x', label: "f'(x) 九次导数", color: '#c0392b', width: 1.8, dash: [6, 4] }
    ],
    annotations: [],
    note: '高次多项式在端点会剧烈震荡（这是数值分析里的 Runge 现象），' +
          '首项系数 a 决定两端是向上还是向下。试试点「数学工具 → 高阶导数」再求二阶、三阶导。'
  });

  /* ---------------------------- 9. 高阶导数 ---------------------------- */
  PRESETS.push({
    id: 'derivatives',
    name: '高阶导数链（sin 的四阶）',
    xVar: 'x',
    xLabel: 'x',
    yLabel: 'y',
    title: 'sin x 的 0–3 阶导数：每求一次导，相位前进 90°',
    view: { xmin: -6.6, xmax: 6.6, ymin: -2, ymax: 2 },
    params: [],
    curves: [
      { expr: 'sin(x)', label: 'f = sin x', color: '#1f4e79', width: 2.6 },
      { expr: 'cos(x)', label: "f' = cos x", color: '#c0392b', width: 2.0 },
      { expr: '-sin(x)', label: "f'' = −sin x", color: '#2e7d32', width: 2.0, dash: [7, 4] },
      { expr: '-cos(x)', label: "f''' = −cos x", color: '#8e44ad', width: 2.0, dash: [3, 3] }
    ],
    annotations: [],
    note: 'sin 的四阶导回到自身，所以它的泰勒级数只含奇次项、无限长。' +
          '把四条线的相位对齐看：每求一次导，曲线整体左移 π/2。'
  });

  /* ---------------------------- 10. 泰勒展开 ---------------------------- */
  PRESETS.push({
    id: 'taylor',
    name: '泰勒展开逼近 sin x',
    xVar: 'x',
    xLabel: 'x',
    yLabel: 'y',
    title: 'sin x 与它在 0 点的 1/3/5/7 阶泰勒多项式',
    view: { xmin: -7, xmax: 7, ymin: -3, ymax: 3 },
    params: [],
    curves: [
      { expr: 'sin(x)', label: 'sin x', color: '#111', width: 2.8 },
      { expr: 'x', display: 'Σ(k=0…1) f⁽ᵏ⁾(0)/k! · x^k', label: 'P₁ = x', color: '#9aa5b1', width: 1.6 },
      { expr: 'x - x^3/6', display: 'Σ(k=0…3) f⁽ᵏ⁾(0)/k! · x^k', label: 'P₃ = x − x³/6', color: '#2e7d32', width: 1.8 },
      { expr: 'x - x^3/6 + x^5/120', display: 'Σ(k=0…5) f⁽ᵏ⁾(0)/k! · x^k', label: 'P₅ = x − x³/6 + x⁵/120', color: '#d68910', width: 1.8 },
      { expr: 'x - x^3/6 + x^5/120 - x^7/5040', display: 'Σ(k=0…7) f⁽ᵏ⁾(0)/k! · x^k', label: 'P₇', color: '#c0392b', width: 2.0 }
    ],
    annotations: [],
    note: '阶数越高，在原点附近贴合越久，但一离开收敛半径误差就爆炸——' +
          '在「数学工具 → 泰勒展开」里换成 e^x、ln(1+x)，或把展开点从 0 挪到 2 看看差别。'
  });

  global.PRESETS = PRESETS;
})(window);
