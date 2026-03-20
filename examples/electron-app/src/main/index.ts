import { app, BrowserWindow, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 400,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

// IPC: ディレクトリ読み取り
ipcMain.handle('readDir', async (_event, dirPath: string) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  return entries
    .filter((e) => !e.name.startsWith('.'))
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

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
