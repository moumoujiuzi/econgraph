/* ==========================================================================
   web-shim.js — 浏览器（Edge/Chrome）环境下的 econAPI 兼容层
   - Electron 里 window.econAPI 已存在，这里直接返回，不做任何事
   - 浏览器里用「另存为」对话框（File System Access API）保存，
     不支持时退回 <a download> 下载
   ========================================================================== */
(function () {
  'use strict';
  if (window.econAPI) return;

  function download(href, name) {
    var a = document.createElement('a');
    a.href = href;
    a.download = name || 'EconGraph.png';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); }, 2000);
  }

  function blobUrl(text) {
    try {
      return URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    } catch (e) {
      return 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
    }
  }

  // 优先走系统「另存为」；用户取消就什么都不做
  function saveBlob(getBlob, name, types) {
    if (!window.showSaveFilePicker) {
      getBlob().then(function (u) { download(u, name); });
      return;
    }
    var handle;
    try {
      handle = window.showSaveFilePicker({
        suggestedName: name,
        types: types || [{ description: '文件', accept: { 'application/octet-stream': ['.png', '.tex'] } }]
      });
    } catch (e) {
      getBlob().then(function (u) { download(u, name); });
      return;
    }
    handle.then(function (h) {
      return getBlob().then(function (url) {
        return fetch(url).then(function (r) { return r.blob(); }).then(function (blob) {
          return h.createWritable().then(function (w) {
            return w.write(blob).then(function () { return w.close(); });
          });
        });
      });
    }).catch(function () { /* 取消保存 */ });
  }

  function dataUrlBlob(dataUrl) {
    return Promise.resolve(dataUrl);
  }

  window.econAPI = {
    web: true,
    ready: function () { },
    info: function () { return { web: true }; },

    savePng: function (dataUrl, name) {
      saveBlob(function () { return dataUrlBlob(dataUrl); }, name || 'EconGraph.png',
        [{ description: 'PNG 图片', accept: { 'image/png': ['.png'] } }]);
    },

    saveText: function (text, name) {
      saveBlob(function () { return Promise.resolve(blobUrl(text)); }, name || 'EconGraph.tex',
        [{ description: 'LaTeX / 文本', accept: { 'text/plain': ['.tex', '.txt'] } }]);
    },

    exportImage: function (dataUrl) { this.savePng(dataUrl, 'EconGraph.png'); },
    exportTikz: function (text) { this.saveText(text, 'EconGraph.tex'); }
  };
})();
