const { contextBridge, ipcRenderer } = require('electron');

// window.nativeBridge: Google sign-in through the system browser, and bringing the window forward from a reminder.
contextBridge.exposeInMainWorld('nativeBridge', {
  authorize: (url) => ipcRenderer.invoke('auth:authorize', url),
  postForm: (url, params) => ipcRenderer.invoke('auth:postForm', url, params),
  focus: () => ipcRenderer.invoke('win:focus'),
  alarm: (reminder) => ipcRenderer.invoke('alarm:show', reminder),
  exportPDF: (html, name) => ipcRenderer.invoke('export:pdf', html, name),
  setTheme: (t) => ipcRenderer.invoke('win:theme', t),
  copyImage: (b64) => ipcRenderer.invoke('clip:image', b64)
});
