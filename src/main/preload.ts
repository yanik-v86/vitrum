import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  readFolder: (p: string) => ipcRenderer.invoke('readFolder', p),
  readFileAsDataUrl: (p: string) => ipcRenderer.invoke('readFileAsDataUrl', p),
  savePack: (p: any) => ipcRenderer.invoke('savePack', p),
  loadPacks: () => ipcRenderer.invoke('loadPacks'),
  deletePack: (n: string) => ipcRenderer.invoke('deletePack', n),
  loadDefaultIcons: () => ipcRenderer.invoke('loadDefaultIcons'),
});
