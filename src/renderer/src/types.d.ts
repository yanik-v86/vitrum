interface ElectronAPI {
  minimize: () => Promise<void>;
  close: () => Promise<void>;
  maximize: () => Promise<void>;
  openFolder: () => Promise<string | null>;
  openFiles: () => Promise<string[] | null>;
  readFolder: (p: string) => Promise<{ name: string; path: string }[]>;
  readFileAsDataUrl: (p: string) => Promise<string | null>;
  savePack: (pack: { name: string; icons: { name: string; dataUrl: string }[] }) => Promise<boolean>;
  loadPacks: () => Promise<{ name: string; icons: { name: string; dataUrl: string }[] }[]>;
  deletePack: (name: string) => Promise<void>;
  loadDefaultIcons: () => Promise<{ name: string; icons: { name: string; dataUrl: string }[] }[]>;
}

interface Window { electronAPI: ElectronAPI; }
