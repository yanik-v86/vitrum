import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('no-sandbox');
}

let mainWindow: BrowserWindow | null = null;
const DEFAULT_ICONS_DIR = path.join(__dirname, '../default-icons');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1000, minHeight: 700,
    frame: false, titleBarStyle: 'hidden', backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── Window controls ──
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:maximize', () => {
  mainWindow?.isMaximized() ? mainWindow?.unmaximize() : mainWindow?.maximize();
});

// ── File dialogs ──
ipcMain.handle('dialog:openFolder', async () => {
  const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('dialog:openFiles', async () => {
  const r = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp'] }],
  });
  return r.canceled ? null : r.filePaths;
});

// ── Read files as data URLs (used for ALL icons now) ──
ipcMain.handle('readFileAsDataUrl', async (_event, filePath: string) => {
  try {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimes: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp',
    };
    return `data:${mimes[ext] || 'image/png'};base64,${buf.toString('base64')}`;
  } catch { return null; }
});

ipcMain.handle('readFolder', async (_event, folderPath: string) => {
  try {
    return fs.readdirSync(folderPath)
      .filter(f => ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'].includes(path.extname(f).toLowerCase()))
      .map(f => ({ name: f, path: path.join(folderPath, f) }));
  } catch { return []; }
});

// ── Pack save/load ──
ipcMain.handle('savePack', async (_event, pack: { name: string; icons: { name: string; dataUrl: string }[] }) => {
  const dir = path.join(app.getPath('userData'), 'icon-packs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${pack.name}.json`), JSON.stringify(pack, null, 2));
  return true;
});
ipcMain.handle('loadPacks', async () => {
  const dir = path.join(app.getPath('userData'), 'icon-packs');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    return { name: d.name, icons: d.icons };
  });
});
ipcMain.handle('deletePack', async (_event, name: string) => {
  const p = path.join(app.getPath('userData'), 'icon-packs', `${name}.json`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
});

// ── Save PNG via native dialog ──
ipcMain.handle('savePng', async (_event, dataUrl: string, defaultName: string) => {
  const r = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: defaultName,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (r.canceled || !r.filePath) return false;
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(r.filePath, Buffer.from(base64, 'base64'));
  return true;
});

// ── Load default icons: return {name, dataUrl} for EVERY icon ──
// Fully async I/O — reads ~7000 SVGs without blocking the main process
ipcMain.handle('loadDefaultIcons', async () => {
  const packs: { name: string; icons: { name: string; dataUrl: string }[] }[] = [];
  if (!fs.existsSync(DEFAULT_ICONS_DIR)) return packs;

  const readdir = async (dir: string) => {
    try { return await fs.promises.readdir(dir); } catch { return [] as string[]; }
  };
  const isDir = async (p: string) => {
    try { return (await fs.promises.stat(p)).isDirectory(); } catch { return false; }
  };
  const readFile = async (p: string) => {
    try { return await fs.promises.readFile(p); } catch { return null; }
  };

  const topEntries = await readdir(DEFAULT_ICONS_DIR);
  const setNames: string[] = [];
  for (const d of topEntries) {
    if (await isDir(path.join(DEFAULT_ICONS_DIR, d))) setNames.push(d);
  }

  for (const setName of setNames) {
    const setDir = path.join(DEFAULT_ICONS_DIR, setName);
    const allFiles = await readdir(setDir);
    const files = allFiles.filter(f => f.endsWith('.svg'));
    const icons: { name: string; dataUrl: string }[] = [];

    // Read in batches of 100 with async I/O
    for (let i = 0; i < files.length; i += 100) {
      const batch = files.slice(i, i + 100);
      const results = await Promise.all(
        batch.map(async (file) => {
          const buf = await readFile(path.join(setDir, file));
          if (!buf) return null;
          let svg = buf.toString('utf-8');
          // Force white color for dark backgrounds (icons use stroke="currentColor")
          svg = svg.replace(/<svg([^>]*)>/, '<svg$1 color="white">');
          return { name: file.replace('.svg', ''), dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` };
        })
      );
      for (const r of results) { if (r) icons.push(r); }
    }
    if (icons.length > 0) packs.push({ name: setName, icons });
  }
  return packs;
});
