import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getCwd: () => ipcRenderer.invoke('getCwd'),
  readDir: (path: string) => ipcRenderer.invoke('readDir', path),
  rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('rename', oldPath, newPath),
  delete: (paths: string[]) => ipcRenderer.invoke('delete', paths),
  createFile: (parentPath: string, name: string) => ipcRenderer.invoke('createFile', parentPath, name),
  createDir: (parentPath: string, name: string) => ipcRenderer.invoke('createDir', parentPath, name),
  move: (srcPath: string, destDir: string) => ipcRenderer.invoke('move', srcPath, destDir),
  startWatch: (path: string) => ipcRenderer.invoke('startWatch', path),
  stopWatch: (path: string) => ipcRenderer.invoke('stopWatch', path),
  onFileChange: (callback: (events: Array<{ type: string; path: string; isDirectory: boolean }>) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, events: Array<{ type: string; path: string; isDirectory: boolean }>) => callback(events)
    ipcRenderer.on('file-change', handler)
    return () => ipcRenderer.removeListener('file-change', handler)
  },
})
