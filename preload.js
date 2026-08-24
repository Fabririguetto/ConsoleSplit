const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Terminal
  ptyCreate: (opts) => ipcRenderer.invoke('pty:create', opts),
  ptyWrite: (opts) => ipcRenderer.send('pty:write', opts),
  ptyResize: (opts) => ipcRenderer.send('pty:resize', opts),
  ptyKill: (opts) => ipcRenderer.send('pty:kill', opts),
  onPtyData: (cb) => ipcRenderer.on('pty:data', (_, d) => cb(d)),
  onPtyExit: (cb) => ipcRenderer.on('pty:exit', (_, d) => cb(d)),
  removePtyListeners: () => {
    ipcRenderer.removeAllListeners('pty:data');
    ipcRenderer.removeAllListeners('pty:exit');
  },

  // Profiles
  loadProfiles: () => ipcRenderer.invoke('profiles:load'),
  saveProfiles: (p) => ipcRenderer.invoke('profiles:save', p),

  // Window controls
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),

  // Directory picker
  openDir: () => ipcRenderer.invoke('dialog:openDir'),
});
