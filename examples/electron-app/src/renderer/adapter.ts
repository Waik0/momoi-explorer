// Electron IPC経由のFileSystemAdapterの実装例

import type { FileSystemAdapter, RawWatchEvent } from 'momoi-explorer'

declare global {
  interface Window {
    electronAPI: {
      getCwd(): Promise<string>
      readDir(path: string): Promise<Array<{ name: string; path: string; isDirectory: boolean }>>
      rename(oldPath: string, newPath: string): Promise<void>
      delete(paths: string[]): Promise<void>
      createFile(parentPath: string, name: string): Promise<void>
      createDir(parentPath: string, name: string): Promise<void>
      move(srcPath: string, destDir: string): Promise<void>
      startWatch(path: string): Promise<void>
      stopWatch(path: string): Promise<void>
      onFileChange(callback: (events: RawWatchEvent[]) => void): () => void
    }
  }
}

export function createElectronAdapter(): FileSystemAdapter {
  return {
    readDir: (path) => window.electronAPI.readDir(path),
    rename: (oldPath, newPath) => window.electronAPI.rename(oldPath, newPath),
    delete: (paths) => window.electronAPI.delete(paths),
    createFile: (parentPath, name) => window.electronAPI.createFile(parentPath, name),
    createDir: (parentPath, name) => window.electronAPI.createDir(parentPath, name),
    move: (srcPath, destDir) => window.electronAPI.move(srcPath, destDir),
    watch(path, callback) {
      const removeListener = window.electronAPI.onFileChange(callback)
      window.electronAPI.startWatch(path)
      return () => {
        removeListener()
        window.electronAPI.stopWatch(path)
      }
    },
  }
}
