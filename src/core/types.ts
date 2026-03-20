// momoi-explorer core types
//
// フレームワーク非依存の型定義

// ============================================================
// FileSystemAdapter - ユーザーが実装する唯一の必須インターフェース
// ============================================================

/**
 * ファイルシステムへのアクセスを抽象化するアダプタインターフェース。
 * ユーザーはこのインターフェースを実装してcreateFileTreeに渡す。
 * `readDir` のみ必須。その他のメソッドはオプションで、対応する機能が有効になる。
 *
 * @example
 * ```ts
 * import { FileSystemAdapter } from 'momoi-explorer'
 * import fs from 'node:fs/promises'
 * import path from 'node:path'
 *
 * const adapter: FileSystemAdapter = {
 *   async readDir(dirPath) {
 *     const entries = await fs.readdir(dirPath, { withFileTypes: true })
 *     return entries.map(e => ({
 *       name: e.name,
 *       path: path.join(dirPath, e.name),
 *       isDirectory: e.isDirectory(),
 *     }))
 *   },
 *   async rename(oldPath, newPath) { await fs.rename(oldPath, newPath) },
 *   async delete(paths) { for (const p of paths) await fs.rm(p, { recursive: true }) },
 * }
 * ```
 */
export interface FileSystemAdapter {
  /**
   * ディレクトリの中身を読み取る。唯一の必須メソッド。
   * @param path - 読み取るディレクトリの絶対パス
   * @returns ディレクトリ内のFileEntryの配列
   */
  readDir(path: string): Promise<FileEntry[]>
  /**
   * ファイルまたはフォルダをリネームする。
   * 実装するとUI上でリネーム操作が可能になる。
   * @param oldPath - リネーム前の絶対パス
   * @param newPath - リネーム後の絶対パス
   */
  rename?(oldPath: string, newPath: string): Promise<void>
  /**
   * ファイルまたはフォルダを削除する。
   * 実装すると選択アイテムの削除操作が可能になる。
   * @param paths - 削除対象の絶対パスの配列
   */
  delete?(paths: string[]): Promise<void>
  /**
   * ファイルを新規作成する。
   * 実装するとUI上でファイル作成操作が可能になる。
   * @param parentPath - 作成先の親ディレクトリの絶対パス
   * @param name - 新規ファイル名
   */
  createFile?(parentPath: string, name: string): Promise<void>
  /**
   * フォルダを新規作成する。
   * 実装するとUI上でフォルダ作成操作が可能になる。
   * @param parentPath - 作成先の親ディレクトリの絶対パス
   * @param name - 新規フォルダ名
   */
  createDir?(parentPath: string, name: string): Promise<void>
  /**
   * ファイル変更監視を開始する。
   * 生イベントを投げるだけでOK。デバウンス・合体・スロットリングはコアが行う。
   * @param path - 監視するディレクトリの絶対パス
   * @param callback - 生イベントを受け取るコールバック
   * @returns 監視を停止するunwatch関数
   */
  watch?(path: string, callback: (events: RawWatchEvent[]) => void): () => void
}

// ============================================================
// ファイルエントリ
// ============================================================

/**
 * ファイルまたはフォルダを表すエントリ。
 * `readDir` の戻り値として使用される基本データ型。
 */
export interface FileEntry {
  /** ファイル名（拡張子含む） */
  name: string
  /** 絶対パス */
  path: string
  /** ディレクトリならtrue */
  isDirectory: boolean
  /**
   * ユーザー拡張用のメタデータ。
   * gitStatus, iconHint 等、任意のデータを格納できる。
   */
  meta?: Record<string, unknown>
}

// ============================================================
// ツリーノード（内部用、FileEntryを拡張）
// ============================================================

/**
 * コア内部で使用されるツリーノード。FileEntryにツリー構造の情報を追加したもの。
 * flatList内のFlatNode.nodeとしても参照される。
 */
export interface TreeNode extends FileEntry {
  /** ルートからの深さ（ルート直下 = 0） */
  depth: number
  /** 子ノード。ディレクトリで未読み込みの場合はundefined */
  children?: TreeNode[]
  /** 子ノードが読み込み済みかどうか */
  childrenLoaded: boolean
}

// ============================================================
// フラットリスト（仮想スクロール用）
// ============================================================

/**
 * 仮想スクロール用のフラットリスト要素。
 * ツリーを展開状態に基づいて一次元配列に変換したもの。
 */
export interface FlatNode {
  /** 対応するツリーノード */
  node: TreeNode
  /** 表示上の深さ（インデント計算に使用） */
  depth: number
}

// ============================================================
// ツリー状態
// ============================================================

/**
 * ツリー全体の現在状態。subscribeで購読可能。
 * 不変(immutable)として扱い、変更時は新しいオブジェクトが生成される。
 */
export interface TreeState {
  /** ルートディレクトリの絶対パス */
  rootPath: string
  /** ルート直下のツリーノード配列 */
  rootNodes: TreeNode[]
  /** 現在展開中のディレクトリパスのセット */
  expandedPaths: Set<string>
  /** 現在選択中のパスのセット */
  selectedPaths: Set<string>
  /** 範囲選択の起点パス（Shift+Click用） */
  anchorPath: string | null
  /** 現在リネーム中のパス。nullならリネームモードではない */
  renamingPath: string | null
  /** 現在の検索クエリ。nullなら検索なし */
  searchQuery: string | null
  /** 仮想スクロール用のフラットリスト（展開・検索状態を反映） */
  flatList: FlatNode[]
}

// ============================================================
// ウォッチイベント
// ============================================================

/**
 * アダプタのwatchから来る生のファイル監視イベント。
 * renameイベントはnewPathを持つ。コアが合体処理を行う。
 */
export interface RawWatchEvent {
  /** イベント種別 */
  type: 'create' | 'modify' | 'delete' | 'rename'
  /** 対象パス（renameの場合はリネーム前のパス） */
  path: string
  /** renameの場合のリネーム後パス */
  newPath?: string
  /** 対象がディレクトリかどうか */
  isDirectory: boolean
}

/**
 * コア内部で合体処理後のイベント。
 * renameはdelete+createに分解され、同一パスのイベントは合体される。
 */
export interface WatchEvent {
  /** イベント種別（renameは含まない） */
  type: 'create' | 'modify' | 'delete'
  /** 対象パス */
  path: string
  /** 対象がディレクトリかどうか */
  isDirectory: boolean
}

// ============================================================
// ツリーイベント（外部通知用）
// ============================================================

/**
 * ツリー操作や外部変更をUI層に通知するためのイベント型。
 * `FileTreeOptions.onEvent` で購読できる。
 *
 * - `expand` / `collapse` - ディレクトリの展開/折りたたみ
 * - `select` - 選択変更
 * - `open` - ファイルを開く
 * - `rename` - リネーム完了
 * - `delete` - 削除完了
 * - `create` - ファイル/フォルダ作成完了
 * - `refresh` - ツリーのリフレッシュ
 * - `external-change` - ファイル監視による外部変更検出
 */
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

/**
 * コンテキストメニューの項目定義。
 * UI層でメニュー表示に使用する。
 */
export interface MenuItemDef {
  /** メニュー項目の一意識別子 */
  id: string
  /** 表示ラベル */
  label: string
  /** キーボードショートカットの表示文字列（例: "Ctrl+C"） */
  shortcut?: string
  /** trueなら項目を無効化（グレーアウト） */
  disabled?: boolean
  /** trueならこの項目の前にセパレータを表示 */
  separator?: boolean
  /**
   * メニュー選択時に実行されるアクション。
   * @param targets - 右クリック対象のノード配列
   */
  action: (targets: TreeNode[]) => void
}

// ============================================================
// ウォッチオプション
// ============================================================

/**
 * ファイル監視の動作設定。
 * createFileTreeのoptionsで指定する。
 */
export interface WatchOptions {
  /** デバウンス時間(ms)。デフォルト: 75 (VSCode準拠) */
  debounceMs?: number
  /** イベント合体を行うか。デフォルト: true */
  coalesce?: boolean
  /** スロットリング設定。大量イベント発生時にチャンク分割する */
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

/**
 * {@link createFileTree} の初期化オプション。
 */
export interface FileTreeOptions {
  /** ファイルシステムアダプタ（必須） */
  adapter: FileSystemAdapter
  /** ツリーのルートディレクトリの絶対パス */
  rootPath: string
  /** カスタムソート関数。未指定時はフォルダ優先・名前昇順 */
  sort?: (a: FileEntry, b: FileEntry) => number
  /** カスタムフィルタ関数。falseを返すエントリは非表示になる */
  filter?: (entry: FileEntry) => boolean
  /** ファイル監視のオプション */
  watchOptions?: WatchOptions
  /** ツリー操作イベントのコールバック */
  onEvent?: (event: TreeEvent) => void
}

// ============================================================
// FileTreeController
// ============================================================

/**
 * ヘッドレスファイルツリーのメインコントローラ。
 * {@link createFileTree} から返される。状態購読・ツリー操作・編集・検索などの全APIを提供する。
 */
export interface FileTreeController {
  // -- 状態 --

  /**
   * 現在のツリー状態を取得する。
   * @returns 現在のTreeState
   */
  getState(): TreeState
  /**
   * 状態変更を購読する。状態が変わるたびにlistenerが呼ばれる。
   * @param listener - 状態変更時に呼ばれるコールバック
   * @returns 購読解除関数
   */
  subscribe(listener: (state: TreeState) => void): () => void

  // -- ツリー操作 --

  /**
   * ルートディレクトリを読み込み、ツリーを初期化する。
   * ファイル監視もここで開始される。最初に必ず呼ぶこと。
   */
  loadRoot(): Promise<void>
  /**
   * 指定パスのディレクトリを展開する。未読み込みなら子を読み込む。
   * @param path - 展開するディレクトリの絶対パス
   */
  expand(path: string): Promise<void>
  /**
   * 指定パスのディレクトリを折りたたむ。
   * @param path - 折りたたむディレクトリの絶対パス
   */
  collapse(path: string): void
  /**
   * 展開/折りたたみをトグルする。
   * @param path - 対象ディレクトリの絶対パス
   */
  toggleExpand(path: string): Promise<void>
  /**
   * 指定パスまでの祖先ディレクトリをすべて展開する。
   * ファイルを可視状態にしたい場合に使用する。
   * @param path - 表示したいノードの絶対パス
   */
  expandTo(path: string): Promise<void>

  // -- 選択 --

  /**
   * ノードを選択する。
   * @param path - 選択するノードの絶対パス
   * @param mode - 選択モード。'replace'=単一選択、'toggle'=Ctrl+Click、'range'=Shift+Click
   */
  select(path: string, mode?: 'replace' | 'toggle' | 'range'): void
  /** flatList内の全ノードを選択する */
  selectAll(): void
  /** 選択をすべて解除する */
  clearSelection(): void

  // -- 編集 --

  /**
   * リネームモードを開始する。UIはこの状態を検知してインライン編集UIを表示する。
   * @param path - リネーム対象の絶対パス
   */
  startRename(path: string): void
  /**
   * リネームを確定する。adapter.renameが呼ばれ、親ディレクトリがリフレッシュされる。
   * @param newName - 新しいファイル名（パスではなく名前のみ）
   */
  commitRename(newName: string): Promise<void>
  /** リネームをキャンセルする */
  cancelRename(): void
  /**
   * ファイルを新規作成する。adapter.createFileが呼ばれる。
   * @param parentPath - 作成先の親ディレクトリの絶対パス
   * @param name - 新規ファイル名
   */
  createFile(parentPath: string, name: string): Promise<void>
  /**
   * フォルダを新規作成する。adapter.createDirが呼ばれる。
   * @param parentPath - 作成先の親ディレクトリの絶対パス
   * @param name - 新規フォルダ名
   */
  createDir(parentPath: string, name: string): Promise<void>
  /** 選択中のアイテムをすべて削除する。adapter.deleteが呼ばれる */
  deleteSelected(): Promise<void>

  // -- リフレッシュ --

  /**
   * ツリーを再読み込みする。展開状態は保持される。
   * @param path - リフレッシュ対象のディレクトリ。省略時はルート全体
   */
  refresh(path?: string): Promise<void>

  // -- 検索 --

  /**
   * ファジー検索クエリを設定する。flatListがフィルタされマッチしたノードのみ表示される。
   * @param query - 検索文字列。nullで検索解除
   */
  setSearchQuery(query: string | null): void
  /**
   * ツリー配下の全ファイルを再帰的に収集する。
   * fuzzyFind等で全ファイル検索を行う際の入力データとして使用する。
   * @returns 全FileEntryの配列
   */
  collectAllFiles(): Promise<FileEntry[]>

  // -- フィルタ・ソート --

  /**
   * フィルタ関数を動的に変更する。既存ノードにも即座に適用される。
   * @param fn - フィルタ関数。nullでフィルタ解除
   */
  setFilter(fn: ((entry: FileEntry) => boolean) | null): void
  /**
   * ソート関数を動的に変更する。既存ノードにも即座に適用される。
   * @param fn - ソート関数。nullでデフォルトソートに戻す
   */
  setSort(fn: ((a: FileEntry, b: FileEntry) => number) | null): void

  // -- 破棄 --

  /** コントローラを破棄する。ファイル監視を停止し、購読をすべて解除する */
  destroy(): void
}
