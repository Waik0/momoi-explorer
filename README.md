# momoi-explorer

ヘッドレスファイルエクスプローラーライブラリ。フレームワーク非依存のコア + React バインディング + デフォルト UI の3層構成。

## インストール

```bash
npm install momoi-explorer
```

## アーキテクチャ

3つのエントリポイントを持つ段階的なアーキテクチャ:

| エントリポイント | 用途 | React必須 |
|---|---|---|
| `momoi-explorer` | コアエンジン（フレームワーク非依存） | No |
| `momoi-explorer/react` | React バインディング（hooks + context） | Yes |
| `momoi-explorer/ui` | デフォルト UI コンポーネント | Yes |

## クイックスタート

### 1. FileSystemAdapter を実装する

全ての始まりは `FileSystemAdapter` の実装。`readDir` のみ必須で、他のメソッドはオプション（実装すると対応機能が有効になる）。

```ts
import type { FileSystemAdapter } from 'momoi-explorer'

const adapter: FileSystemAdapter = {
  // 必須: ディレクトリの中身を返す
  async readDir(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries.map(e => ({
      name: e.name,
      path: path.join(dirPath, e.name),
      isDirectory: e.isDirectory(),
    }))
  },
  // オプション: リネーム
  async rename(oldPath, newPath) {
    await fs.rename(oldPath, newPath)
  },
  // オプション: 削除
  async delete(paths) {
    for (const p of paths) await fs.rm(p, { recursive: true })
  },
  // オプション: ファイル作成
  async createFile(parentPath, name) {
    await fs.writeFile(path.join(parentPath, name), '')
  },
  // オプション: フォルダ作成
  async createDir(parentPath, name) {
    await fs.mkdir(path.join(parentPath, name))
  },
  // オプション: ファイル監視（デバウンス・合体はコアが行う）
  watch(dirPath, callback) {
    const watcher = fs.watch(dirPath, { recursive: true }, (event, filename) => {
      callback([{ type: event === 'rename' ? 'create' : 'modify', path: filename, isDirectory: false }])
    })
    return () => watcher.close()
  },
}
```

### 2a. デフォルト UI を使う（最も簡単）

```tsx
import { FileExplorer } from 'momoi-explorer/ui'
import 'momoi-explorer/ui/style.css'

function App() {
  return (
    <FileExplorer
      adapter={adapter}
      rootPath="/home/user/project"
      onOpen={(path) => openFile(path)}
      onEvent={(e) => console.log('tree event:', e)}
      showFilterBar
    />
  )
}
```

### 2b. React hooks でカスタム UI を構築する

```tsx
import { TreeProvider, useFileTree, useTreeNode } from 'momoi-explorer/react'

function App() {
  return (
    <TreeProvider adapter={adapter} rootPath="/home/user/project">
      <MyCustomTree />
    </TreeProvider>
  )
}

function MyCustomTree() {
  const { flatList, controller } = useFileTree()

  return (
    <div>
      {flatList.map(({ node, depth }) => (
        <div key={node.path} style={{ paddingLeft: depth * 16 }}>
          <span onClick={() => controller.toggleExpand(node.path)}>
            {node.name}
          </span>
        </div>
      ))}
    </div>
  )
}
```

### 2c. コアのみ使用（フレームワーク非依存）

```ts
import { createFileTree } from 'momoi-explorer'

const tree = createFileTree({
  adapter,
  rootPath: '/home/user/project',
  onEvent: (e) => console.log(e),
})

// 状態購読
tree.subscribe((state) => {
  console.log('nodes:', state.rootNodes)
  console.log('flatList:', state.flatList)
})

// ツリーを読み込み
await tree.loadRoot()

// 操作
await tree.expand('/home/user/project/src')
tree.select('/home/user/project/src/index.ts')
tree.setSearchQuery('config')

// 後始末
tree.destroy()
```

## API リファレンス

### コア層 (`momoi-explorer`)

#### `createFileTree(options): FileTreeController`

ヘッドレスファイルツリーのメインエントリポイント。

**FileTreeOptions:**
| プロパティ | 型 | 説明 |
|---|---|---|
| `adapter` | `FileSystemAdapter` | ファイルシステムアダプタ（必須） |
| `rootPath` | `string` | ルートディレクトリの絶対パス |
| `sort` | `(a, b) => number` | カスタムソート関数 |
| `filter` | `(entry) => boolean` | カスタムフィルタ関数 |
| `watchOptions` | `WatchOptions` | ファイル監視設定 |
| `onEvent` | `(event: TreeEvent) => void` | イベントコールバック |

**FileTreeController のメソッド:**

| メソッド | 説明 |
|---|---|
| `getState()` | 現在の TreeState を取得 |
| `subscribe(listener)` | 状態変更を購読。unsubscribe関数を返す |
| `loadRoot()` | ルートを読み込み・初期化（最初に必ず呼ぶ） |
| `expand(path)` | ディレクトリを展開 |
| `collapse(path)` | ディレクトリを折りたたみ |
| `toggleExpand(path)` | 展開/折りたたみをトグル |
| `expandTo(path)` | 指定パスまで祖先をすべて展開 |
| `select(path, mode?)` | ノードを選択（mode: 'replace' / 'toggle' / 'range'） |
| `selectAll()` | 全ノードを選択 |
| `clearSelection()` | 選択解除 |
| `startRename(path)` | リネームモード開始 |
| `commitRename(newName)` | リネーム確定 |
| `cancelRename()` | リネームキャンセル |
| `startCreate(parentPath, isDirectory)` | インライン新規作成モード開始 |
| `commitCreate(name)` | 新規作成確定 |
| `cancelCreate()` | 新規作成キャンセル |
| `createFile(parentPath, name)` | ファイル作成 |
| `createDir(parentPath, name)` | フォルダ作成 |
| `deleteSelected()` | 選択中のアイテムを削除 |
| `refresh(path?)` | ツリーをリフレッシュ（展開状態は保持） |
| `setSearchQuery(query)` | ファジー検索クエリ設定（nullで解除） |
| `collectAllFiles()` | 全ファイルを再帰収集（QuickOpen用） |
| `setFilter(fn)` | フィルタ関数を動的変更 |
| `setSort(fn)` | ソート関数を動的変更 |
| `destroy()` | コントローラ破棄（監視停止・購読解除） |

#### ユーティリティ関数

| 関数 | 説明 |
|---|---|
| `flattenTree(nodes, expandedPaths, matchingPaths?)` | ツリーをフラットリストに変換 |
| `computeSelection(current, anchor, target, mode, flatList)` | 選択状態を計算 |
| `fuzzyMatch(query, target)` | ファジーマッチ（match + score） |
| `fuzzyFind(files, query, maxResults?)` | スコア順にファジー検索 |
| `findMatchingPaths(nodes, query)` | マッチするパスのSetを返す |
| `coalesceEvents(raw)` | 生イベントを合体処理 |
| `createEventProcessor(callback, options?)` | デバウンス付きイベントプロセッサ |
| `defaultSort(a, b)` | デフォルトソート（フォルダ優先・名前昇順） |
| `defaultFilter(entry)` | デフォルトフィルタ（全表示） |

### React層 (`momoi-explorer/react`)

| エクスポート | 種別 | 説明 |
|---|---|---|
| `TreeProvider` | コンポーネント | ファイルツリーのコンテキストプロバイダー。内部で `createFileTree` + `loadRoot` を行う |
| `useFileTree()` | Hook | ツリー全体の状態とコントローラを返す |
| `useTreeNode(path)` | Hook | 個別ノードの展開/選択/リネーム状態を返す（見つからない場合 null） |
| `useContextMenu()` | Hook | 右クリックメニューの表示制御（show/hide + 座標管理） |
| `useTreeContext()` | Hook | TreeContext の生の値を取得（通常は useFileTree を使う） |

### UI層 (`momoi-explorer/ui`)

| エクスポート | 説明 |
|---|---|
| `FileExplorer` | オールインワンコンポーネント（TreeProvider内包、仮想スクロール、コンテキストメニュー対応） |
| `TreeNodeRow` | ツリーの1行コンポーネント（アイコン、インデント、選択、リネーム対応） |
| `ContextMenu` | 右クリックメニュー（外側クリック/Escで閉じる） |
| `InlineRename` | インライン名前変更input（Enter確定、Escキャンセル） |
| `TreeFilterBar` | ファジー検索フィルタバー |
| `QuickOpen` | VSCode風クイックオープンダイアログ（Ctrl+P相当） |

**スタイル:**

```ts
import 'momoi-explorer/ui/style.css'
```

VSCode風ダークテーマ。CSS変数やクラス名（`.momoi-explorer-*`）でカスタマイズ可能。

### FileExplorer の Props

```tsx
<FileExplorer
  adapter={adapter}            // FileSystemAdapter（必須）
  rootPath="/path/to/dir"      // ルートパス（必須）
  sort={(a, b) => ...}         // カスタムソート
  filter={(entry) => ...}      // カスタムフィルタ
  watchOptions={{ ... }}       // ファイル監視設定
  onEvent={(e) => ...}         // ツリーイベントコールバック
  onOpen={(path) => ...}       // ファイルダブルクリック時
  renderIcon={(node, expanded) => ...}   // カスタムアイコン
  renderBadge={(node) => ...}  // カスタムバッジ（git status等）
  contextMenuItems={(nodes) => [...]}    // コンテキストメニュー項目
  showFilterBar                // フィルタバー表示
  onControllerReady={(ctrl) => ...}      // コントローラ参照の取得
  className="my-explorer"      // CSSクラス
  style={{ height: 400 }}      // インラインスタイル
/>
```

### QuickOpen の使い方

```tsx
import { FileExplorer, QuickOpen } from 'momoi-explorer/ui'

function App() {
  const [ctrl, setCtrl] = useState<FileTreeController | null>(null)
  const [quickOpen, setQuickOpen] = useState(false)

  return (
    <>
      <FileExplorer
        adapter={adapter}
        rootPath={rootPath}
        onControllerReady={setCtrl}
      />
      {ctrl && (
        <QuickOpen
          controller={ctrl}
          isOpen={quickOpen}
          onClose={() => setQuickOpen(false)}
          onSelect={(entry) => openFile(entry.path)}
        />
      )}
    </>
  )
}
```

## 主要な型

```ts
interface FileEntry {
  name: string          // ファイル名
  path: string          // 絶対パス
  isDirectory: boolean  // ディレクトリか
  meta?: Record<string, unknown>  // 拡張用メタデータ
}

interface TreeNode extends FileEntry {
  depth: number
  children?: TreeNode[]
  childrenLoaded: boolean
}

interface FlatNode {
  node: TreeNode
  depth: number
}

interface TreeState {
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

type TreeEvent =
  | { type: 'expand'; path: string }
  | { type: 'collapse'; path: string }
  | { type: 'select'; paths: string[] }
  | { type: 'open'; path: string }
  | { type: 'rename'; oldPath: string; newPath: string }
  | { type: 'delete'; paths: string[] }
  | { type: 'create'; parentPath: string; name: string; isDirectory: boolean }
  | { type: 'refresh'; path?: string }
  | { type: 'external-change'; changes: WatchEvent[] }
```

## ファイル監視

`adapter.watch` を実装すると自動でファイル監視が有効になる。生イベントをそのまま投げるだけでよく、以下の処理はコアが自動で行う:

- **デバウンス** (75ms, VSCode準拠)
- **イベント合体**: rename → delete+create、delete+create(同一パス) → modify、親フォルダ削除時に子イベント除去
- **スロットリング**: 大量イベント時にチャンク分割（500件/200ms間隔）

```ts
const tree = createFileTree({
  adapter,
  rootPath: '/project',
  watchOptions: {
    debounceMs: 100,        // デフォルト: 75
    coalesce: true,         // デフォルト: true
    throttle: {
      maxChunkSize: 1000,   // デフォルト: 500
      delayMs: 300,         // デフォルト: 200
    },
  },
})
```

## ライセンス

MIT
