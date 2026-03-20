# momoi-explorer

ヘッドレスファイルエクスプローラーライブラリ。コア（フレームワーク非依存） + React バインディング + デフォルト UI の3層構成。

## プロジェクト規約

### パッケージ調査
- 実装前にnpmなどでパッケージを調査。モダンな書き方ができそうだったり、設計面で有利だったり、コード量が減らせそうなものは積極的に導入を提案。

### 設計方針
- 設計時は導入するアーキテクチャやフォルダ構成を実績あるものから適切に選択する

## アーキテクチャ

```
momoi-explorer        … コアエンジン（フレームワーク非依存）
momoi-explorer/react  … React バインディング（hooks + context）
momoi-explorer/ui     … デフォルト UI コンポーネント（react-virtuoso による仮想スクロール）
```

- コア層はReactに依存しない。Vue/Svelte等でも使用可能
- React/react-dom は peerDependencies（オプション）
- ビルドは tsup で ESM/CJS 両対応

## フォルダ構成

```
src/
  core/         … フレームワーク非依存のコア
    types.ts    … 全型定義（FileSystemAdapter, FileTreeController, TreeState 等）
    tree.ts     … createFileTree() メインコントローラ
    event-processor.ts … デバウンス・イベント合体（VSCode準拠）
    flatten.ts  … ツリー→フラットリスト変換（仮想スクロール用）
    search.ts   … ファジー検索
    selection.ts … 選択状態管理
    sort.ts     … デフォルトソート
    filter.ts   … デフォルトフィルタ
  react/        … React バインディング
    TreeProvider.tsx … コンテキストプロバイダー
    useFileTree.ts  … ツリー全体の状態とコントローラを取得するhook
    useTreeNode.ts  … 個別ノードの状態を取得するhook
    useContextMenu.ts … コンテキストメニュー制御hook
    context.ts      … TreeContext定義
  ui/           … デフォルト UI
    FileExplorer.tsx … オールインワンコンポーネント
    TreeNodeRow.tsx  … ツリー1行
    ContextMenu.tsx  … 右クリックメニュー
    InlineRename.tsx … リネーム入力
    TreeFilterBar.tsx … フィルタバー
    QuickOpen.tsx    … クイックオープンダイアログ
    style.css        … VSCode風ダークテーマ
tests/          … vitest テスト
examples/
  browser-demo/ … ブラウザ版デモ（Vite + モックアダプタ）
  electron-app/ … Electron版デモ（実ファイルシステム）
```

## 重要な設計ポイント

### FileSystemAdapter パターン
- ユーザーが実装する唯一の必須インターフェース
- `readDir` のみ必須。`rename`, `delete`, `createFile`, `createDir`, `watch` はオプション
- オプションメソッドを実装すると対応するUI機能が有効になる
- `watch` は生イベントを投げるだけでOK。デバウンス・合体・スロットリングはコアが行う

### 状態管理
- `FileTreeController.subscribe()` で状態変更を購読（React では useFileTree が内部で使用）
- 状態は不変(immutable)。変更時は新オブジェクトが生成される
- `flatList` はツリーを展開状態に基づいてフラット化したもの。仮想スクロールに直接渡せる

### イベント処理
- `TreeEvent` でツリー操作を外部に通知（expand, collapse, select, open, rename, delete, create, refresh, external-change）
- ファイル監視イベントは VSCode 準拠の合体処理: rename→delete+create、delete+create(同一パス)→modify

## npm scripts

```bash
npm run build        # tsup でビルド
npm run dev          # ウォッチモード
npm test             # vitest テスト実行
npm run typecheck    # TypeScript 型チェック
npm run demo:browser # ブラウザデモ起動
npm run demo:electron # Electronデモ起動
```

## エクスポート一覧

### コア層 (`momoi-explorer`)
- `createFileTree(options)` → `FileTreeController`
- `flattenTree`, `computeSelection`, `fuzzyMatch`, `fuzzyFind`, `findMatchingPaths`
- `coalesceEvents`, `createEventProcessor`
- `defaultSort`, `defaultFilter`
- 型: `FileSystemAdapter`, `FileEntry`, `TreeNode`, `FlatNode`, `TreeState`, `TreeEvent`, `FileTreeOptions`, `FileTreeController`, `MenuItemDef` 等

### React層 (`momoi-explorer/react`)
- `TreeProvider` コンポーネント
- `useFileTree()`, `useTreeNode(path)`, `useContextMenu()`, `useTreeContext()`

### UI層 (`momoi-explorer/ui`)
- `FileExplorer`, `TreeNodeRow`, `ContextMenu`, `InlineRename`, `TreeFilterBar`, `QuickOpen`
- CSS: `momoi-explorer/ui/style.css`
