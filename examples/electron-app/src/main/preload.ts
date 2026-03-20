import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  readDir: (path: string) => ipcRenderer.invoke('readDir', path),
  rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('rename', oldPath, newPath),
  delete: (paths: string[]) => ipcRenderer.invoke('delete', paths),
  createFile: (parentPath: string, name: string) => ipcRenderer.invoke('createFile', parentPath, name),
  createDir: (parentPath: string, name: string) => ipcRenderer.invoke('createDir', parentPath, name),
})
