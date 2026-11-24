/* ==========================================================================
   app.js — 界面逻辑：模板、曲线、参数、视图、数学/数值工具、导出
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var plot = null;
  var state = null;
  var presetDef = null;
  var paramDefs = [];
  var cfg = {};
  var lab = { deriv: null, taylor: null, binom: null, leibniz: null };
  var axisEdgePref = false;
  var equalAspectPref = false;

  var CATS = ['自由', '数学', '动态', '经济学', '金融'];
  var MATH_IDS = ['weierstrass', 'polynomial-high', 'derivatives', 'taylor', 'fourier'];

  /* ------------------------------ 启动 ------------------------------ */
  function init() {
    cfg = readConfig();
    if (cfg && cfg.export) document.body.classList.add('export-mode');

    buildPresetSelect();
    $('presetSelect').addEventListener('change', function (e) { applyPreset(e.target.value); });
    $('addCurve').addEventListener('click', function () { addCurve({}); });
    $('exportPng').addEventListener('click', doExport);
    $('exportTikz').addEventListener('click', doExportTikz);
    $('snapshot').addEventListener('click', toggleSnapshot);
    $('resetAll').addEventListener('click', function () { applyPreset(state.presetId); });
    $('fitView').addEventListener('click', fitView);

    var zr = $('zoomRange');
    if (zr) {
      zr.addEventListener('input', function () { setZoom(parseFloat(zr.value)); });
    }
    var zrst = $('zoomReset');
    if (zrst) {
      zrst.addEventListener('click', function () { setZoom(100, true); });
    }

    ['vxmin', 'vxmax', 'vymin', 'vymax'].forEach(function (id) {
      if (!$(id)) return;
      $(id).addEventListener('change', function () {
        var v = state.view;
        v.xmin = parseFloat($('vxmin').value);
        v.xmax = parseFloat($('vxmax').value);
        v.ymin = parseFloat($('vymin').value);
        v.ymax = parseFloat($('vymax').value);
        if (!(v.xmax > v.xmin)) v.xmax = v.xmin + 1;
        if (!(v.ymax > v.ymin)) v.ymax = v.ymin + 1;
        plot.render();
      });
    });

    plot = new Plot($('plot'), $('overlay'), $('tooltip'));
    plot.onViewChange = function (v) { state.view = v; applyAspect(); updateViewInputs(); };
    plot.onClick = function (x, y) {
      if (!presetDef || !presetDef.field) return;
      var fns = fieldFns(presetDef, state.params);
      var pts = Dyn.rk4(fns.fx, fns.fy, x, y, presetDef.T || 40, presetDef.h || 0.02);
      if (pts.length < 3) return;
      state.userPaths.push({ pts: pts, color: 'rgba(192,57,43,0.85)', width: 1.7 });
      plot.setState(state);
    };

    if (window.ResizeObserver) {
      new ResizeObserver(function () { plot.resize(); }).observe($('canvasWrap'));
    } else {
      window.addEventListener('resize', function () { plot.resize(); applyAspect(); plot.render(); });
    }

    initLab();
    var uiBridge = {
      state: function () { return state; },
      curveOptions: function () {
        var out = [];
        state.curves.forEach(function (c, i) {
          if ((c.type || 'explicit') === 'explicit') out.push({ index: i, label: c.label || c.expr, expr: c.expr });
        });
        return out;
      },
      addCurve: function (spec) { addCurve(spec); },
      addShade: function (sh) { state.addedShades.push(sh); refreshChart(); },
      addPoints: function (pts) { state.points = state.points.concat(pts); plot.setState(state); },
      setOverlay: function (list) { state.overlay = list || []; plot.setState(state); },
      clearOverlay: function () { state.overlay = []; plot.setState(state); },
      addPath: function (pts, opts) {
        state.paths.push({ pts: pts, color: (opts && opts.color) || '#8e44ad', width: (opts && opts.width) || 1.8 });
        plot.setState(state);
      },
      refresh: function () { refreshChart(); },
      cmdCurve: function (spec) {
        var idx = -1;
        state.curves.forEach(function (c, i) { if (c.cmd) idx = i; });
        // 自由绘制模式下，第一条命令直接替换默认示例曲线
        if (idx < 0 && state.presetId === 'free' && state.curves.length === 1 && !state.curves[0].cmd) idx = 0;
        var item = {
          type: spec.type || 'explicit',
          expr: spec.expr, expr2: spec.expr2 || '',
          label: spec.label || spec.expr,
          color: spec.color || '#c0392b',
          width: spec.width || 2.4,
          dash: spec.dash || null,
          visible: true, cmd: true
        };
        if (idx >= 0) state.curves[idx] = item; else state.curves.push(item);
        syncAutoParams();
        rebuildCurveList();
        rebuildParams();
        refreshChart();
      },
      liveDraw: function (spec) {
        // 自动切到「自定义函数」画布，并且只保留用户输入的这一条
        if (state.presetId !== 'free') applyPreset('free');
        state.curves = [];
        state.overlay = [];
        state.curves.push({
          type: spec.type || 'explicit',
          expr: spec.expr,
          expr2: spec.expr2 || '',
          label: spec.label || spec.expr,
          color: spec.color || '#c0392b',
          width: spec.width || 2.6,
          dash: null,
          visible: true,
          cmd: true
        });
        syncAutoParams();
        rebuildCurveList();
        rebuildParams();
        refreshChart();
      },
      cmdCurveSet: function (list) {
        state.curves = state.curves.filter(function (c) { return !c.cmd; });
        (list || []).slice(0, 6).forEach(function (spec) {
          state.curves.push({
            type: spec.type || 'explicit',
            expr: spec.expr, expr2: spec.expr2 || '',
            label: spec.label || spec.expr,
            color: spec.color || '#c0392b',
            width: spec.width || 2.4,
            dash: spec.dash || null,
            visible: true, cmd: true
          });
        });
        syncAutoParams();
        rebuildCurveList();
        rebuildParams();
        refreshChart();
      },
      currentExpr: function () {
        if (!state) return null;
        for (var i = 0; i < state.curves.length; i++) {
          var c = state.curves[i];
          if (c.visible === false) continue;
          if ((c.type || 'explicit') !== 'explicit') continue;
          return String(c.expr || '');
        }
        return null;
      },
      setView: function (xmin, xmax, ymin, ymax) {
        if (!(xmax > xmin) || !(ymax > ymin)) return;
        state.view = { xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax };
        state.baseView = Object.assign({}, state.view);
        updateViewInputs();
        plot.render();
      },
      fitValue: function (v) {
        var s = state.view;
        var lo = Math.min(0, v), hi = Math.max(0, v);
        var span = hi - lo;
        var pad = span > 0 ? span * 0.3 : Math.max(1, Math.abs(v) * 0.3);
        s.ymin = lo - pad;
        s.ymax = hi + pad;
        if (state.baseView) state.baseView = Object.assign({}, s);
        updateViewInputs();
        plot.render();
      },
      showExpr: function (html) {
        var el = document.getElementById('exprText');
        var bar = document.getElementById('exprBar');
        if (!el || !bar) return;
        el.innerHTML = html;
        bar.classList.remove('hidden');
      },
      hideExpr: function () {
        var bar = document.getElementById('exprBar');
        if (bar) bar.classList.add('hidden');
      },
      cmdClear: function () {
        state.curves = state.curves.filter(function (c) { return !c.cmd; });
        syncAutoParams();
        rebuildCurveList();
        rebuildParams();
        refreshChart();
      },
      ensureBlank: function (seriesView) {
        if (state.presetId !== 'free') return;
        if (state.curves.length === 1 && !state.curves[0].cmd) {
          if (seriesView) {
            applyPreset('series');
          } else {
            state.curves = [];
            rebuildCurveList();
            refreshChart();
          }
        }
      },
      applyPreset: function (id) {
        var hit = PRESETS.some(function (p) { return p.id === id; });
        if (!hit) return false;
        applyPreset(id);
        return true;
      }
    };

    Tools.init(uiBridge);
    if (window.SeriesLab) window.SeriesLab.init(uiBridge);
    if (window.CmdBar) window.CmdBar.init(uiBridge);

    var wanted = (cfg.preset && PRESETS.some(function (p) { return p.id === cfg.preset; }))
      ? cfg.preset : 'free';
    applyPreset(wanted);
    applyOverrides(cfg);

    var edgeBox = $('axisEdge');
    var eqBox = $('axisEqual');
    if (eqBox) {
      eqBox.checked = !!state.equalAspect;
      eqBox.addEventListener('change', function () {
        equalAspectPref = eqBox.checked;
        state.equalAspect = equalAspectPref;
        applyAspect();
        plot.render();
      });
    }

    if (edgeBox) {
      edgeBox.checked = !!state.axisAtEdge;
      edgeBox.addEventListener('change', function () {
        axisEdgePref = edgeBox.checked;
        state.axisAtEdge = axisEdgePref;
        plot.render();
      });
    }

    signalReady();

    if (cfg && cfg.lab && window.SeriesLab) {
      setTimeout(function () {
        window.SeriesLab.open();
        var t = document.querySelector('#seriesTabs .tab[data-stab="' + cfg.lab + '"]');
        if (t) t.click();
      }, 600);
    }
    if (cfg && cfg.selftest) setTimeout(runSelfTest, 700);
    if (cfg && cfg.tools && window.Tools) setTimeout(function () { window.Tools.open(); }, 500);
    if (cfg && cfg.aspect) {
      equalAspectPref = true;
      state.equalAspect = true;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { applyAspect(); plot.render(); });
      });
    }
    if (cfg && cfg.zoom) {
      setZoom(parseFloat(cfg.zoom), true);
    }
    if (cfg && cfg.typed && window.CmdBar && window.CmdBar.simulate) {
      window.CmdBar.simulate(cfg.typed);
    }
    if (cfg && cfg.cmd && window.CmdBar) {
      window.CmdBar.run(cfg.cmd);
    }
    if (cfg && cfg.nested) {
      var nn = parseInt(cfg.nested, 10);
      if (!isFinite(nn) || nn < 1) nn = 1;
      state.overlay = [{
        type: 'nested',
        template: cfg.nestedTpl || 'sqrt(x + R)',
        terminal: cfg.nestedTerm || '0',
        n0: 1, n1: Math.min(80, nn),
        label: '嵌套 N=' + nn, color: '#c0392b', width: 2.8
      }];
      plot.setState(state);
      if (window.SeriesLab) setTimeout(function () {
        window.SeriesLab.open();
        var t = document.querySelector('#seriesTabs .tab[data-stab="nested"]');
        if (t) t.click();
        if (window.SeriesLab.setNested) {
          window.SeriesLab.setNested(cfg.nestedTpl || 'sqrt(x + R)', cfg.nestedTerm || '0', nn);
        }
      }, 500);
    }
    if (cfg && cfg.series) {
      var nTerms = parseInt(cfg.series, 10);
      if (!isFinite(nTerms) || nTerms < 1) nTerms = 1;
      var term = cfg.seriesTerm || 'sin(n*x)/n';
      if (window.SeriesLab && window.SeriesLab.setSeries) {
        window.SeriesLab.setSeries(term, 1, Math.min(400, nTerms));
      } else {
        state.overlay = [{
          type: 'series', expr: term, n0: 1, n1: Math.min(400, nTerms),
          label: 'S' + nTerms + '(x)', color: '#8e44ad', width: 2.6
        }];
        plot.setState(state);
      }
      if (window.SeriesLab) setTimeout(function () {
        window.SeriesLab.open();
        var t = document.querySelector('#seriesTabs .tab[data-stab="series"]');
        if (t) t.click();
      }, 500);
    }

    window.addEventListener('hashchange', function () {
      var h = (location.hash || '').replace('#', '');
      if (PRESETS.some(function (p) { return p.id === h; })) applyPreset(h);
    });
  }

  function readConfig() {
    try {
      var q = new URLSearchParams(location.search || '');
      if (q.get('cfg')) return JSON.parse(q.get('cfg'));
      var o = { params: {}, exprs: [] };
      q.forEach(function (v, k) {
        if (k === 'preset') o.preset = v;
        else if (k.indexOf('p.') === 0) o.params[k.slice(2)] = v;
        else if (k === 'view') o.view = v;
        else if (k === 'title') o.title = v;
        else if (k === 'expr') o.exprs.push(v);
        else if (k === 'export') o.export = true;
      });
      return o;
    } catch (e) { return {}; }
  }

  function categoryOf(p) {
    if (p.category) return p.category;
    if (p.id === 'free') return '自由';
    if (MATH_IDS.indexOf(p.id) >= 0) return '数学';
    return '经济学';
  }

  function buildPresetSelect() {
    var sel = $('presetSelect');
    sel.innerHTML = '';
    CATS.forEach(function (cat) {
      var items = PRESETS.filter(function (p) { return categoryOf(p) === cat; });
      if (!items.length) return;
      var g = document.createElement('optgroup');
      g.label = cat;
      items.forEach(function (p) {
        var o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name;
        g.appendChild(o);
      });
      sel.appendChild(g);
    });
  }

  /* ---------------------------- 应用模板 ---------------------------- */
  function applyPreset(id) {
    var p = PRESETS.filter(function (x) { return x.id === id; })[0] || PRESETS[0];
    presetDef = p;
    paramDefs = (p.params || []).map(function (d) { return Object.assign({}, d); });

    var params = {};
    paramDefs.forEach(function (d) { params[d.name] = d.value; });

    state = {
      presetId: p.id,
      xVar: p.xVar || 'x',
      yVar: p.yVar || 'y',
      xLabel: p.xLabel,
      yLabel: p.yLabel,
      title: p.title || p.name,
      view: Object.assign({}, p.view),
      params: params,
      curves: buildCurves(p, params),
      annotations: [],
      shades: [],
      addedShades: [],
      points: [],
      paths: [],
      userPaths: [],
      field: null,
      overlay: [],
      axisAtEdge: axisEdgePref,
      equalAspect: equalAspectPref,
      baseView: Object.assign({}, p.view),
      ghost: null
    };

    syncAutoParams();
    $('presetSelect').value = p.id;
    $('chartTitle').textContent = p.title || p.name;
    $('presetNote').textContent = p.note || '';

    rebuildCurveList();
    rebuildParams();
    updateViewInputs();
    applyAspect();
    refreshChart();
    syncTopbarFromState();
    lab.taylor = lab.deriv = lab.binom = lab.leibniz = null;
    if (state) state.overlay = [];
  }

  function buildCurves(p, params) {
    var list = (typeof p.curves === 'function') ? p.curves(params) : p.curves;
    return (list || []).map(function (c, i) {
      return {
        type: c.type || 'explicit',
        expr: c.expr,
        display: c.display || '',
        noLegend: !!c.noLegend,
        expr2: c.expr2 || '',
        tmin: c.tmin,
        tmax: c.tmax,
        label: c.label || ('曲线 ' + (i + 1)),
        color: c.color || PLOT_PALETTE[i % PLOT_PALETTE.length],
        width: c.width || 2.2,
        dash: c.dash || null,
        visible: c.visible !== false
      };
    });
  }

  function addCurve(spec) {
    spec = spec || {};
    state.curves.push({
      type: spec.type || 'explicit',
      expr: spec.expr != null ? spec.expr : 'x',
      expr2: spec.expr2 || '',
      tmin: spec.tmin,
      tmax: spec.tmax,
      label: spec.label || '新曲线',
      color: spec.color || PLOT_PALETTE[state.curves.length % PLOT_PALETTE.length],
      width: spec.width || 2.2,
      dash: spec.dash || null,
      visible: true
    });
    syncAutoParams();
    rebuildCurveList();
    rebuildParams();
    syncTopbarFromState();
    refreshChart();
  }

  /* --------------------------- 命令行覆盖 --------------------------- */
  function applyOverrides(c) {
    if (!c) return;
    var touched = false;

    if (c.params) {
      Object.keys(c.params).forEach(function (k) {
        var v = parseFloat(c.params[k]);
        if (!isFinite(v)) return;
        var def = paramDefs.filter(function (d) { return d.name === k; })[0];
        if (!def) {
          def = { name: k, label: '参数 ' + k, min: Math.min(0, v), max: Math.max(1, v), step: 0.01, value: v };
          paramDefs.push(def);
        }
        if (v < def.min) def.min = v;
        if (v > def.max) def.max = v;
        state.params[k] = v;
        touched = true;
      });
    }

    if (c.view) {
      var parts = String(c.view).split(',').map(parseFloat);
      if (parts.length === 4 && parts.every(isFinite) && parts[1] > parts[0] && parts[3] > parts[2]) {
        state.view = { xmin: parts[0], xmax: parts[1], ymin: parts[2], ymax: parts[3] };
        state.baseView = Object.assign({}, state.view);
        updateViewInputs();
      }
    }

    if (c.exprs && c.exprs.length) {
      c.exprs.forEach(function (src, i) {
        if (!src) return;
        if (i === 0 && state.curves.length) {
          state.curves[0].expr = src;
          state.curves[0].label = src;
          state.curves[0].type = 'explicit';
        } else {
          state.curves.push({
            type: 'explicit', expr: src, expr2: '', label: '命令行曲线 ' + (i + 1),
            color: PLOT_PALETTE[state.curves.length % PLOT_PALETTE.length],
            width: 2.2, dash: null, visible: true
          });
        }
      });
      touched = true;
    }

    if (c.title) { $('chartTitle').textContent = c.title; state.title = c.title; }

    if (touched) {
      if (typeof presetDef.curves === 'function') state.curves = buildCurves(presetDef, state.params);
      syncAutoParams();
      rebuildCurveList();
      rebuildParams();
      refreshChart();
    }
  }

  /* --------------------------- 参数自动识别 --------------------------- */
  function syncAutoParams() {
    var have = {};
    paramDefs.forEach(function (d) { have[d.name] = true; });

    var needed = {};
    state.curves.forEach(function (c) {
      [c.expr, c.expr2].forEach(function (src) {
        if (!src) return;
        try {
          MathFn.compile(src).vars.forEach(function (v) {
            if (v === state.xVar || v === state.yVar || v === 'x' || v === 'y' || v === 't' || v === 'theta') return;
            needed[v] = true;
          });
        } catch (e) { /* 忽略 */ }
      });
    });

    Object.keys(needed).forEach(function (name) {
      if (!have[name]) {
        paramDefs.push({ name: name, label: '参数 ' + name, min: -5, max: 5, step: 0.1, value: 1, auto: true });
        state.params[name] = 1;
        have[name] = true;
      }
    });

    // 表达式里已经不存在、又是我自动加的参数 → 删掉
    for (var i = paramDefs.length - 1; i >= 0; i--) {
      var d = paramDefs[i];
      if (d.auto && !needed[d.name]) {
        paramDefs.splice(i, 1);
        delete state.params[d.name];
      }
    }
  }

  /* ----------------------------- 曲线列表 ----------------------------- */
  function rebuildCurveList() {
    var box = $('curveList');
    box.innerHTML = '';
    state.curves.forEach(function (c, idx) {
      var row = document.createElement('div');
      row.className = 'curve-row' + (c.visible === false ? ' hidden' : '');

      var sw = document.createElement('button');
      sw.className = 'swatch';
      sw.style.background = c.color;
      sw.title = '显示 / 隐藏';
      sw.addEventListener('click', function () {
        c.visible = (c.visible === false);
        row.classList.toggle('hidden', c.visible === false);
        refreshChart();
      });

      var main = document.createElement('div');
      main.className = 'curve-main';

      var line1 = document.createElement('div');
      line1.className = 'curve-line';
      var sel = document.createElement('select');
      sel.className = 'type-select';
      [['explicit', 'y=f(x)'], ['implicit', 'F(x,y)=0'], ['parametric', '参数'], ['polar', '极坐标']].forEach(function (pair) {
        var o = document.createElement('option');
        o.value = pair[0];
        o.textContent = pair[1];
        sel.appendChild(o);
      });
      sel.value = c.type || 'explicit';
      sel.title = '曲线类型';
      sel.addEventListener('change', function () {
        c.type = sel.value;
        if (c.type === 'parametric' && !c.expr2) c.expr2 = 'sin(t)';
        if (c.type === 'polar' && !c.expr) c.expr = '1 + cos(theta)';
        rebuildCurveList();
        refreshChart();
      });

      var inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'expr-input';
      inp.value = c.expr;
      inp.spellcheck = false;
      inp.title = (c.type === 'parametric') ? 'x(t) 的表达式' : (c.type === 'polar' ? 'r(θ) 的表达式' : '表达式');
      inp.addEventListener('input', function () {
        c.expr = inp.value;
        try { MathFn.compile(c.expr); inp.classList.remove('bad'); }
        catch (e) { inp.classList.add('bad'); }
        syncAutoParams();
        rebuildParams();
        refreshChart();
      });

      line1.appendChild(sel);
      line1.appendChild(inp);
      main.appendChild(line1);

      if (c.type === 'parametric') {
        var line2 = document.createElement('div');
        line2.className = 'curve-line';
        var inp2 = document.createElement('input');
        inp2.type = 'text';
        inp2.className = 'expr-input';
        inp2.value = c.expr2 || '';
        inp2.spellcheck = false;
        inp2.placeholder = 'y(t)';
        inp2.title = 'y(t) 的表达式';
        inp2.addEventListener('input', function () {
          c.expr2 = inp2.value;
          try { MathFn.compile(c.expr2); inp2.classList.remove('bad'); }
          catch (e) { inp2.classList.add('bad'); }
          syncAutoParams();
          rebuildParams();
          refreshChart();
        });
        line2.appendChild(inp2);
        main.appendChild(line2);
      }

      var line3 = document.createElement('div');
      line3.className = 'curve-line';
      var label = document.createElement('input');
      label.type = 'text';
      label.className = 'label-input';
      label.value = c.label;
      label.spellcheck = false;
      label.title = '图例名称';
      label.addEventListener('input', function () { c.label = label.value; refreshChart(); });
      line3.appendChild(label);
      main.appendChild(line3);

      var del = document.createElement('button');
      del.className = 'del';
      del.innerHTML = '×';
      del.title = '删除';
      del.addEventListener('click', function () {
        state.curves.splice(idx, 1);
        rebuildCurveList();
        refreshChart();
      });

      row.appendChild(sw);
      row.appendChild(main);
      row.appendChild(del);
      box.appendChild(row);
    });
  }

  /* ------------------------------ 参数控件 ------------------------------ */
  function rebuildParams() {
    var box = $('paramList');
    box.innerHTML = '';
    if (!paramDefs.length) {
      var empty = document.createElement('p');
      empty.className = 'tip';
      empty.textContent = '当前图形没有参数。表达式里写一个字母（如 a、b）就会自动出现滑杆。';
      box.appendChild(empty);
      return;
    }
    paramDefs.forEach(function (d) {
      var row = document.createElement('div');
      row.className = 'param-row';

      var top = document.createElement('div');
      top.className = 'param-top';
      var name = document.createElement('span');
      name.textContent = d.label || d.name;
      var val = document.createElement('span');
      val.className = 'param-val';
      val.textContent = MathFn.fmt(state.params[d.name], 3);
      top.appendChild(name);
      top.appendChild(val);

      var rng = document.createElement('input');
      rng.type = 'range';
      rng.min = d.min;
      rng.max = d.max;
      rng.step = d.step;
      rng.value = Math.min(d.max, Math.max(d.min, state.params[d.name]));
      rng.addEventListener('input', function () {
        var v = parseFloat(rng.value);
        state.params[d.name] = v;
        val.textContent = MathFn.fmt(v, 3);
        if (typeof presetDef.curves === 'function') {
          state.curves = buildCurves(presetDef, state.params);
          updateCurveInputs();
        }
        refreshChart();
      });

      row.appendChild(top);
      row.appendChild(rng);
      box.appendChild(row);
    });
  }

  function updateCurveInputs() {
    var rows = $('curveList').querySelectorAll('.curve-row');
    state.curves.forEach(function (c, i) {
      if (!rows[i]) return;
      var inp = rows[i].querySelector('.expr-input');
      if (inp && inp.value !== c.expr) inp.value = c.expr;
    });
  }

  /* ------------------------------ 绘制 ------------------------------ */
  /** 把表达式编译成 f(x,y) */
  function fieldFns(p, params) {
    var cx = MathFn.compile(p.field.fx);
    var cy = MathFn.compile(p.field.fy);
    function mk(c) {
      return function (x, y) {
        var env = Object.assign({}, params || {});
        env.x = x; env.y = y;
        env[state.xVar || 'x'] = x; env[state.yVar || 'y'] = y;
        try {
          var v = c.eval(env);
          return isFinite(v) ? v : NaN;
        } catch (e) { return NaN; }
      };
    }
    return { fx: mk(cx), fy: mk(cy) };
  }

  function eqFmt(v) {
    return Math.abs(v) < 1e-6 ? '0' : MathFn.fmt(v, 3);
  }

  function refreshChart() {
    var p = presetDef;
    var base = (typeof p.shades === 'function') ? p.shades(state.params) : (p.shades || []);
    state.shades = base.concat(state.addedShades || []);

    var anns = (typeof p.annotations === 'function') ? p.annotations(state.params) : (p.annotations || []);
    anns = (anns || []).slice();
    var paths = [];

    if (p.field) {
      state.field = { fx: p.field.fx, fy: p.field.fy };
      var fns = fieldFns(p, state.params);
      var eqs = [];
      try { eqs = Dyn.analyze(fns.fx, fns.fy, state.view, 10); } catch (e) { eqs = []; }
      eqs = eqs.filter(function (e) { return Math.abs(e.det) > 1e-6; }).slice(0, 8);
      eqs.forEach(function (e) {
        var col = e.stable === true ? '#2e7d32' : (e.stable === false ? '#c0392b' : '#8e44ad');
        var relY = (e.y - state.view.ymin) / (state.view.ymax - state.view.ymin);
        anns.push({
          x: e.x, y: e.y, color: col, r: 5.5, dx: 12,
          dy: relY < 0.18 ? 24 : -18,
          label: e.type + '\n(' + eqFmt(e.x) + ', ' + eqFmt(e.y) + ')'
        });
      });
      (p.seeds || []).forEach(function (sd) {
        var pts = Dyn.rk4(fns.fx, fns.fy, sd[0], sd[1], p.T || 40, p.h || 0.02);
        if (pts.length > 2) paths.push({ pts: pts, color: 'rgba(142,68,173,0.72)', width: 1.6 });
      });
    } else {
      state.field = null;
    }

    state.paths = paths.concat(state.userPaths || []);
    state.annotations = anns;
    plot.setState(state);
  }

  function updateViewInputs() {
    var a = $('vxmin'), b = $('vxmax'), c = $('vymin'), d = $('vymax');
    if (a) a.value = round(state.view.xmin);
    if (b) b.value = round(state.view.xmax);
    if (c) c.value = round(state.view.ymin);
    if (d) d.value = round(state.view.ymax);
    syncZoomUI();
  }

  /** 等比例：让 x、y 每单位占同样多的像素（必要时扩大较窄的那个范围） */
  function applyAspect() {
    if (!state || !state.equalAspect || !plot) return;
    var r = plot.plotRect ? plot.plotRect() : null;
    if (!r || !(r.w > 0) || !(r.h > 0)) return;
    var v = state.view;
    var xs = v.xmax - v.xmin, ys = v.ymax - v.ymin;
    if (!(xs > 0) || !(ys > 0)) return;
    var k = Math.min(r.w / xs, r.h / ys);
    if (!(k > 0) || !isFinite(k)) return;
    var nxs = r.w / k, nys = r.h / k;
    var cx = (v.xmin + v.xmax) / 2, cy = (v.ymin + v.ymax) / 2;
    if (Math.abs(nxs - xs) > xs * 1e-6 || Math.abs(nys - ys) > ys * 1e-6) {
      v.xmin = cx - nxs / 2; v.xmax = cx + nxs / 2;
      v.ymin = cy - nys / 2; v.ymax = cy + nys / 2;
      updateViewInputs();
      if (state.baseView) state.baseView = Object.assign({}, v);
    }
  }

  function currentZoom() {
    var b = state.baseView || state.view, v = state.view;
    var bw = b.xmax - b.xmin, vw = v.xmax - v.xmin;
    if (!(bw > 0) || !(vw > 0)) return 100;
    return Math.max(5, Math.min(400, 100 * bw / vw));
  }

  function syncZoomUI() {
    var el = $('zoomRange'), val = $('zoomVal');
    if (!el || !state) return;
    var z = Math.round(currentZoom());
    el.value = String(z);
    if (val) val.textContent = z + '%';
  }

  function setZoom(z, recenter) {
    var b = state.baseView || state.view, v = state.view;
    z = Math.max(5, Math.min(400, z || 100));
    var hw = (b.xmax - b.xmin) / 2 * 100 / z;
    var hh = (b.ymax - b.ymin) / 2 * 100 / z;
    var cx, cy;
    if (recenter || !isFinite(v.xmin)) {
      cx = (b.xmin + b.xmax) / 2; cy = (b.ymin + b.ymax) / 2;
    } else {
      cx = (v.xmin + v.xmax) / 2; cy = (v.ymin + v.ymax) / 2;
    }
    v.xmin = cx - hw; v.xmax = cx + hw;
    v.ymin = cy - hh; v.ymax = cy + hh;
    applyAspect();
    plot.setState(state);
    updateViewInputs();
  }
  function round(v) { return Math.round(v * 1000) / 1000; }

  /* ------------------------------ 视图 ------------------------------ */
  function fitView() {
    var ys = [], v = state.view, N = 400;
    var envBase = Object.assign({}, state.params);
    state.curves.forEach(function (c) {
      if (c.visible === false || (c.type || 'explicit') !== 'explicit') return;
      var fn;
      try { fn = MathFn.compile(c.expr).eval; } catch (e) { return; }
      for (var i = 0; i <= N; i++) {
        var x = v.xmin + (v.xmax - v.xmin) * i / N;
        var env = Object.assign({}, envBase);
        env[state.xVar] = x; env.x = x;
        var y;
        try { y = fn(env); } catch (e) { continue; }
        if (isFinite(y) && Math.abs(y) < 1e6) ys.push(y);
      }
    });
    if (!ys.length) return;
    ys.sort(function (a, b) { return a - b; });
    var lo = ys[Math.floor(ys.length * 0.02)], hi = ys[Math.floor(ys.length * 0.98)];
    if (!(hi > lo)) hi = lo + 1;
    var pad = (hi - lo) * 0.12;
    state.view.ymin = lo - pad;
    state.view.ymax = hi + pad;
    updateViewInputs();
    plot.render();
  }

  /* ------------------------------ 对照快照 ------------------------------ */
  function toggleSnapshot() {
    if (state.ghost) {
      state.ghost = null;
      $('snapshot').textContent = '存为对照';
      $('snapshot').classList.remove('on');
      plot.setState(state);
      return;
    }
    state.ghost = {
      curves: state.curves.map(function (c) { return Object.assign({}, c); }),
      params: Object.assign({}, state.params)
    };
    $('snapshot').textContent = '清除对照';
    $('snapshot').classList.add('on');
    plot.setState(state);
  }

  /* ------------------------------ 导出 ------------------------------ */
  function doExport() {
    var name = 'econ-graph-' + (state.presetId || 'chart') + '-' +
      new Date().toISOString().slice(0, 16).replace(/[:T]/g, '') + '.png';
    if (window.econAPI && window.econAPI.savePng) {
      plot.state.showTitle = true;
      plot.render();
      var dataUrl = plot.canvas.toDataURL('image/png');
      plot.state.showTitle = false;
      plot.render();
      window.econAPI.savePng(dataUrl, name);
      return;
    }
    plot.exportPNG(name);
  }

  function doExportTikz() {
    var tex = buildTikZ();
    var name = 'econ-graph-' + (state.presetId || 'chart') + '.tex';
    if (window.econAPI && window.econAPI.saveText) {
      window.econAPI.saveText(tex, name);
      return;
    }
    var blob = new Blob([tex], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); }, 500);
  }

  function hexToTikzColor(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return null;
    var v = m[1];
    return { name: 'c' + v.toLowerCase(), rgb: [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)] };
  }

  function buildTikZ() {
    var st = state, v = st.view;
    var W = 10, H = 7.5;
    var sx = W / (v.xmax - v.xmin);
    var sy = H / (v.ymax - v.ymin);
    function X(x) { return ((x - v.xmin) * sx).toFixed(3); }
    function Y(y) { return ((y - v.ymin) * sy).toFixed(3); }

    var L = [];
    L.push('% 由 EconGraph 生成（可直接粘进 LaTeX）');
    L.push('\\begin{tikzpicture}[x=1cm,y=1cm]');

    var used = {}, colorLines = [];
    st.curves.forEach(function (c) {
      var t = hexToTikzColor(c.color);
      if (t && !used[t.name]) {
        used[t.name] = true;
        colorLines.push('  \\definecolor{' + t.name + '}{RGB}{' + t.rgb.join(',') + '}');
      }
    });
    L = L.concat(colorLines);

    var y0 = (v.ymin <= 0 && v.ymax >= 0) ? 0 : v.ymin;
    var x0 = (v.xmin <= 0 && v.xmax >= 0) ? 0 : v.xmin;
    L.push('  \\draw[->,thick] (' + X(x0) + ',' + Y(y0) + ') -- (' + X(v.xmax) + ',' + Y(y0) + ');');
    L.push('  \\draw[->,thick] (' + X(x0) + ',' + Y(y0) + ') -- (' + X(x0) + ',' + Y(v.ymax) + ');');
    L.push('  \\node[below] at (' + X(v.xmax) + ',' + Y(y0) + ') {' + esc(st.xLabel || 'x') + '};');
    L.push('  \\node[left] at (' + X(x0) + ',' + Y(v.ymax) + ') {' + esc(st.yLabel || 'y') + '};');

    function envFor(x, y, t) {
      var e = Object.assign({}, st.params);
      e.x = x; e.y = y; e.t = t; e.theta = t;
      e[st.xVar || 'x'] = x; e[st.yVar || 'y'] = y;
      return e;
    }

    function emitPolyline(pts, opt) {
      if (pts.length < 2) return;
      var chunks = [], cur = [];
      for (var i = 0; i < pts.length; i++) {
        var q = pts[i];
        if (!q) { if (cur.length > 1) chunks.push(cur); cur = []; continue; }
        cur.push(q);
      }
      if (cur.length > 1) chunks.push(cur);
      chunks.forEach(function (ch) {
        var coords = ch.map(function (q) { return '(' + X(q[0]) + ',' + Y(q[1]) + ')'; });
        L.push('  \\draw[' + opt + '] plot[smooth] coordinates {' + coords.join(' ') + '};');
      });
    }

    st.curves.forEach(function (c) {
      if (c.visible === false) return;
      var t = hexToTikzColor(c.color);
      var opt = 'thick' + (t ? ',' + t.name : '') + (c.dash ? ',dashed' : '');
      var type = c.type || 'explicit';
      var fn, fn2;
      try { fn = MathFn.compile(c.expr).eval; } catch (e) { return; }

      if (type === 'explicit') {
        var pts = [], N = 200;
        for (var i = 0; i <= N; i++) {
          var x = v.xmin + (v.xmax - v.xmin) * i / N;
          var y;
          try { y = fn(envFor(x, 0, 0)); } catch (e) { y = NaN; }
          pts.push(isFinite(y) && Math.abs(y) < 1e5 ? [x, y] : null);
        }
        emitPolyline(pts, opt);
      } else if (type === 'parametric') {
        try { fn2 = MathFn.compile(c.expr2).eval; } catch (e) { return; }
        var t0 = (c.tmin == null) ? 0 : c.tmin, t1 = (c.tmax == null) ? Math.PI * 2 : c.tmax;
        var p2 = [];
        for (var k = 0; k <= 400; k++) {
          var tt = t0 + (t1 - t0) * k / 400;
          var px, py;
          try { px = fn(envFor(0, 0, tt)); py = fn2(envFor(0, 0, tt)); } catch (e) { px = NaN; py = NaN; }
          p2.push(isFinite(px) && isFinite(py) ? [px, py] : null);
        }
        emitPolyline(p2, opt);
      } else if (type === 'polar') {
        var t0p = (c.tmin == null) ? 0 : c.tmin, t1p = (c.tmax == null) ? Math.PI * 2 : c.tmax;
        var p3 = [];
        for (var m = 0; m <= 480; m++) {
          var th = t0p + (t1p - t0p) * m / 480;
          var r;
          try { r = fn(envFor(0, 0, th)); } catch (e) { r = NaN; }
          p3.push(isFinite(r) ? [r * Math.cos(th), r * Math.sin(th)] : null);
        }
        emitPolyline(p3, opt);
      } else if (type === 'implicit') {
        // 80×80 网格 + marching squares，直接输出线段
        var cols = 80, rows = 80;
        var dx = (v.xmax - v.xmin) / cols, dy = (v.ymax - v.ymin) / rows;
        var vals = [];
        for (var jj = 0; jj <= rows; jj++) {
          vals[jj] = [];
          for (var ii = 0; ii <= cols; ii++) {
            var xv = v.xmin + ii * dx, yv = v.ymin + jj * dy;
            var vv;
            try { vv = fn(envFor(xv, yv, 0)); } catch (e) { vv = NaN; }
            vals[jj][ii] = isFinite(vv) ? vv : NaN;
          }
        }
        var segs = 0;
        for (var j = 0; j < rows && segs < 900; j++) {
          for (var i2 = 0; i2 < cols && segs < 900; i2++) {
            var a = vals[j][i2], b = vals[j][i2 + 1], c2 = vals[j + 1][i2 + 1], d = vals[j + 1][i2];
            if (!isFinite(a) || !isFinite(b) || !isFinite(c2) || !isFinite(d)) continue;
            var idx = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c2 > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
            if (idx === 0 || idx === 15) continue;
            var gx = v.xmin + i2 * dx, gy = v.ymin + j * dy;
            function fx(p, q) { var dd = p - q; return Math.abs(dd) < 1e-12 ? 0.5 : p / dd; }
            var T = [gx + dx * fx(a, b), gy];
            var R = [gx + dx, gy + dy * fx(b, c2)];
            var Bo = [gx + dx * fx(d, c2), gy + dy];
            var Le = [gx, gy + dy * fx(a, d)];
            var pairs = [];
            if (idx === 1 || idx === 14) pairs.push([Le, T]);
            else if (idx === 2 || idx === 13) pairs.push([T, R]);
            else if (idx === 3 || idx === 12) pairs.push([Le, R]);
            else if (idx === 4 || idx === 11) pairs.push([R, Bo]);
            else if (idx === 6 || idx === 9) pairs.push([T, Bo]);
            else if (idx === 7 || idx === 8) pairs.push([Le, Bo]);
            else if (idx === 5) pairs.push([Le, T], [R, Bo]);
            else if (idx === 10) pairs.push([T, R], [Le, Bo]);
            pairs.forEach(function (pr) {
              var ddx = pr[1][0] - pr[0][0], ddy = pr[1][1] - pr[0][1];
              if (Math.abs(ddx) + Math.abs(ddy) < 1e-9) return;
              L.push('  \\draw[' + opt + '] (' + X(pr[0][0]) + ',' + Y(pr[0][1]) + ') -- (' +
                X(pr[1][0]) + ',' + Y(pr[1][1]) + ');');
              segs++;
            });
          }
        }
      }
    });

    (st.annotations || []).forEach(function (a) {
      if (a.x == null || a.y == null || !a.label) return;
      var txt = esc(String(a.label).split('\n').join(' '));
      L.push('  \\fill (' + X(a.x) + ',' + Y(a.y) + ') circle (2pt);');
      L.push('  \\node[anchor=west,font=\\small] at (' + X(a.x) + ',' + Y(a.y) + ') {' + txt + '};');
    });

    L.push('\\end{tikzpicture}');
    return L.join('\n') + '\n';
  }

  function esc(s) {
    return String(s).replace(/\\/g, '\\textbackslash{}').replace(/([&%$#_{}])/g, '\\$1');
  }

  /** 把顶栏输入框和表达式条同步成画布上的主函数 */
  function syncTopbarFromState() {
    var el = document.getElementById('cmdInput');
    var bar = document.getElementById('exprBar');
    var txt = document.getElementById('exprText');
    if (!el || !state) return;

    var primary = null;
    for (var i = 0; i < state.curves.length; i++) {
      var c = state.curves[i];
      if (c.visible === false) continue;
      if ((c.type || 'explicit') !== 'explicit') continue;
      primary = c;
      break;
    }
    if (!primary) {
      el.value = '';
      if (bar) bar.classList.add('hidden');
      return;
    }
    var shown = String(primary.display || primary.expr || '');
    el.value = shown;
    if (bar && txt) {
      var pretty = shown;
      if (!primary.display) {
        try { pretty = Calc.pretty(shown); } catch (e) { }
      }
      txt.innerHTML = '<b>y = ' + pretty + '</b>';
      bar.classList.remove('hidden');
    }
  }

  function signalReady() {
    if (!cfg || !cfg.export) return;
    if (!window.econAPI || !window.econAPI.exportImage) return;
    if (cfg.tikz) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          setTimeout(function () {
            try { window.econAPI.exportTikz(buildTikZ()); }
            catch (e) { window.econAPI.exportTikz('% ERROR ' + e.message); }
          }, 250);
        });
      });
      return;
    }
    var send = function () {
      try {
        plot.state.showTitle = true;
        plot.render();
        var url = plot.canvas.toDataURL('image/png');
        plot.state.showTitle = false;
        plot.render();
        window.econAPI.exportImage(url);
      } catch (e) {
        if (window.econAPI.ready) window.econAPI.ready({ error: e.message });
      }
    };
    requestAnimationFrame(function () { requestAnimationFrame(function () { setTimeout(send, 250); }); });
  }

  /* ============================== 数学工具 ============================== */
  function initLab() {
    $('openLab').addEventListener('click', openLab);
    $('labClose').addEventListener('click', closeLab);
    $('labOverlay').addEventListener('click', function (e) {
      if (e.target === $('labOverlay')) closeLab();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLab(); });

    Array.prototype.forEach.call(document.querySelectorAll('.tabs .tab[data-tab]'), function (t) {
      t.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('.tab[data-tab]'), function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        Array.prototype.forEach.call(document.querySelectorAll('[data-panel]'), function (p) {
          p.classList.toggle('hidden', p.getAttribute('data-panel') !== t.getAttribute('data-tab'));
        });
      });
    });

    $('labDerivRun').addEventListener('click', runDeriv);
    $('labDerivPlot').addEventListener('click', function () {
      if (!lab.deriv) return runDeriv();
      addCurve({ expr: lab.deriv.expr, label: lab.deriv.label, dash: [4, 4] });
    });

    $('labTRun').addEventListener('click', runTaylor);
    $('labTPlot').addEventListener('click', function () {
      if (!lab.taylor) return runTaylor();
      addCurve({ expr: lab.taylor.poly, label: lab.taylor.label, dash: [2, 3] });
    });
    $('labTErr').addEventListener('click', function () {
      if (!lab.taylor) return runTaylor();
      addCurve({ expr: '(' + lab.taylor.src + ') - (' + lab.taylor.poly + ')', label: '误差 f − P' + lab.taylor.n });
    });

    $('labBRun').addEventListener('click', runBinom);
    $('labBPlot').addEventListener('click', function () {
      if (!lab.binom) return runBinom();
      addCurve({ expr: lab.binom.src, label: '原式 (a+b)^n' });
      addCurve({ expr: lab.binom.expanded, label: '展开式', dash: [5, 4] });
    });

    $('labLRun').addEventListener('click', runLeibniz);
    $('labLPlot').addEventListener('click', function () {
      if (!lab.leibniz) return runLeibniz();
      addCurve({ expr: lab.leibniz.sum, label: 'n 阶导（莱布尼茨展开）' });
    });
  }

  function openLab() {
    $('labOverlay').classList.remove('hidden');
    fillSourceSelects();
  }
  function closeLab() { $('labOverlay').classList.add('hidden'); }

  function fillSourceSelects() {
    ['labDerivSrc', 'labTSrc'].forEach(function (id) {
      var sel = $(id);
      var prev = sel.value;
      sel.innerHTML = '';
      state.curves.forEach(function (c, i) {
        if ((c.type || 'explicit') !== 'explicit') return;
        var o = document.createElement('option');
        o.value = String(i);
        o.textContent = (i + 1) + '. ' + (c.label || c.expr);
        sel.appendChild(o);
      });
      if (prev && +prev < state.curves.length) sel.value = prev;
    });
  }

  function curveSrc(sel) {
    var idx = parseInt(sel.value, 10);
    var c = state.curves[idx] || state.curves[0];
    return c ? c.expr : 'x';
  }

  function derivVarOf(ast) {
    if (Calc.depends(ast, state.xVar)) return state.xVar;
    if (Calc.depends(ast, 'x')) return 'x';
    return state.xVar;
  }

  function setOut(id, text, isErr) {
    var el = $(id);
    el.textContent = text;
    el.className = 'lab-out' + (isErr ? ' err' : '');
  }

  function runDeriv() {
    var src = curveSrc($('labDerivSrc'));
    var n = parseInt($('labDerivOrder').value, 10);
    try {
      var ast = MathFn.parse(MathFn.rhs(src));
      var v = derivVarOf(ast);
      var d = Calc.deriv(ast, v, n);
      var s = Calc.toStr(d);
      lab.deriv = { expr: s, label: 'd^' + n + '/d' + v + '^' + n + ' [' + src + ']' };
      setOut('labDerivOut',
        'f(' + v + ') = ' + src + '\n求导变量：' + v + '，阶数：' + n + '\n\n' +
        'f' + sup(n) + '(' + v + ') = ' + Calc.pretty(s), false);
    } catch (e) {
      lab.deriv = null;
      setOut('labDerivOut', '✗ ' + e.message + '\n\n提示：min/max 这类函数没有符号导数。', true);
    }
  }

  function sup(n) {
    var map = { 1: '′', 2: '″', 3: '‴' };
    return map[n] || '⁽' + n + '⁾';
  }

  function runTaylor() {
    var src = curveSrc($('labTSrc'));
    var x0 = parseFloat($('labTX0').value);
    var n = parseInt($('labTN').value, 10);
    if (!isFinite(x0)) x0 = 0;
    try {
      var ast = MathFn.parse(MathFn.rhs(src));
      var v = derivVarOf(ast);
      var t = Calc.taylor(ast, v, x0, n, state.params);
      var polyStr = Calc.toStr(t.poly);
      var lines = [];
      lines.push('f(' + v + ') = ' + src);
      lines.push('展开点 x₀ = ' + x0 + '，阶数 n = ' + n);
      lines.push('');
      lines.push(' k   f⁽ᵏ⁾(x₀)          c_k');
      for (var k = 0; k <= n; k++) {
        var fk = t.coeffs[k] * Calc.factorial(k);
        lines.push(' ' + String(k).padStart(2) + '   ' + pad(Calc.fmtNum(round6(fk)), 14) + '  ' + Calc.fmtNum(round6(t.coeffs[k])));
      }
      lines.push('');
      lines.push('P' + n + '(' + v + ') = ' + Calc.pretty(polyStr));
      lab.taylor = { src: src, poly: polyStr, n: n, label: 'P' + n + ' 泰勒多项式' };
      setOut('labTOut', lines.join('\n'), false);
    } catch (e) {
      lab.taylor = null;
      setOut('labTOut', '✗ ' + e.message, true);
    }
  }

  function round6(v) { return Math.round(v * 1e6) / 1e6; }
  function pad(s, w) { s = String(s); while (s.length < w) s += ' '; return s; }

  function runBinom() {
    var a = ($('labBA').value || '0').trim();
    var b = ($('labBB').value || '0').trim();
    var n = parseInt($('labBN').value, 10);
    try {
      MathFn.compile(a); MathFn.compile(b);
      var terms = Calc.binomialTerms('(' + a + ')', '(' + b + ')', n);
      var expanded = terms.map(function (t) { return '(' + t.text + ')'; }).join(' + ');
      var lines = [];
      lines.push('(' + a + ' + ' + b + ')^' + n + ' 展开：');
      lines.push('');
      terms.forEach(function (t, i) {
        lines.push('  C(' + n + ',' + i + ')' + pad('=' + t.coef, 6) + ' · ' + t.text);
      });
      lines.push('');
      lines.push('帕斯卡三角第 ' + n + ' 行：' + Calc.binomialCoeffs(n).join('  '));
      lines.push('');
      lines.push('= ' + Calc.pretty(expanded));
      lab.binom = { src: '(' + a + ' + ' + b + ')^' + n, expanded: expanded };
      setOut('labBOut', lines.join('\n'), false);
    } catch (e) {
      lab.binom = null;
      setOut('labBOut', '✗ ' + e.message + '\n\n提示：a、b 可以是数字，也可以是含 x 的表达式。', true);
    }
  }

  function runLeibniz() {
    var u = ($('labLU').value || 'x').trim();
    var v = ($('labLV').value || '1').trim();
    var n = parseInt($('labLN').value, 10);
    try {
      var ua = MathFn.parse(MathFn.rhs(u));
      var va = MathFn.parse(MathFn.rhs(v));
      var vname = derivVarOf(ua);
      if (!Calc.depends(ua, vname) && Calc.depends(va, vname)) vname = derivVarOf(va);

      var terms = Calc.leibnizTerms(ua, va, vname, vname, n);
      var sumParts = [], lines = [];
      lines.push('(' + u + ' · ' + v + ')⁽' + n + '⁾ 按莱布尼茨公式展开：');
      lines.push('');
      lines.push(' k   C(n,k)   u⁽ᵏ⁾                    v⁽ⁿ⁻ᵏ⁾');
      terms.forEach(function (t) {
        lines.push(' ' + String(t.k).padStart(2) + '   ' + pad(String(t.coef), 7) +
          pad(Calc.pretty(t.uText), 24) + Calc.pretty(t.vText));
        if (t.ok) sumParts.push('(' + t.coef + ')*(' + t.uText + ')*(' + t.vText + ')');
      });
      if (!sumParts.length) throw new Error('这一组 u、v 无法符号求导');
      var sum = sumParts.join(' + ');
      lines.push('');
      lines.push('合并后：' + Calc.pretty(sum));
      lab.leibniz = { sum: sum };
      setOut('labLOut', lines.join('\n'), false);
    } catch (e) {
      lab.leibniz = null;
      setOut('labLOut', '✗ ' + e.message, true);
    }
  }

  /* 自检 */
  function runSelfTest() {
    var lines = [];
    function grab(id) { return ($(id).textContent || '').replace(/\s+/g, ' ').slice(0, 200); }
    try {
      openLab();
      runDeriv(); lines.push('DERIV: ' + grab('labDerivOut'));
      runTaylor(); lines.push('TAYLOR: ' + grab('labTOut'));
      runBinom(); lines.push('BINOM: ' + grab('labBOut'));
      runLeibniz(); lines.push('LEIBNIZ: ' + grab('labLOut'));
      var before = state.curves.length;
      $('labTPlot').click();
      lines.push('PLOT: ' + before + ' -> ' + state.curves.length);
      if (window.Tools && window.Tools.selfTest) {
        window.Tools.selfTest().forEach(function (l) { lines.push(l); });
      }
      if (window.SeriesLab && window.SeriesLab.selfTest) {
        window.SeriesLab.selfTest().forEach(function (l) { lines.push(l); });
      }
      document.getElementById('snapshot').click();
      lines.push('GHOST: ' + (!!state.ghost));
      document.getElementById('snapshot').click();
      lines.push('GHOST-CLEAR: ' + (!state.ghost));
      var tex = buildTikZ();
      lines.push('TIKZ: ' + tex.split('\n').length + ' lines; ' + tex.split('\n')[3]);
      var tab = document.querySelector('.tab[data-tab="taylor"]');
      if (tab) tab.click();
    } catch (e) {
      lines.push('ERROR: ' + e.message);
    }
    lines.forEach(function (l) { console.log('[selftest] ' + l); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
