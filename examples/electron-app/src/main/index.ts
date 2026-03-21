import { app, BrowserWindow, ipcMain } from 'electron'
import { promises as fs, watch as fsWatch, statSync } from 'fs'
import path from 'path'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

// IPC: カレントディレクトリ取得
ipcMain.handle('getCwd', () => process.cwd())

// IPC: ディレクトリ読み取り
ipcMain.handle('readDir', async (_event, dirPath: string) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  return entries
    .map((e) => ({
      name: e.name,
      path: path.join(dirPath, e.name),
      isDirectory: e.isDirectory(),
    }))
})

// IPC: ファイル/フォルダリネーム
ipcMain.handle('rename', async (_event, oldPath: string, newPath: string) => {
  await fs.rename(oldPath, newPath)
})

// IPC: 削除
ipcMain.handle('delete', async (_event, paths: string[]) => {
  for (const p of paths) {
    await fs.rm(p, { recursive: true })
  }
})

// IPC: ファイル作成
ipcMain.handle('createFile', async (_event, parentPath: string, name: string) => {
  await fs.writeFile(path.join(parentPath, name), '')
})

// IPC: フォルダ作成
ipcMain.handle('createDir', async (_event, parentPath: string, name: string) => {
  await fs.mkdir(path.join(parentPath, name))
})

// IPC: ファイル/フォルダ移動
ipcMain.handle('move', async (_event, srcPath: string, destDir: string) => {
  const name = path.basename(srcPath)
  await fs.rename(srcPath, path.join(destDir, name))
})

// ファイル監視
const watchers = new Map<string, ReturnType<typeof fsWatch>>()

ipcMain.handle('startWatch', (_event, watchPath: string) => {
  if (watchers.has(watchPath)) return

  try {
    const watcher = fsWatch(watchPath, { recursive: true }, (eventType, filename) => {
      if (!filename || !mainWindow) return

      const fullPath = path.join(watchPath, filename)
      let isDirectory = false
      let changeType: 'create' | 'modify' | 'delete' = 'modify'

      try {
        const stat = statSync(fullPath)
        isDirectory = stat.isDirectory()
        changeType = eventType === 'rename' ? 'create' : 'modify'
      } catch {
        // ファイルが存在しない → 削除
        changeType = 'delete'
      }

      mainWindow.webContents.send('file-change', [{
        type: changeType,
        path: fullPath,
        isDirectory,
      }])
    })

    watchers.set(watchPath, watcher)
  } catch (err) {
    console.error('Watch failed:', err)
  }
})

ipcMain.handle('stopWatch', (_event, watchPath: string) => {
  const watcher = watchers.get(watchPath)
  if (watcher) {
    watcher.close()
    watchers.delete(watchPath)
  }
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  for (const watcher of watchers.values()) {
    watcher.close()
  }
  watchers.clear()
  app.quit()
})
