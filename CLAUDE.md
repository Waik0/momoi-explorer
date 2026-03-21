# momoi-explorer

ヘッドレスファイルエクスプローラーライブラリ。コア（フレームワーク非依存） + React バインディング + デフォルト UI の3層構成。

## プロジェクト規約

### パッケージ調査
- 実装前にnpmなどでパッケージを調査。モダンな書き方ができそうだったり、設計面で有利だったり、コード量が減らせそうなものは積極的に導入を提案。

### 設計方針
- 設計時は導入するアーキテクチャやフォルダ構成を実績あるものから適切に選択する
- エクスポートするAPIは最小限に。内部実装の詳細は公開しない

### ドキュメント規約（他プロジェクトのClaude対応）

このパッケージは npm install で他プロジェクトに導入される。
そのプロジェクトの Claude Code が正しくAPIを扱えるよう、以下を常に整備すること。

#### README.md
- パッケージの目的・アーキテクチャ概要
- インストール方法
- クイックスタート（最短で動くコード例）
- API リファレンス（エクスポートされる関数・型・コンポーネントの一覧と説明）
- 主要な型定義のスニペット
- 設定・オプションの表

#### TSDoc
- エクスポートされる全ての関数・インターフェース・型・コンポーネントに TSDoc を付ける
- `.d.ts` に反映されるため、他プロジェクトの Claude が `get_hover` で参照できる
- 日本語で書く。`@param`, `@returns` を適宜使用
- 最重要API（メインエントリポイント、ユーザー実装インターフェース）には `@example` を付ける
- 内部関数やプライベートなものには不要

#### 整備タイミング
- 新しいAPIを追加・変更したら、README.md と TSDoc を同時に更新する
- ビルド後に `.d.ts` にTSDocが反映されていることを確認する

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
    useDragDrop.ts  … ドラッグ&ドロップ制御hook
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
- `readDir` のみ必須。`rename`, `delete`, `createFile`, `createDir`, `move`, `watch` はオプション
- オプションメソッドを実装すると対応するUI機能が有効になる
- `watch` は生イベントを投げるだけでOK。デバウンス・合体・スロットリングはコアが行う

### 状態管理
- `FileTreeController.subscribe()` で状態変更を購読（React では useFileTree が内部で使用）
- 状態は不変(immutable)。変更時は新オブジェクトが生成される
- `flatList` はツリーを展開状態に基づいてフラット化したもの。仮想スクロールに直接渡せる

### イベント処理
- `TreeEvent` でツリー操作を外部に通知（expand, collapse, select, open, rename, delete, create, move, refresh, external-change）
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
- `useFileTree()`, `useTreeNode(path)`, `useContextMenu()`, `useDragDrop(enabled)`, `useTreeContext()`

### UI層 (`momoi-explorer/ui`)
- `FileExplorer`, `TreeNodeRow`, `ContextMenu`, `InlineRename`, `TreeFilterBar`, `QuickOpen`
- CSS: `momoi-explorer/ui/style.css`

## ドラッグ&ドロップ（VSCode準拠）

- `FileSystemAdapter.move(srcPath, destDir)` を実装するとDnDが有効になる
- ドロップ先はフォルダのみ（ファイル行へのドロップは親フォルダに解決）
- 閉じたフォルダ上で500msホバー → 自動展開
- 自分自身・子孫・同一親フォルダへのドロップは禁止
- 複数選択のドラッグ対応（選択済みアイテムをドラッグで全選択がドラッグ対象）
- ドラッグ中のビジュアルはDOM直接操作（パフォーマンス最適化、React再レンダリングなし）
- `data-dragging` / `data-drag-over` 属性でCSS制御

## ファイルアイコン

- UI層のデフォルトアイコンは `material-file-icons`（377アイコン・MIT・ゼロ依存）
- `TreeNodeRow` / `QuickOpen` でファイル名から自動判定してSVGを描画
- `renderIcon` prop でカスタムアイコンに差し替え可能（ヘッドレス設計を維持）
- コア層はアイコンに依存しない
