/* ==========================================================================
   desktop/preload.js — 只暴露必要的桥接能力
   ========================================================================== */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('econAPI', {
  isDesktop: true,
  ready: (info) => ipcRenderer.send('chart-ready', info || {}),
  exportImage: (dataUrl) => ipcRenderer.send('export-image', dataUrl),
  exportTikz: (text) => ipcRenderer.send('tikz-text', text),
  savePng: (dataUrl, suggested) => ipcRenderer.invoke('save-png', dataUrl, suggested),
  saveText: (text, suggested) => ipcRenderer.invoke('save-text', text, suggested),
  info: () => ipcRenderer.invoke('app-info')
});

