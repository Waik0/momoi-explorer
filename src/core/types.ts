// momoi-explorer core types
//
// フレームワーク非依存の型定義

// ============================================================
// FileSystemAdapter - ユーザーが実装する唯一の必須インターフェース
// ============================================================

export interface FileSystemAdapter {
  /** ディレクトリの中身を読み取る */
  readDir(path: string): Promise<FileEntry[]>
  /** ファイル/フォルダのリネーム */
  rename?(oldPath: string, newPath: string): Promise<void>
  /** ファイル/フォルダの削除 */
  delete?(paths: string[]): Promise<void>
  /** ファイル作成 */
  createFile?(parentPath: string, name: string): Promise<void>
  /** フォルダ作成 */
  createDir?(parentPath: string, name: string): Promise<void>
  /**
   * ファイル変更監視
   * 生イベントを投げるだけでOK。デバウンス・合体・スロットリングはコアが行う。
   * @returns unwatch関数
   */
  watch?(path: string, callback: (events: RawWatchEvent[]) => void): () => void
}

// ============================================================
// ファイルエントリ
// ============================================================

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  /** ユーザー拡張用（gitStatus, iconHint 等） */
  meta?: Record<string, unknown>
}

// ============================================================
// ツリーノード（内部用、FileEntryを拡張）
// ============================================================

export interface TreeNode extends FileEntry {
  depth: number
  children?: TreeNode[]
  childrenLoaded: boolean
}

// ============================================================
// フラットリスト（仮想スクロール用）
// ============================================================

export interface FlatNode {
  node: TreeNode
  depth: number
}

// ============================================================
// ツリー状態
// ============================================================

export interface CreatingState {
  /** 新規アイテムを作成する親ディレクトリのパス */
  parentPath: string
  /** ファイルかフォルダか */
  isDirectory: boolean
}

export interface TreeState {
  rootPath: string
  rootNodes: TreeNode[]
  expandedPaths: Set<string>
  selectedPaths: Set<string>
  anchorPath: string | null
  renamingPath: string | null
  creatingState: CreatingState | null
  searchQuery: string | null
  flatList: FlatNode[]
}

// ============================================================
// ウォッチイベント
// ============================================================

/** アダプタから来る生イベント */
export interface RawWatchEvent {
  type: 'create' | 'modify' | 'delete' | 'rename'
  path: string
  newPath?: string
  isDirectory: boolean
}

/** コア内部で合体処理後のイベント */
export interface WatchEvent {
  type: 'create' | 'modify' | 'delete'
  path: string
  isDirectory: boolean
}

// ============================================================
// ツリーイベント（外部通知用）
// ============================================================

export type TreeEvent =
  | { type: 'expand'; path: string }
  | { type: 'collapse'; path: string }
  | { type: 'select'; paths: string[] }
  | { type: 'open'; path: string }
  | { type: 'rename'; oldPath: string; newPath: string }
  | { type: 'delete'; paths: string[] }
  | { type: 'create'; parentPath: string; name: string; isDirectory: boolean }
  | { type: 'refresh'; path?: string }
  | { type: 'external-change'; changes: WatchEvent[] }

// ============================================================
// コンテキストメニュー
// ============================================================

export interface MenuItemDef {
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  separator?: boolean
  action: (targets: TreeNode[]) => void
}

// ============================================================
// ウォッチオプション
// ============================================================

export interface WatchOptions {
  /** デバウンス時間(ms)。デフォルト: 75 (VSCode準拠) */
  debounceMs?: number
  /** イベント合体を行うか。デフォルト: true */
  coalesce?: boolean
  /** スロットリング設定 */
  throttle?: {
    /** 一度に処理するイベント上限。デフォルト: 500 */
    maxChunkSize: number
    /** チャンク間の休止時間(ms)。デフォルト: 200 */
    delayMs: number
  }
}

// ============================================================
// createFileTree のオプション
// ============================================================

export interface FileTreeOptions {
  adapter: FileSystemAdapter
  rootPath: string
  sort?: (a: FileEntry, b: FileEntry) => number
  filter?: (entry: FileEntry) => boolean
  watchOptions?: WatchOptions
  onEvent?: (event: TreeEvent) => void
}

// ============================================================
// FileTreeController
// ============================================================

export interface FileTreeController {
  // 状態
  getState(): TreeState
  subscribe(listener: (state: TreeState) => void): () => void

  // ツリー操作
  loadRoot(): Promise<void>
  expand(path: string): Promise<void>
  collapse(path: string): void
  toggleExpand(path: string): Promise<void>
  expandTo(path: string): Promise<void>

  // 選択
  select(path: string, mode?: 'replace' | 'toggle' | 'range'): void
  selectAll(): void
  clearSelection(): void

  // 編集
  startRename(path: string): void
  commitRename(newName: string): Promise<void>
  cancelRename(): void
  startCreate(parentPath: string, isDirectory: boolean): Promise<void>
  commitCreate(name: string): Promise<void>
  cancelCreate(): void
  createFile(parentPath: string, name: string): Promise<void>
  createDir(parentPath: string, name: string): Promise<void>
  deleteSelected(): Promise<void>

  // リフレッシュ
  refresh(path?: string): Promise<void>

  // 検索
  setSearchQuery(query: string | null): void
  collectAllFiles(): Promise<FileEntry[]>

  // フィルタ・ソート
  setFilter(fn: ((entry: FileEntry) => boolean) | null): void
  setSort(fn: ((a: FileEntry, b: FileEntry) => number) | null): void

  // 破棄
  destroy(): void
}
