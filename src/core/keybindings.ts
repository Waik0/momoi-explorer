// エクスプローラー用のコマンドIDとデフォルトキーバインド定義
//
// momoi-keybind の KeybindingEntry 互換の形式でエクスポートする。
// momoi-keybind が無くても型として参照できるように、独自の型を定義。

/** momoi-keybind の KeybindingEntry と互換の型 */
export interface ExplorerKeybindingEntry {
  key: string
  command: string
  when?: string
  args?: unknown
}

/** エクスプローラーのコマンドID */
export const ExplorerCommands = {
  DELETE: 'explorer.delete',
  RENAME: 'explorer.rename',
  NEW_FILE: 'explorer.newFile',
  NEW_FOLDER: 'explorer.newFolder',
  REFRESH: 'explorer.refresh',
  COLLAPSE_ALL: 'explorer.collapseAll',
  SELECT_ALL: 'explorer.selectAll',
  COPY_PATH: 'explorer.copyPath',
} as const

export type ExplorerCommandId = (typeof ExplorerCommands)[keyof typeof ExplorerCommands]

/** デフォルトのキーバインド定義。momoi-keybindのInputServiceに渡せる形式 */
export const defaultExplorerKeybindings: ExplorerKeybindingEntry[] = [
  { key: 'Delete', command: ExplorerCommands.DELETE, when: 'explorerFocus' },
  { key: 'F2', command: ExplorerCommands.RENAME, when: 'explorerFocus' },
  { key: 'Ctrl+N', command: ExplorerCommands.NEW_FILE, when: 'explorerFocus' },
  { key: 'Ctrl+Shift+N', command: ExplorerCommands.NEW_FOLDER, when: 'explorerFocus' },
  { key: 'Ctrl+R', command: ExplorerCommands.REFRESH, when: 'explorerFocus' },
  { key: 'Ctrl+Shift+E', command: ExplorerCommands.COLLAPSE_ALL, when: 'explorerFocus' },
  { key: 'Ctrl+A', command: ExplorerCommands.SELECT_ALL, when: 'explorerFocus' },
  { key: 'Ctrl+Shift+C', command: ExplorerCommands.COPY_PATH, when: 'explorerFocus' },
]
