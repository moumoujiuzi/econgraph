/* ==========================================================================
   desktop/main.js — Electron 主进程
   两种运行方式：
     1) 正常打开窗口： EconGraph.exe [--preset=demand-supply] [--param A=70] ...
     2) 无头出图：     EconGraph.exe --export=out.png --preset=consumption
   ========================================================================== */
'use strict';

const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_DIR = path.join(__dirname, '..');
const INDEX = path.join(APP_DIR, 'index.html');

/* --------------------------- 用户数据目录 ---------------------------
   默认的 %APPDATA%\<应用名> 在部分 Windows 环境下会让 Chromium 初始化时崩溃，
   所以显式指定一个确定可写的位置：优先用程序目录下的 data\（便携），
   不可写时退回 %APPDATA%\EconGraph。
   ------------------------------------------------------------------ */
function pickUserData() {
  const candidates = [
    path.join(path.dirname(process.execPath), 'data'),
    path.join(app.getPath('appData'), 'EconGraph')
  ];
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch (e) { /* 换下一个 */ }
  }
  return app.getPath('userData');
}

app.setPath('userData', pickUserData());
app.setAppUserModelId('EconGraph.Desktop');

/* ----------------------------- 参数解析 ----------------------------- */
function parseArgs(argv) {
  const o = {
    preset: null, params: {}, exprs: [], view: null, title: null,
    exportPath: null, width: 1600, height: 1000, show: true, help: false, selftest: false, list: false, tikz: null, tools: false, series: null, seriesTerm: null, nested: null, nestedTpl: null, nestedTerm: null, cmd: null, typed: null, zoom: null, lab: null, aspect: null
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    const key = (eq > 0 ? a.slice(2, eq) : a.slice(2)).toLowerCase();
    const take = () => {
      if (eq > 0) return a.slice(eq + 1);
      const n = argv[i + 1];
      if (n && !n.startsWith('--')) { i++; return n; }
      return '';
    };
    switch (key) {
      case 'preset': o.preset = take(); break;
      case 'param': {
        const s = take();
        const k = s.indexOf('=');
        if (k > 0) o.params[s.slice(0, k)] = s.slice(k + 1);
        break;
      }
      case 'expr': o.exprs.push(take()); break;
      case 'view': o.view = take(); break;
      case 'title': o.title = take(); break;
      case 'export': o.exportPath = take() || 'econ-graph.png'; o.show = false; break;
      case 'tikz': o.tikz = take() || 'econ-graph.tex'; o.show = false; break;
      case 'tools': o.tools = true; break;
      case 'series': o.series = take() || '1'; break;
      case 'series-term': o.seriesTerm = take(); break;
      case 'nested': o.nested = take() || '1'; break;
      case 'nested-tpl': o.nestedTpl = take(); break;
      case 'nested-term': o.nestedTerm = take(); break;
      case 'cmd': o.cmd = take(); break;
      case 'typed': o.typed = take(); break;
      case 'zoom': o.zoom = take(); break;
      case 'lab': o.lab = take(); break;
      case 'aspect': o.aspect = take(); break;
      case 'width': o.width = Math.max(640, parseInt(take(), 10) || 1600); break;
      case 'height': o.height = Math.max(480, parseInt(take(), 10) || 1000); break;
      case 'help': o.help = true; break;
      case 'selftest': o.selftest = true; break;
      case 'list': o.list = true; break;
      default: break;
    }
  }
  return o;
}

const USAGE = `EconGraph 命令行用法：
  EconGraph.exe                              打开窗口
  EconGraph.exe --preset=demand-supply       打开并切到指定模板
  EconGraph.exe --preset=demand-supply --param A=70 --param B0=15
  EconGraph.exe --expr "C=200+0.8Y" --view 0,2000,0,2000
  EconGraph.exe --export=out.png --preset=consumption --width=1600 --height=1000
模板 id：consumption / demand-supply / price-ceiling / indifference / cost /
        free / weierstrass / polynomial-high / derivatives / taylor`;

/* ----------------------------- 窗口 ----------------------------- */
function buildCfg(o) {
  return {
    preset: o.preset,
    params: o.params,
    exprs: o.exprs,
    view: o.view,
    title: o.title,
    export: !o.show,
    tikz: !!o.tikz,
    tools: !!o.tools,
    series: o.series,
    nested: o.nested,
    nestedTpl: o.nestedTpl,
    nestedTerm: o.nestedTerm,
    cmd: o.cmd,
    typed: o.typed,
    zoom: o.zoom,
    lab: o.lab,
    aspect: o.aspect,
    seriesTerm: o.seriesTerm,
    selftest: !!o.selftest
  };
}

let exportJob = null;   // { file, timer, done }

function createWindow(o) {
  const win = new BrowserWindow({
    width: o.width,
    height: o.height,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    backgroundColor: '#f4f6f8',
    title: 'EconGraph',
    icon: path.join(APP_DIR, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false
    }
  });

  const cfg = buildCfg(o);
  win.loadFile(INDEX, { query: { cfg: JSON.stringify(cfg) } });

  win.once('ready-to-show', () => {
    if (o.show) win.show();
  });

  if (!o.show) {
    const file = path.resolve(process.cwd(), o.tikz || o.exportPath);
    exportJob = { file: file, done: false };
    exportJob.timer = setTimeout(function () {
      if (!exportJob || exportJob.done) return;
      console.error('EXPORT TIMEOUT');
      app.exit(5);
    }, 30000);
  }

  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('renderer gone: ' + JSON.stringify(details));
  });

  // 把渲染进程的报错转打到 stdout，便于命令行诊断
  win.webContents.on('console-message', function (e, level, message) {
    var msg = (e && e.message) || message;
    if (msg) console.log('[renderer] ' + msg);
  });
  win.webContents.on('did-fail-load', function (_e, code, desc) {
    console.error('[load-failed] ' + code + ' ' + desc);
  });
  win.webContents.on('preload-error', function (_e, p, err) {
    console.error('[preload-error] ' + p + ' ' + (err && err.message));
  });

  return win;
}

/* ----------------------------- 生命周期 ----------------------------- */
app.disableHardwareAcceleration();

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  const argvStart = app.isPackaged ? 1 : 2;
  const o = parseArgs(process.argv.slice(argvStart));

  if (o.list) {
    console.log([
      'consumption', 'demand-supply', 'price-ceiling', 'indifference',
      'cost', 'free', 'weierstrass', 'polynomial-high', 'derivatives', 'taylor'
    ].join('\n'));
    app.exit(0);
    return;
  }

  if (o.help) {
    console.log(USAGE);
    fs.writeFileSync(path.join(process.cwd(), 'econ-graph-usage.txt'), USAGE, 'utf8');
    app.exit(0);
    return;
  }

  createWindow(o);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(o);
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

/* ----------------------------- IPC ----------------------------- */
ipcMain.on('export-image', (event, dataUrl) => {
  if (!exportJob || exportJob.done) return;
  exportJob.done = true;
  clearTimeout(exportJob.timer);
  try {
    const base64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
    fs.mkdirSync(path.dirname(exportJob.file), { recursive: true });
    fs.writeFileSync(exportJob.file, Buffer.from(base64, 'base64'));
    console.log('EXPORTED ' + exportJob.file);
    app.exit(0);
  } catch (e) {
    console.error('EXPORT FAILED: ' + e.message);
    app.exit(3);
  }
});

ipcMain.handle('save-png', async (event, dataUrl, suggested) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const res = await dialog.showSaveDialog(win, {
    title: '导出 PNG',
    defaultPath: suggested || 'econ-graph.png',
    filters: [{ name: 'PNG 图片', extensions: ['png'] }]
  });
  if (res.canceled || !res.filePath) return { ok: false };
  const base64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
  try {
    fs.writeFileSync(res.filePath, Buffer.from(base64, 'base64'));
    return { ok: true, path: res.filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.on('tikz-text', (event, text) => {
  if (!exportJob || exportJob.done) return;
  exportJob.done = true;
  clearTimeout(exportJob.timer);
  try {
    fs.mkdirSync(path.dirname(exportJob.file), { recursive: true });
    fs.writeFileSync(exportJob.file, String(text), 'utf8');
    console.log('TIKZ ' + exportJob.file);
    app.exit(0);
  } catch (e) {
    console.error('TIKZ FAILED: ' + e.message);
    app.exit(3);
  }
});

ipcMain.handle('save-text', async (event, text, suggested) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const res = await dialog.showSaveDialog(win, {
    title: '导出文件',
    defaultPath: suggested || 'econ-graph.tex',
    filters: [{ name: 'TeX', extensions: ['tex'] }, { name: '所有文件', extensions: ['*'] }]
  });
  if (res.canceled || !res.filePath) return { ok: false };
  try {
    fs.writeFileSync(res.filePath, String(text), 'utf8');
    return { ok: true, path: res.filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('app-info', () => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome
}));




