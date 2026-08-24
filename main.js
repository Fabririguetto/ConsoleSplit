const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

let mainWindow;
const ptyProcesses = new Map();
const profilesPath = path.join(app.getPath('userData'), 'profiles.json');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#1a1a2e',
    titleBarStyle: 'hidden',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  ptyProcesses.forEach((pty) => {
    try { pty.kill(); } catch (_) {}
  });
  if (process.platform !== 'darwin') app.quit();
});

// ── Terminal lifecycle ──────────────────────────────────────────────────────

ipcMain.handle('pty:create', (event, { id, cwd }) => {
  let pty;
  try {
    const nodePty = require('node-pty');
    const shell = process.env.COMSPEC || 'cmd.exe';
    const resolvedCwd = fs.existsSync(cwd) ? cwd : os.homedir();

    pty = nodePty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: resolvedCwd,
      env: { ...process.env, TERM: 'xterm-256color' },
    });

    pty.onData((data) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:data', { id, data });
      }
    });

    pty.onExit(() => {
      ptyProcesses.delete(id);
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:exit', { id });
      }
    });

    ptyProcesses.set(id, pty);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.on('pty:write', (event, { id, data }) => {
  const pty = ptyProcesses.get(id);
  if (pty) pty.write(data);
});

ipcMain.on('pty:resize', (event, { id, cols, rows }) => {
  const pty = ptyProcesses.get(id);
  if (pty) pty.resize(Math.max(cols, 2), Math.max(rows, 2));
});

ipcMain.on('pty:kill', (event, { id }) => {
  const pty = ptyProcesses.get(id);
  if (pty) {
    try { pty.kill(); } catch (_) {}
    ptyProcesses.delete(id);
  }
});

// ── Profiles ────────────────────────────────────────────────────────────────

ipcMain.handle('profiles:load', () => {
  try {
    if (!fs.existsSync(profilesPath)) return [];
    return JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
  } catch (_) {
    return [];
  }
});

ipcMain.handle('profiles:save', (event, profiles) => {
  try {
    fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── Window controls ──────────────────────────────────────────────────────────

ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow.close());

// ── Directory picker ─────────────────────────────────────────────────────────

ipcMain.handle('dialog:openDir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Seleccionar directorio para la terminal',
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});
