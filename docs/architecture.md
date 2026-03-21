# momoi_explorer -- アーキテクチャ設計書

## 1. パッケージ全体のフォルダ構成

```
momoi_explorer/
├── package.json                 # ルートワークスペース定義
├── pnpm-workspace.yaml          # pnpmワークスペース設定
├── tsconfig.base.json           # 共有TypeScript設定
├── turbo.json                   # Turborepo設定
├── .gitignore
├── CLAUDE.md
├── docs/
│   └── architecture.md          # この設計書
│
├── packages/
│   ├── core/                    # @momoi-explorer/core
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts       # バンドル設定
│   │   └── src/
│   │       ├── index.ts                 # パブリックAPI再エクスポート
│   │       ├── types.ts                 # 全型定義
│   │       ├── tree-state.ts            # ツリー状態管理（メインクラス）
│   │       ├── tree-flattener.ts        # ツリー → フラットリスト変換
│   │       ├── tree-operations.ts       # ツリーの不変更新操作ユーティリティ
│   │       ├── tree-keyboard.ts         # キーボードナビゲーション
│   │       ├── selection.ts             # 選択ロジック（単一/Ctrl/Shift）
│   │       ├── sort.ts                  # ソートロジック
│   │       ├── filter.ts               # フィルター/除外パターン
│   │       ├── event-emitter.ts         # 型安全イベントエミッター
│   │       └── utils.ts                 # パスユーティリティ等
│   │
│   ├── react/                   # @momoi-explorer/react
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/
│   │       ├── index.ts                 # パブリックAPI再エクスポート
│   │       ├── hooks/
│   │       │   ├── use-file-tree.ts     # coreとReactを接続するメインhook
│   │       │   ├── use-context-menu.ts  # コンテキストメニュー状態管理
│   │       │   └── use-inline-edit.ts   # インラインリネーム/作成状態管理
│   │       ├── components/
│   │       │   ├── TreeView.tsx         # メインコンテナ（仮想スクロール統合）
│   │       │   ├── TreeRow.tsx          # 1行のレンダリング
│   │       │   ├── ContextMenu.tsx      # コンテキストメニューUI
│   │       │   ├── InlineInput.tsx      # インライン入力（リネーム/新規作成）
│   │       │   ├── IndentGuides.tsx     # インデントガイド
│   │       │   └── DefaultIcons.tsx     # デフォルトSVGアイコン（chevron, folder）
│   │       └── styles/
│   │           └── tree-view.css        # CSS変数ベースのデフォルトスタイル
│   │
│   └── sample/                  # @momoi-explorer/sample
│       ├── package.json
│       ├── tsconfig.json
│       ├── electron-builder.json
│       ├── vite.config.ts
│       └── src/
│           ├── main/
│           │   ├── main.ts              # Electronメインプロセス
│           │   ├── preload.ts           # preloadスクリプト
│           │   └── fs-provider.ts       # Node.js FileSystemProvider実装
│           └── renderer/
│               ├── index.html
│               ├── App.tsx              # サンプルアプリ
│               └── electron-provider.ts # IPC経由FileSystemProvider
```


## 2. @momoi-explorer/core -- 主要インターフェース定義

### 2.1 基本データ型

```typescript
// ============================================================
// types.ts -- 全型定義
// ============================================================

// --------------------------------------------------
// ツリーノード
// --------------------------------------------------

/** ファイルツリーの1ノード（ファイルまたはディレクトリ） */
export interface TreeNode {
    /** 表示名（例: "index.ts"） */
    name: string;
    /** ルートからの相対パス（例: "src/index.ts"） */
    path: string;
    /** ディレクトリか否か */
    isDirectory: boolean;
    /** 子ノード（undefined = 未読み込み） */
    children?: TreeNode[];
    /** 子の読み込みが完了しているか */
    childrenLoaded?: boolean;
}

/** フラット化されたノード（仮想スクロール用） */
export interface FlatNode {
    /** 元のTreeNodeへの参照 */
    node: TreeNode;
    /** ツリーの深さ（0始まり） */
    depth: number;
}

// --------------------------------------------------
// デコレーション
// --------------------------------------------------

/** ノードに付与する装飾（バッジ、色など） */
export interface Decoration {
    /** バッジテキスト（例: "M", "U", "3"） */
    badge?: string;
    /** バッジの色（CSS色値） */
    badgeColor?: string;
    /** ノード名のテキスト色 */
    foregroundColor?: string;
    /** 不透明度 0.0-1.0（gitIgnored等で薄く表示） */
    opacity?: number;
    /** ツールチップテキスト */
    tooltip?: string;
}

// --------------------------------------------------
// コンテキストメニュー
// --------------------------------------------------

/** コンテキストメニューの1項目 */
export interface ContextMenuItem {
    /** 表示ラベル */
    label: string;
    /** アクション識別子 */
    action: string;
    /** セパレータとして表示するか */
    separator?: boolean;
    /** 無効状態か */
    disabled?: boolean;
    /** アイコン（オプション） */
    icon?: string;
    /** キーボードショートカット表示（例: "F2"） */
    shortcut?: string;
}

// --------------------------------------------------
// ソート
// --------------------------------------------------

/** ソート順 */
export type SortOrder = 'asc' | 'desc';

/** 組み込みソートキー */
export type BuiltinSortKey = 'name' | 'type' | 'modified';

/** ソート設定 */
export interface SortConfig {
    /** ソートキー（組み込み or カスタム文字列） */
    key: string;
    /** 昇順/降順 */
    order: SortOrder;
    /** ディレクトリを常に先頭にするか（デフォルト: true） */
    directoriesFirst?: boolean;
}

// --------------------------------------------------
// 選択
// --------------------------------------------------

/** 選択モード */
export type SelectionMode = 'single' | 'ctrl' | 'shift';

// --------------------------------------------------
// イベント
// --------------------------------------------------

/** ツリーで発生する全イベントの型マップ */
export interface TreeEventMap {
    /** ノードが選択された */
    select: { paths: string[]; node: TreeNode | null };
    /** フォルダが展開された */
    expand: { path: string; node: TreeNode };
    /** フォルダが折りたたまれた */
    collapse: { path: string; node: TreeNode };
    /** ファイルがアクティベートされた（ダブルクリック / Enter） */
    activate: { path: string; node: TreeNode };
    /** リネームが要求された */
    rename: { oldPath: string; newName: string };
    /** 削除が要求された */
    delete: { paths: string[] };
    /** 新規作成が要求された */
    create: { parentPath: string; name: string; isDirectory: boolean };
    /** コンテキストメニューアクションが実行された */
    contextMenuAction: { action: string; paths: string[]; node: TreeNode | null };
    /** ツリー状態が変更された（React等の外部フレームワークへの通知用） */
    stateChange: { snapshot: TreeStateSnapshot };
    /** フォーカスが変更された */
    focus: { path: string | null };
    /** ファイルシステムの外部変更を検知 */
    externalChange: { rootPath: string };
}

// --------------------------------------------------
// ツリー状態スナップショット
// --------------------------------------------------

/** ツリーの現在状態（イミュータブルなスナップショット） */
export interface TreeStateSnapshot {
    /** ルートノード群 */
    roots: TreeNode[];
    /** 展開中のフォルダパス */
    expandedPaths: ReadonlySet<string>;
    /** 選択中のパス群 */
    selectedPaths: ReadonlySet<string>;
    /** フォーカス中のパス */
    focusedPath: string | null;
    /** フラット化されたリスト（仮想スクロール用） */
    flatList: readonly FlatNode[];
    /** 読み込み中のパス群 */
    loadingPaths: ReadonlySet<string>;
    /** フィルターテキスト */
    filterText: string;
}
```

### 2.2 プロバイダーインターフェース

```typescript
// ============================================================
// types.ts (続き) -- プロバイダーインターフェース
// ============================================================

// --------------------------------------------------
// FileSystemProvider
// --------------------------------------------------

/** ディレクトリ読み取り結果のエントリ */
export interface DirectoryEntry {
    name: string;
    isDirectory: boolean;
}

/**
 * ファイルシステムへのアクセスを抽象化するプロバイダー。
 * Electron IPC、ブラウザ Fetch API、インメモリ実装などに差し替え可能。
 */
export interface FileSystemProvider {
    /**
     * ディレクトリの直下エントリ一覧を返す。
     * @param path 絶対パスまたはプロバイダーが解釈できるパス
     * @returns エントリ一覧
     */
    readDirectory(path: string): Promise<DirectoryEntry[]>;

    /**
     * ファイル/フォルダを新しい名前に変更する。
     * @returns 成功時にvoid解決。失敗時にreject。
     */
    rename?(oldPath: string, newPath: string): Promise<void>;

    /**
     * ファイル/フォルダを削除する。
     * @param paths 削除対象のパス群（複数選択対応）
     */
    delete?(paths: string[]): Promise<void>;

    /**
     * 空ファイルを作成する。
     */
    createFile?(path: string): Promise<void>;

    /**
     * ディレクトリを作成する。
     */
    createDirectory?(path: string): Promise<void>;

    /**
     * ファイル名でワークスペース全体を再帰検索する。
     * @param rootPath 検索ルート
     * @param query 検索文字列
     * @param maxResults 最大結果数
     * @returns マッチしたファイルの相対パス配列
     */
    search?(rootPath: string, query: string, maxResults?: number): Promise<string[]>;

    /**
     * パスをOS標準のファイルマネージャーで表示する。
     */
    revealInOS?(path: string): Promise<void>;
}

// --------------------------------------------------
// DecorationProvider
// --------------------------------------------------

/**
 * ツリーノードにデコレーション（バッジ、色等）を付与するプロバイダー。
 * Git状態、LSP診断エラー数など、用途別に複数登録可能。
 */
export interface DecorationProvider {
    /** このプロバイダーの識別子 */
    id: string;

    /**
     * 指定ノードのデコレーションを返す。
     * nullを返すとこのプロバイダーからのデコレーションなし。
     */
    getDecoration(node: TreeNode): Decoration | null;

    /**
     * デコレーションが変更されたときに呼ばれるコールバックを登録する。
     * coreはこのコールバック経由でUIの再描画を要求する。
     * @returns 登録解除関数
     */
    onDidChange?(callback: () => void): () => void;
}

// --------------------------------------------------
// ContextMenuProvider
// --------------------------------------------------

/**
 * コンテキストメニュー項目を提供するプロバイダー。
 * 複数登録可能で、結果はマージされる。
 */
export interface ContextMenuProvider {
    /** このプロバイダーの識別子 */
    id: string;

    /**
     * 指定されたコンテキストに対するメニュー項目を返す。
     * @param context.nodes 右クリックされたノード群（複数選択時は複数）
     * @param context.isBackground 背景（空白部分）を右クリックしたか
     * @returns メニュー項目の配列
     */
    getItems(context: ContextMenuContext): ContextMenuItem[];
}

/** コンテキストメニューが表示される状況 */
export interface ContextMenuContext {
    /** 右クリック対象のノード群 */
    nodes: TreeNode[];
    /** 背景右クリックか */
    isBackground: boolean;
    /** 現在の選択パス群 */
    selectedPaths: ReadonlySet<string>;
}

// --------------------------------------------------
// SortProvider（カスタムソート）
// --------------------------------------------------

/**
 * カスタムソート関数。組み込みソートで不十分な場合に使用。
 * @returns 負 / 0 / 正（Array.sort準拠）
 */
export type SortComparator = (a: TreeNode, b: TreeNode) => number;
```

### 2.3 ツリー設定

```typescript
// ============================================================
// types.ts (続き) -- 設定
// ============================================================

/** TreeState の構築時設定 */
export interface TreeConfig {
    /** ファイルシステムプロバイダー（必須） */
    provider: FileSystemProvider;

    /** ワークスペースのルートパス（絶対パス） */
    rootPath: string;

    /** デコレーションプロバイダー群 */
    decorations?: DecorationProvider[];

    /** コンテキストメニュープロバイダー群 */
    contextMenuProviders?: ContextMenuProvider[];

    /** ソート設定 */
    sort?: SortConfig;

    /** カスタムソート関数（sortより優先） */
    sortComparator?: SortComparator;

    /** 除外パターン（名前マッチ） */
    excludePatterns?: string[];

    /** パス結合時のセパレータ（デフォルト: '/'） */
    pathSeparator?: string;

    /**
     * 相対パスを絶対パスに変換する関数。
     * 未指定時は rootPath + pathSeparator + relativePath で結合。
     */
    toAbsolutePath?: (relativePath: string) => string;

    /**
     * 絶対パスを相対パスに変換する関数。
     * 未指定時は rootPath プレフィクスを除去。
     */
    toRelativePath?: (absolutePath: string) => string;
}
```

### 2.4 TreeState（メインクラス）

```typescript
// ============================================================
// tree-state.ts -- メインクラス概要
// ============================================================

/**
 * ファイルツリーのヘッドレス状態管理。
 * フレームワーク非依存。外部依存ゼロ。
 *
 * 使い方:
 *   const tree = new TreeState(config);
 *   await tree.loadRoot();
 *   tree.on('stateChange', ({ snapshot }) => renderUI(snapshot));
 */
export class TreeState {
    // ---- 構築 / 破棄 ----

    constructor(config: TreeConfig);

    /** 全リソースを解放（イベントリスナー、デコレーションサブスクリプション等） */
    dispose(): void;

    // ---- 読み込み ----

    /** ルートエントリを読み込む */
    loadRoot(): Promise<void>;

    /** 指定フォルダの子を読み込む（遅延読み込み） */
    loadChildren(folderPath: string): Promise<void>;

    /** 指定フォルダを再読み込みする */
    refreshFolder(folderPath: string): Promise<void>;

    /** 展開中の全フォルダを再読み込みする */
    refreshAll(): Promise<void>;

    // ---- 展開 / 折りたたみ ----

    /** フォルダの展開状態をトグル */
    toggleExpand(folderPath: string): void;

    /** フォルダを展開する */
    expand(folderPath: string): void;

    /** フォルダを折りたたむ */
    collapse(folderPath: string): void;

    /** 全フォルダを折りたたむ */
    collapseAll(): void;

    /** 指定パスの全祖先フォルダを展開し、対象ノードを選択する */
    revealPath(relativePath: string): Promise<void>;

    // ---- 選択 ----

    /** パスを選択する（modeで単一/Ctrl追加/Shift範囲を制御） */
    select(path: string, mode?: SelectionMode): void;

    /** 選択をクリアする */
    clearSelection(): void;

    /** 指定パスが選択中か */
    isSelected(path: string): boolean;

    // ---- フォーカス ----

    /** フォーカスを設定 */
    setFocus(path: string | null): void;

    // ---- フィルター ----

    /** フィルターテキストを設定（空文字でクリア） */
    setFilter(text: string): void;

    /** 除外パターンを更新する */
    setExcludePatterns(patterns: string[]): void;

    // ---- ソート ----

    /** ソート設定を変更する */
    setSort(config: SortConfig): void;

    /** カスタムソート関数を設定する */
    setSortComparator(comparator: SortComparator | null): void;

    // ---- デコレーション ----

    /** デコレーションプロバイダーを追加する */
    addDecorationProvider(provider: DecorationProvider): () => void;

    /** デコレーションプロバイダーを削除する */
    removeDecorationProvider(id: string): void;

    /** 指定ノードの全デコレーションを取得する（マージ済み） */
    getDecorations(node: TreeNode): Decoration[];

    // ---- コンテキストメニュー ----

    /** コンテキストメニュープロバイダーを追加する */
    addContextMenuProvider(provider: ContextMenuProvider): () => void;

    /** コンテキストメニュー項目を取得する */
    getContextMenuItems(context: ContextMenuContext): ContextMenuItem[];

    // ---- キーボード ----

    /**
     * キーボードイベントを処理する。
     * TreeViewコンポーネントからonKeyDownを委譲される。
     * @returns イベントが処理されたか（trueならpreventDefault済み）
     */
    handleKeyDown(event: KeyboardEvent): boolean;

    // ---- 検索 ----

    /**
     * ファイル名検索を実行する。
     * provider.search が実装されていれば使用。
     */
    searchFiles(query: string): Promise<void>;

    /** 検索結果をクリアする */
    clearSearch(): void;

    // ---- ファイル操作 ----

    /** リネームを実行する */
    rename(oldPath: string, newName: string): Promise<void>;

    /** 削除を実行する */
    deleteSelected(): Promise<void>;

    /** 新規ファイル/フォルダを作成する */
    create(parentPath: string, name: string, isDirectory: boolean): Promise<void>;

    // ---- 状態取得 ----

    /** 現在の状態スナップショットを取得する */
    getSnapshot(): TreeStateSnapshot;

    /** 指定パスのノードを探す */
    findNode(path: string): TreeNode | null;

    // ---- イベント ----

    /** イベントリスナーを登録する */
    on<K extends keyof TreeEventMap>(event: K, handler: (data: TreeEventMap[K]) => void): () => void;

    /** イベントリスナーを解除する */
    off<K extends keyof TreeEventMap>(event: K, handler: (data: TreeEventMap[K]) => void): void;

    /** ワンショットイベントリスナー */
    once<K extends keyof TreeEventMap>(event: K, handler: (data: TreeEventMap[K]) => void): () => void;
}
```

### 2.5 イベントエミッター（内部実装）

```typescript
// ============================================================
// event-emitter.ts -- 型安全イベントエミッター
// ============================================================

/**
 * 型安全なイベントエミッター。外部依存ゼロ。
 * TreeStateの内部で使用。
 */
export class TypedEventEmitter<EventMap extends Record<string, unknown>> {
    private listeners: Map<keyof EventMap, Set<(data: any) => void>>;

    on<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void): () => void;
    off<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void): void;
    once<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void): () => void;
    emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void;
    removeAllListeners(): void;
}
```


## 3. @momoi-explorer/react -- コンポーネントとhooksのAPI

### 3.1 useFileTree hook

```typescript
// ============================================================
// hooks/use-file-tree.ts
// ============================================================

export interface UseFileTreeOptions {
    /** ワークスペースルートパス */
    rootPath: string;
    /** ファイルシステムプロバイダー */
    provider: FileSystemProvider;
    /** デコレーションプロバイダー群 */
    decorations?: DecorationProvider[];
    /** コンテキストメニュープロバイダー群 */
    contextMenuProviders?: ContextMenuProvider[];
    /** ソート設定 */
    sort?: SortConfig;
    /** カスタムソート関数 */
    sortComparator?: SortComparator;
    /** 除外パターン */
    excludePatterns?: string[];
    /** パスセパレータ */
    pathSeparator?: string;
    /** 絶対パス変換関数 */
    toAbsolutePath?: (relativePath: string) => string;
    /** 相対パス変換関数 */
    toRelativePath?: (absolutePath: string) => string;
    /** ファイルアクティベート時のコールバック */
    onActivate?: (path: string, node: TreeNode) => void;
    /** 外部変更検知コールバック */
    onExternalChange?: (rootPath: string) => void;
}

export interface UseFileTreeReturn {
    /** 現在の状態スナップショット（React state） */
    snapshot: TreeStateSnapshot;

    /** TreeStateインスタンスへの直接参照（命令的操作用） */
    treeState: TreeState;

    /** フラットリスト（仮想スクロール用） */
    flatList: readonly FlatNode[];

    /** フォルダの展開/折りたたみトグル */
    toggleExpand: (path: string) => void;

    /** ノード選択 */
    select: (path: string, mode?: SelectionMode) => void;

    /** ファイルアクティベート（ダブルクリック / Enter） */
    activate: (path: string) => void;

    /** 全フォルダ折りたたみ */
    collapseAll: () => void;

    /** 展開中フォルダを全てリフレッシュ */
    refreshAll: () => Promise<void>;

    /** パスをreveal（展開+選択） */
    revealPath: (path: string) => Promise<void>;

    /** フィルターテキスト設定 */
    setFilter: (text: string) => void;

    /** デコレーション取得 */
    getDecorations: (node: TreeNode) => Decoration[];

    /** コンテキストメニュー項目取得 */
    getContextMenuItems: (context: ContextMenuContext) => ContextMenuItem[];

    /** キーボードイベントハンドラ（TreeViewのonKeyDownに渡す） */
    handleKeyDown: (event: React.KeyboardEvent) => void;

    /** リネーム実行 */
    rename: (oldPath: string, newName: string) => Promise<void>;

    /** 削除実行 */
    deleteSelected: () => Promise<void>;

    /** 新規作成実行 */
    create: (parentPath: string, name: string, isDirectory: boolean) => Promise<void>;

    /** 読み込み中か */
    isLoading: boolean;

    /** 検索実行 */
    searchFiles: (query: string) => Promise<void>;

    /** 検索クリア */
    clearSearch: () => void;
}

/**
 * coreのTreeStateをReactに接続するメインhook。
 *
 * 内部でTreeStateインスタンスを生成・管理し、
 * stateChangeイベントをuseState/useSyncExternalStoreで
 * Reactの再レンダリングに変換する。
 */
export function useFileTree(options: UseFileTreeOptions): UseFileTreeReturn;
```

### 3.2 useContextMenu hook

```typescript
// ============================================================
// hooks/use-context-menu.ts
// ============================================================

export interface ContextMenuState {
    /** 表示中か */
    isOpen: boolean;
    /** 表示位置 */
    position: { x: number; y: number };
    /** 対象ノード（null = 背景） */
    targetNode: TreeNode | null;
    /** メニュー項目 */
    items: ContextMenuItem[];
}

export interface UseContextMenuReturn {
    /** 現在のメニュー状態 */
    state: ContextMenuState;
    /** メニューを開く（onContextMenuから呼ぶ） */
    open: (event: React.MouseEvent, node: TreeNode | null) => void;
    /** メニューを閉じる */
    close: () => void;
    /** アクション実行してメニューを閉じる */
    executeAction: (action: string) => void;
}

export function useContextMenu(
    treeState: TreeState,
    onAction?: (action: string, nodes: TreeNode[], isBackground: boolean) => void,
): UseContextMenuReturn;
```

### 3.3 useInlineEdit hook

```typescript
// ============================================================
// hooks/use-inline-edit.ts
// ============================================================

export interface InlineEditState {
    /** リネーム中のパス（null = リネーム中でない） */
    renamingPath: string | null;
    /** リネーム入力値 */
    renameValue: string;
    /** インライン作成状態 */
    creating: {
        parentPath: string;
        isDirectory: boolean;
        value: string;
    } | null;
}

export interface UseInlineEditReturn {
    /** 現在の編集状態 */
    state: InlineEditState;
    /** リネーム開始 */
    startRename: (path: string, currentName: string) => void;
    /** リネーム値変更 */
    setRenameValue: (value: string) => void;
    /** リネーム確定 */
    submitRename: () => Promise<void>;
    /** リネームキャンセル */
    cancelRename: () => void;
    /** インライン作成開始 */
    startCreate: (parentPath: string, isDirectory: boolean) => void;
    /** インライン作成値変更 */
    setCreateValue: (value: string) => void;
    /** インライン作成確定 */
    submitCreate: () => Promise<void>;
    /** インライン作成キャンセル */
    cancelCreate: () => void;
}

export function useInlineEdit(treeState: TreeState): UseInlineEditReturn;
```

### 3.4 TreeView コンポーネント

```typescript
// ============================================================
// components/TreeView.tsx
// ============================================================

export interface TreeViewProps {
    /** useFileTree() の戻り値をそのまま渡す */
    tree: UseFileTreeReturn;

    /** 行の固定高さ（px）。デフォルト: 22 */
    itemHeight?: number;

    /** インデント幅（px）。デフォルト: 14 */
    indentWidth?: number;

    /** インデントガイドを表示するか。デフォルト: true */
    showIndentGuides?: boolean;

    /** ヘッダー部分のカスタムレンダリング */
    renderHeader?: () => React.ReactNode;

    /** 行のカスタムレンダリング */
    renderRow?: (props: TreeRowRenderProps) => React.ReactNode;

    /** アイコンのカスタムレンダリング */
    renderIcon?: (node: TreeNode, isExpanded: boolean) => React.ReactNode;

    /** コンテキストメニューのカスタムレンダリング */
    renderContextMenu?: (state: ContextMenuState, close: () => void) => React.ReactNode;

    /** 空状態のカスタムレンダリング */
    renderEmpty?: () => React.ReactNode;

    /** ローディング状態のカスタムレンダリング */
    renderLoading?: () => React.ReactNode;

    /** コンテキストメニューアクション実行時のコールバック */
    onContextMenuAction?: (action: string, nodes: TreeNode[], isBackground: boolean) => void;

    /** CSSクラス名 */
    className?: string;

    /** インラインスタイル */
    style?: React.CSSProperties;
}

/**
 * メインのツリービューコンポーネント。
 * react-virtuosoを使用した仮想スクロールを内蔵。
 * render propで各部分をカスタマイズ可能。
 */
export const TreeView: React.FC<TreeViewProps>;
```

### 3.5 TreeRow コンポーネント

```typescript
// ============================================================
// components/TreeRow.tsx
// ============================================================

/** TreeRowのrender propに渡されるプロパティ */
export interface TreeRowRenderProps {
    /** ノードデータ */
    node: TreeNode;
    /** 深さ */
    depth: number;
    /** 展開中か */
    isExpanded: boolean;
    /** 選択中か */
    isSelected: boolean;
    /** フォーカス中か */
    isFocused: boolean;
    /** リネーム中か */
    isRenaming: boolean;
    /** デコレーション群 */
    decorations: Decoration[];
    /** クリックハンドラ */
    onClick: () => void;
    /** ダブルクリックハンドラ */
    onDoubleClick: () => void;
    /** コンテキストメニューハンドラ */
    onContextMenu: (e: React.MouseEvent) => void;
    /** フォルダ展開/折りたたみトグル */
    onToggle: () => void;
    /** インデント幅（px） */
    indentWidth: number;
}

export interface TreeRowProps extends TreeRowRenderProps {
    /** アイコンのカスタムレンダリング */
    renderIcon?: (node: TreeNode, isExpanded: boolean) => React.ReactNode;
    /** インラインリネーム状態 */
    inlineEdit: UseInlineEditReturn;
}

/**
 * デフォルトの行レンダリングコンポーネント。
 * VSCode風の見た目をCSS変数でスタイリング。
 */
export const TreeRow: React.FC<TreeRowProps>;
```

### 3.6 CSS変数（テーマ）

```css
/* ============================================================
 * styles/tree-view.css -- CSS変数ベースのデフォルトスタイル
 * ============================================================ */

.momoi-explorer {
    /* -- レイアウト -- */
    --me-item-height: 22px;
    --me-indent-width: 14px;
    --me-icon-size: 16px;
    --me-font-size: 13px;
    --me-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

    /* -- 色: 背景 -- */
    --me-bg: #252526;
    --me-bg-hover: rgba(255, 255, 255, 0.04);
    --me-bg-selected: rgba(255, 255, 255, 0.06);
    --me-bg-focused: rgba(0, 127, 212, 0.2);
    --me-bg-active: rgba(0, 127, 212, 0.15);

    /* -- 色: テキスト -- */
    --me-color: #cccccc;
    --me-color-muted: #858585;
    --me-color-folder: #dcb67a;
    --me-color-gitignored-opacity: 0.5;

    /* -- 色: インデントガイド -- */
    --me-indent-guide-color: rgba(255, 255, 255, 0.1);
    --me-indent-guide-color-hover: rgba(255, 255, 255, 0.2);

    /* -- 色: コンテキストメニュー -- */
    --me-context-bg: #3c3c3c;
    --me-context-border: rgba(255, 255, 255, 0.1);
    --me-context-hover: rgba(0, 127, 212, 0.4);
    --me-context-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);

    /* -- 色: インライン入力 -- */
    --me-input-bg: #3c3c3c;
    --me-input-border: #007fd4;
    --me-input-color: #cccccc;

    /* -- 色: フォーカスリング -- */
    --me-focus-outline: rgba(0, 127, 212, 0.4);

    /* -- 色: バッジ -- */
    --me-badge-modified: #e2c08d;
    --me-badge-added: #73c991;
    --me-badge-deleted: #c74e39;
    --me-badge-untracked: #73c991;

    /* -- トランジション -- */
    --me-transition-duration: 100ms;
}
```


## 4. データフロー図

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │                       ホストアプリケーション                          │
 │  (claude-ice / Electron / ブラウザ / テスト)                         │
 │                                                                     │
 │  ┌──────────────────┐    ┌──────────────────┐                       │
 │  │ FileSystemProvider│    │ DecorationProvider│ (Git, LSP, etc.)     │
 │  │ (Electron IPC等)  │    │ (GitDecorator等)  │                      │
 │  └────────┬─────────┘    └────────┬─────────┘                       │
 └───────────┼───────────────────────┼─────────────────────────────────┘
             │                       │
             ▼                       ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │                     @momoi-explorer/core                            │
 │                                                                     │
 │  ┌─────────────────────────────────────────────────────────────┐    │
 │  │                      TreeState                               │    │
 │  │                                                              │    │
 │  │  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐   │    │
 │  │  │  TreeNode[] │  │ExpandedSet │  │ SelectionSet         │   │    │
 │  │  │  (ツリー構造) │  │ (展開状態)  │  │ (選択状態)            │   │    │
 │  │  └──────┬─────┘  └────────────┘  └──────────────────────┘   │    │
 │  │         │                                                    │    │
 │  │         ▼                                                    │    │
 │  │  ┌──────────────┐                                            │    │
 │  │  │ TreeFlattener │ ──▶ FlatNode[] (仮想スクロール用)           │    │
 │  │  └──────────────┘                                            │    │
 │  │                                                              │    │
 │  │  ┌──────────────┐  ┌───────────┐  ┌──────────────────────┐  │    │
 │  │  │ SortEngine   │  │ Filter    │  │ KeyboardNavigator    │  │    │
 │  │  └──────────────┘  └───────────┘  └──────────────────────┘  │    │
 │  │                                                              │    │
 │  │  ──── emit('stateChange', snapshot) ────────────────────▶    │    │
 │  └──────────────────────────────────────────────────────────────┘    │
 │                                                                     │
 └──────────────────────────────┬──────────────────────────────────────┘
                                │
                                │ stateChange イベント
                                ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │                     @momoi-explorer/react                           │
 │                                                                     │
 │  ┌──────────────────────────────────────────────────────────────┐   │
 │  │  useFileTree(options)                                         │   │
 │  │                                                               │   │
 │  │  - TreeStateインスタンスを生成/管理                              │   │
 │  │  - useSyncExternalStore で snapshot を React state に同期       │   │
 │  │  - メモ化された操作関数を提供                                    │   │
 │  └──────────────────┬───────────────────────────────────────────┘   │
 │                     │                                               │
 │                     ▼                                               │
 │  ┌──────────────────────────────────────────────────────────────┐   │
 │  │  TreeView コンポーネント                                       │   │
 │  │                                                               │   │
 │  │  ┌────────────────┐                                           │   │
 │  │  │ react-virtuoso  │ ◄── flatList + itemHeight                │   │
 │  │  │ Virtuoso        │                                           │   │
 │  │  └───────┬────────┘                                           │   │
 │  │          │ itemContent                                         │   │
 │  │          ▼                                                     │   │
 │  │  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐    │   │
 │  │  │  TreeRow        │  │ InlineInput    │  │ ContextMenu   │    │   │
 │  │  │  (行レンダリング) │  │ (リネーム/作成) │  │ (右クリック)   │    │   │
 │  │  └────────────────┘  └────────────────┘  └──────────────┘    │   │
 │  │                                                               │   │
 │  └──────────────────────────────────────────────────────────────┘   │
 │                                                                     │
 └─────────────────────────────────────────────────────────────────────┘
```

### キーボードナビゲーションのデータフロー

```
 キーイベント (onKeyDown)
       │
       ▼
 TreeView.handleKeyDown()
       │
       ▼
 TreeState.handleKeyDown(event)
       │
       ├── ArrowUp/Down ──▶ select(prevPath/nextPath)
       │                         │
       ├── ArrowRight ────▶ expand(currentPath)
       │                         │
       ├── ArrowLeft ─────▶ collapse(currentPath)
       │                    or select(parentPath)
       │                         │
       ├── Enter ─────────▶ toggleExpand(dir) / emit('activate', file)
       │                         │
       ├── F2 ────────────▶ emit('rename', { path })
       │                         │
       ├── Delete ────────▶ emit('delete', { paths })
       │                         │
       └── Escape ────────▶ clearSelection() / cancelRename()
                                 │
                                 ▼
                          emit('stateChange')
                                 │
                                 ▼
                      React re-render (via useSyncExternalStore)
```


## 5. claude-ice へのマイグレーションパス

### 段階的移行（4フェーズ）

```
Phase 1: パッケージ導入 + FileSystemProvider 実装
──────────────────────────────────────────────────

1. @momoi-explorer/core と @momoi-explorer/react を
   claude-ice の dependencies に追加

2. ElectronFileSystemProvider を実装:

   // src/renderer/providers/electron-fs-provider.ts
   import type { FileSystemProvider, DirectoryEntry } from '@momoi-explorer/core';

   export const electronFsProvider: FileSystemProvider = {
       async readDirectory(path: string): Promise<DirectoryEntry[]> {
           const result = await window.electronAPI.dirRead(path);
           if ('error' in result) throw new Error(result.error);
           return result.entries;
       },
       async rename(oldPath: string, newPath: string): Promise<void> {
           const result = await window.electronAPI.fileRename(oldPath, newPath);
           if ('error' in result) throw new Error(result.error);
       },
       async delete(paths: string[]): Promise<void> {
           for (const p of paths) {
               const result = await window.electronAPI.fileDelete(p);
               if ('error' in result) throw new Error(result.error);
           }
       },
       async createFile(path: string): Promise<void> {
           const result = await window.electronAPI.fileCreate(path);
           if ('error' in result) throw new Error(result.error);
       },
       async createDirectory(path: string): Promise<void> {
           const result = await window.electronAPI.dirCreate(path);
           if ('error' in result) throw new Error(result.error);
       },
       async search(rootPath: string, query: string, maxResults?: number): Promise<string[]> {
           const result = await window.electronAPI.dirSearch(rootPath, query, maxResults);
           if ('error' in result) throw new Error(result.error);
           return result.files;
       },
       async revealInOS(path: string): Promise<void> {
           await window.electronAPI.showInFolder(path);
       },
   };


Phase 2: DecorationProvider でGit統合
──────────────────────────────────────────────────

   // src/renderer/providers/git-decoration-provider.ts
   import type { DecorationProvider, TreeNode, Decoration } from '@momoi-explorer/core';
   import { useGitStatusStore } from '../stores/git-status-store';

   export function createGitDecorationProvider(workspaceId: string): DecorationProvider {
       return {
           id: 'git-status',
           getDecoration(node: TreeNode): Decoration | null {
               const status = useGitStatusStore.getState().statuses[workspaceId];
               if (!status) return null;

               const change = status.changes.find(c => c.path === node.path);
               if (!change) return null;

               // Git変更タイプに応じたデコレーション
               switch (change.status) {
                   case 'modified':
                       return { badge: 'M', badgeColor: 'var(--me-badge-modified)',
                                foregroundColor: 'var(--me-badge-modified)' };
                   case 'added':
                       return { badge: 'U', badgeColor: 'var(--me-badge-added)',
                                foregroundColor: 'var(--me-badge-added)' };
                   case 'deleted':
                       return { badge: 'D', badgeColor: 'var(--me-badge-deleted)',
                                foregroundColor: 'var(--me-badge-deleted)' };
                   default:
                       return null;
               }
           },
           onDidChange(callback: () => void): () => void {
               // Zustand subscribe で変更を監視
               return useGitStatusStore.subscribe(
                   (state) => state.statuses[workspaceId],
                   () => callback(),
               );
           },
       };
   }


Phase 3: UIコンポーネントの差し替え
──────────────────────────────────────────────────

   // src/renderer/components/explorer/FileExplorer.tsx (差し替え後)
   import { useFileTree, TreeView } from '@momoi-explorer/react';
   import { getIcon } from 'material-file-icons';
   import { electronFsProvider } from '../../providers/electron-fs-provider';
   import { createGitDecorationProvider } from '../../providers/git-decoration-provider';

   export const FileExplorer: React.FC<{ cwd: string }> = ({ cwd }) => {
       const workspaceId = useWorkspaceStore(s =>
           s.workspaces.find(w => w.path === cwd)?.id ?? ''
       );

       const tree = useFileTree({
           rootPath: cwd,
           provider: electronFsProvider,
           decorations: [createGitDecorationProvider(workspaceId)],
           excludePatterns: useFileExplorerStore(s => s.excludePatterns),
           pathSeparator: cwd.includes('\\') ? '\\' : '/',
           onActivate: (path, node) => {
               // 既存のファイルオープンロジックを呼び出す
               const absolutePath = cwd + sep + path;
               openEditorTab(absolutePath, node.name);
           },
       });

       return (
           <TreeView
               tree={tree}
               itemHeight={18}
               indentWidth={14}
               renderIcon={(node, isExpanded) => {
                   if (node.isDirectory) {
                       return <FolderIcon open={isExpanded} />;
                   }
                   const svg = getIcon(node.name).svg;
                   return <span dangerouslySetInnerHTML={{ __html: svg }} />;
               }}
               onContextMenuAction={(action, nodes) => {
                   // 既存のアクションハンドラを呼び出す
                   handleContextMenuAction(action, nodes, tree);
               }}
           />
       );
   };


Phase 4: 旧コード削除
──────────────────────────────────────────────────

   削除対象:
   - src/renderer/stores/file-explorer-store.ts
     （ただしexcludePatterns等の設定はpreference storeに移動）
   - src/renderer/components/explorer/FileExplorer.tsx (旧)
   - src/renderer/components/explorer/FileExplorerRow.tsx
   - src/renderer/components/explorer/ContextMenu.tsx (旧)

   残留:
   - file-watcher.ts はメインプロセス側なのでそのまま維持
   - git-status-store.ts はGitパネルでも使うので維持
   - file-icons.tsx はTreeViewのrenderIcon内で引き続き使用
```

### マッピング表: 旧API -> 新API

```
旧 (claude-ice)                         新 (@momoi-explorer)
────────────────────────────────────── ──────────────────────────────────────
useFileExplorerStore                  → useFileTree() hook
  .treeByPath[cwd]                    → snapshot.roots
  .expandedFolders[cwd]              → snapshot.expandedPaths
  .selectedPath[cwd]                 → snapshot.selectedPaths
  .filterText[cwd]                   → snapshot.filterText
  .fetchRootEntries(cwd)             → treeState.loadRoot() (自動実行)
  .loadChildren(cwd, path)           → treeState.loadChildren(path) (自動)
  .toggleFolder(cwd, path)           → tree.toggleExpand(path)
  .collapseAll(cwd)                  → tree.collapseAll()
  .refreshExpanded(cwd)              → tree.refreshAll()
  .setSelectedPath(cwd, path)        → tree.select(path)
  .setFilterText(cwd, text)          → tree.setFilter(text)
  .searchFiles(cwd, query)           → tree.searchFiles(query)
  .clearSearch(cwd)                  → tree.clearSearch()
  .revealFile(cwd, path)             → tree.revealPath(path)

FileExplorerRow                       → TreeRow (デフォルト) or renderRow
ContextMenu                          → ContextMenu (組み込み) or renderContextMenu
flatItems (useMemo)                   → snapshot.flatList
window.electronAPI.dirRead            → provider.readDirectory
window.electronAPI.fileDelete         → provider.delete
window.electronAPI.fileRename         → provider.rename
window.electronAPI.fileCreate         → provider.createFile
window.electronAPI.dirCreate          → provider.createDirectory
window.electronAPI.dirSearch          → provider.search
```


## 6. 使用する外部ライブラリの選定

### モノレポ管理

| ツール | 選定理由 |
|--------|----------|
| **pnpm** | ワークスペースプロトコル (`workspace:*`) 対応、ディスク効率が良い、シンボリンクベースで高速 |
| **Turborepo** | ビルドキャッシュ、依存関係グラフに基づく並列ビルド、設定が軽量 |

代替検討: Nx は機能豊富だがオーバースペック。Lerna は現在 Nx ベースのため pnpm + Turborepo の方がシンプル。

### ビルドツール

| ツール | パッケージ | 選定理由 |
|--------|------------|----------|
| **tsup** | core, react | esbuild ベースの高速バンドラ。ESM + CJS デュアル出力、.d.ts 生成が簡単 |
| **Vite** | sample | Electron + React のサンプルアプリに最適。HMR が高速 |
| **electron-builder** | sample | Electron パッケージング |

### @momoi-explorer/core の依存

**外部依存ゼロ**（設計要件通り）

### @momoi-explorer/react の依存

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| **react** | ^18.0.0 \|\| ^19.0.0 | peerDependency |
| **react-dom** | ^18.0.0 \|\| ^19.0.0 | peerDependency |
| **react-virtuoso** | ^4.0.0 | 仮想スクロール |
| **@momoi-explorer/core** | workspace:* | ヘッドレス層 |

### @momoi-explorer/sample の依存

| パッケージ | 用途 |
|-----------|------|
| **electron** | Electronランタイム |
| **vite** | ビルド/開発サーバー |
| **vite-plugin-electron** | Electron + Vite統合 |
| **material-file-icons** | ファイルアイコン |
| **@momoi-explorer/core** | ヘッドレス層 |
| **@momoi-explorer/react** | Reactバインディング |

### 開発共通

| パッケージ | 用途 |
|-----------|------|
| **typescript** | 型チェック |
| **vitest** | ユニットテスト (core層) |
| **@testing-library/react** | Reactコンポーネントテスト |
| **prettier** | コードフォーマッター |
| **eslint** | リンター |


## 7. package.json の主要フィールド

### ルート package.json

```jsonc
{
    "name": "momoi-explorer",
    "private": true,
    "packageManager": "pnpm@9.15.4",
    "scripts": {
        "build": "turbo run build",
        "dev": "turbo run dev",
        "test": "turbo run test",
        "lint": "turbo run lint",
        "clean": "turbo run clean",
        "typecheck": "turbo run typecheck"
    },
    "devDependencies": {
        "turbo": "^2.4.0",
        "typescript": "^5.7.0",
        "prettier": "^3.4.0"
    }
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
```

### turbo.json

```jsonc
{
    "$schema": "https://turbo.build/schema.json",
    "tasks": {
        "build": {
            "dependsOn": ["^build"],
            "outputs": ["dist/**"]
        },
        "dev": {
            "cache": false,
            "persistent": true
        },
        "test": {
            "dependsOn": ["build"]
        },
        "typecheck": {
            "dependsOn": ["^build"]
        },
        "lint": {},
        "clean": {
            "cache": false
        }
    }
}
```

### packages/core/package.json

```jsonc
{
    "name": "@momoi-explorer/core",
    "version": "0.1.0",
    "description": "Headless file explorer engine - framework agnostic",
    "type": "module",
    "main": "./dist/index.cjs",
    "module": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {
        ".": {
            "import": {
                "types": "./dist/index.d.ts",
                "default": "./dist/index.js"
            },
            "require": {
                "types": "./dist/index.d.cts",
                "default": "./dist/index.cjs"
            }
        }
    },
    "files": ["dist"],
    "sideEffects": false,
    "scripts": {
        "build": "tsup",
        "dev": "tsup --watch",
        "test": "vitest run",
        "test:watch": "vitest",
        "typecheck": "tsc --noEmit",
        "clean": "rm -rf dist",
        "lint": "eslint src"
    },
    "devDependencies": {
        "tsup": "^8.4.0",
        "typescript": "^5.7.0",
        "vitest": "^3.0.0"
    },
    "keywords": ["file-explorer", "tree-view", "headless", "virtual-scroll"],
    "license": "MIT"
}
```

### packages/react/package.json

```jsonc
{
    "name": "@momoi-explorer/react",
    "version": "0.1.0",
    "description": "React bindings and default UI for momoi-explorer",
    "type": "module",
    "main": "./dist/index.cjs",
    "module": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {
        ".": {
            "import": {
                "types": "./dist/index.d.ts",
                "default": "./dist/index.js"
            },
            "require": {
                "types": "./dist/index.d.cts",
                "default": "./dist/index.cjs"
            }
        },
        "./styles": "./dist/styles/tree-view.css"
    },
    "files": ["dist"],
    "sideEffects": ["*.css"],
    "scripts": {
        "build": "tsup",
        "dev": "tsup --watch",
        "test": "vitest run",
        "test:watch": "vitest",
        "typecheck": "tsc --noEmit",
        "clean": "rm -rf dist",
        "lint": "eslint src"
    },
    "dependencies": {
        "@momoi-explorer/core": "workspace:*",
        "react-virtuoso": "^4.12.0"
    },
    "peerDependencies": {
        "react": "^18.0.0 || ^19.0.0",
        "react-dom": "^18.0.0 || ^19.0.0"
    },
    "devDependencies": {
        "@testing-library/react": "^16.0.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "jsdom": "^26.0.0",
        "react": "^19.0.0",
        "react-dom": "^19.0.0",
        "tsup": "^8.4.0",
        "typescript": "^5.7.0",
        "vitest": "^3.0.0"
    },
    "keywords": ["file-explorer", "tree-view", "react", "virtual-scroll"],
    "license": "MIT"
}
```

### packages/sample/package.json

```jsonc
{
    "name": "@momoi-explorer/sample",
    "version": "0.1.0",
    "private": true,
    "description": "Sample Electron app demonstrating momoi-explorer",
    "main": "dist/main/main.js",
    "scripts": {
        "dev": "vite",
        "build": "vite build",
        "preview": "electron .",
        "clean": "rm -rf dist"
    },
    "dependencies": {
        "@momoi-explorer/core": "workspace:*",
        "@momoi-explorer/react": "workspace:*",
        "material-file-icons": "^1.10.0",
        "react": "^19.0.0",
        "react-dom": "^19.0.0"
    },
    "devDependencies": {
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "electron": "^34.0.0",
        "electron-builder": "^25.1.0",
        "typescript": "^5.7.0",
        "vite": "^6.2.0",
        "vite-plugin-electron": "^0.28.0"
    }
}
```

### tsconfig.base.json

```jsonc
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "resolveJsonModule": true,
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true,
        "isolatedModules": true,
        "jsx": "react-jsx"
    }
}
```

### packages/core/tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: false,
});
```

### packages/react/tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: false,
    // CSSファイルをコピー
    loader: {
        '.css': 'copy',
    },
    publicDir: 'src/styles',
});
```


## 付録A: TreeState 内部の状態遷移

```
[初期状態]
  roots: []
  expandedPaths: Set()
  selectedPaths: Set()
  focusedPath: null
  flatList: []
  loadingPaths: Set()
  filterText: ''

      │
      │ loadRoot()
      ▼

[ルート読み込み完了]
  roots: [dir_a, file_b, dir_c, ...]
  flatList: [FlatNode(dir_a, 0), FlatNode(file_b, 0), ...]

      │
      │ toggleExpand('dir_a')
      ▼

[フォルダ展開 (children未読み込み)]
  expandedPaths: Set('dir_a')
  loadingPaths: Set('dir_a')   ← loadChildren() が非同期で実行中

      │
      │ loadChildren() 完了
      ▼

[フォルダ展開完了]
  roots: [dir_a{children: [file_x, file_y]}, file_b, dir_c]
  expandedPaths: Set('dir_a')
  loadingPaths: Set()
  flatList: [...dir_a, ...file_x(depth=1), ...file_y(depth=1), ...file_b, ...]

      │
      │ select('dir_a/file_x')
      ▼

[ファイル選択]
  selectedPaths: Set('dir_a/file_x')
  focusedPath: 'dir_a/file_x'

      │
      │ select('dir_a/file_y', 'shift')
      ▼

[範囲選択]
  selectedPaths: Set('dir_a/file_x', 'dir_a/file_y')
  focusedPath: 'dir_a/file_y'
```

## 付録B: useSyncExternalStore による React 統合パターン

```typescript
// useFileTree 内部実装の概要
function useFileTree(options: UseFileTreeOptions): UseFileTreeReturn {
    // TreeState はインスタンスとして保持
    const treeStateRef = useRef<TreeState | null>(null);

    // options 変更時にインスタンスを再生成
    if (!treeStateRef.current || rootPathChanged || providerChanged) {
        treeStateRef.current?.dispose();
        treeStateRef.current = new TreeState({ ... });
    }

    const treeState = treeStateRef.current;

    // useSyncExternalStore で React に同期
    const snapshot = useSyncExternalStore(
        // subscribe: stateChange リスナーを登録
        (onStoreChange) => treeState.on('stateChange', onStoreChange),
        // getSnapshot: 現在の不変スナップショットを返す
        () => treeState.getSnapshot(),
    );

    // 初回マウント時にルートを読み込む
    useEffect(() => {
        treeState.loadRoot();
    }, [treeState]);

    // cleanup
    useEffect(() => {
        return () => treeState.dispose();
    }, [treeState]);

    return { snapshot, treeState, flatList: snapshot.flatList, ... };
}
```

このパターンにより:
- React 18/19 の Concurrent Mode と互換
- 不要な再レンダリングを最小化（スナップショットの参照比較）
- React 外部（テスト、他フレームワーク）でも TreeState を単体利用可能
