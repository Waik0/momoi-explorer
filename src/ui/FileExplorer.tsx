import type React from 'react'
import { useCallback, useEffect, useMemo } from 'react'
import { Virtuoso } from 'react-virtuoso'
import type { FileSystemAdapter, FileTreeController, FileTreeOptions, MenuItemDef, TreeEvent, TreeNode } from '../core/types'
import { TreeProvider } from '../react/TreeProvider'
import { useFileTree } from '../react/useFileTree'
import { useContextMenu } from '../react/useContextMenu'
import { useDragDrop } from '../react/useDragDrop'
import { useExplorerKeybindings, type InputServiceLike } from '../react/useExplorerKeybindings'
import { useExplorerFocus } from '../react/useExplorerFocus'
import { TreeNodeRow } from './TreeNodeRow'
import { ContextMenu } from './ContextMenu'
import { TreeFilterBar } from './TreeFilterBar'
import { InlineRename } from './InlineRename'

/** {@link FileExplorer} に渡すprops */
export interface FileExplorerProps {
  /** ファイルシステム操作の実装 */
  adapter: FileSystemAdapter
  /** ツリーのルートディレクトリパス */
  rootPath: string
  /** ファイル/フォルダのソート関数 */
  sort?: FileTreeOptions['sort']
  /** 表示対象を絞り込むフィルタ関数 */
  filter?: FileTreeOptions['filter']
  /** ファイル監視の設定 */
  watchOptions?: FileTreeOptions['watchOptions']
  /** ツリー操作イベント（展開・選択・リネーム等）のコールバック */
  onEvent?: (event: TreeEvent) => void
  /** ファイルをダブルクリックで開いた際のコールバック */
  onOpen?: (path: string) => void
  /** ノードアイコンのカスタムレンダラー */
  renderIcon?: (node: TreeNode, isExpanded: boolean) => React.ReactNode
  /** ノード右端に表示するバッジのカスタムレンダラー */
  renderBadge?: (node: TreeNode) => React.ReactNode
  /** 右クリックメニューの項目を返す関数。選択中ノード群が渡される */
  contextMenuItems?: (nodes: TreeNode[]) => MenuItemDef[]
  /** ツリーフィルタバーを表示するか */
  showFilterBar?: boolean
  /** コントローラの参照を受け取るコールバック（QuickOpen等で使用） */
  onControllerReady?: (controller: FileTreeController) => void
  /** momoi-keybindのInputServiceインスタンス。キーバインドを有効化する */
  inputService?: InputServiceLike | null
  /** momoi-keybindを使わない場合のキーボードイベントハンドラ */
  onKeyDown?: (e: React.KeyboardEvent) => void
  /** ルート要素に付与するCSSクラス */
  className?: string
  /** ルート要素に付与するインラインスタイル */
  style?: React.CSSProperties
}

/** 新規作成行のアイテム型 */
interface CreateRowItem {
  type: 'create'
  parentPath: string
  isDirectory: boolean
  depth: number
}

/** 通常ノード行のアイテム型 */
interface NodeRowItem {
  type: 'node'
  node: TreeNode
  depth: number
}

type RowItem = NodeRowItem | CreateRowItem

function FileExplorerInner({
  onOpen,
  renderIcon,
  renderBadge,
  contextMenuItems,
  showFilterBar,
  onControllerReady,
  inputService,
  onKeyDown,
  dragEnabled,
}: Pick<FileExplorerProps, 'onOpen' | 'renderIcon' | 'renderBadge' | 'contextMenuItems' | 'showFilterBar' | 'onControllerReady' | 'inputService' | 'onKeyDown'> & { dragEnabled: boolean }): React.JSX.Element {
  const { flatList, expandedPaths, selectedPaths, renamingPath, creatingState, rootPath, controller } = useFileTree()

  useEffect(() => {
    onControllerReady?.(controller)
  }, [controller, onControllerReady])

  // momoi-keybind接続
  useExplorerKeybindings(inputService ?? null)
  const focusProps = useExplorerFocus(inputService ?? null)

  // DnD
  const dnd = useDragDrop(dragEnabled)

  const ctxMenu = useContextMenu()

  // flatListに新規作成行を挿入したリストを生成
  const rowItems = useMemo<RowItem[]>(() => {
    const items: RowItem[] = flatList.map((f) => ({
      type: 'node' as const,
      node: f.node,
      depth: f.depth,
    }))

    if (!creatingState) return items

    const { parentPath, isDirectory, insertAfterPath } = creatingState

    if (insertAfterPath) {
      // 指定ノードの直後に挿入（ファイル選択時のNew File）
      const idx = items.findIndex((item) => item.type === 'node' && (item as NodeRowItem).node.path === insertAfterPath)
      if (idx !== -1) {
        items.splice(idx + 1, 0, { type: 'create', parentPath, isDirectory, depth: items[idx].depth })
      }
    } else if (parentPath === rootPath) {
      // ルート末尾に挿入（選択なし時）
      items.push({ type: 'create', parentPath, isDirectory, depth: 0 })
    } else {
      // 親フォルダの子の先頭に挿入（フォルダ選択時）
      const parentIdx = items.findIndex((item) => item.type === 'node' && (item as NodeRowItem).node.path === parentPath)
      if (parentIdx !== -1) {
        const parentDepth = items[parentIdx].depth
        items.splice(parentIdx + 1, 0, { type: 'create', parentPath, isDirectory, depth: parentDepth + 1 })
      }
    }

    return items
  }, [flatList, creatingState, rootPath])

  const handleClick = useCallback((path: string, isDirectory: boolean, e: React.MouseEvent) => {
    if (e.shiftKey) {
      controller.select(path, 'range')
    } else if (e.ctrlKey || e.metaKey) {
      controller.select(path, 'toggle')
    } else {
      controller.select(path, 'replace')
      // シングルクリックでフォルダ展開/折りたたみ（VSCode方式）
      if (isDirectory) {
        controller.toggleExpand(path)
      }
    }
  }, [controller])

  const handleDoubleClick = useCallback((path: string, isDirectory: boolean) => {
    // ダブルクリックはファイルを開くだけ（フォルダは無視）
    if (!isDirectory) {
      onOpen?.(path)
    }
  }, [onOpen])

  const handleContextMenu = useCallback((e: React.MouseEvent, path: string) => {
    if (!selectedPaths.has(path)) {
      controller.select(path, 'replace')
    }
    ctxMenu.show(e, path)
  }, [controller, selectedPaths, ctxMenu])

  // 空白エリアの右クリック（nodes=[]で呼ばれる）
  const handleBackgroundContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    controller.clearSelection()
    ctxMenu.show(e, '')
  }, [controller, ctxMenu])

  const menuItems = useMemo(() => {
    if (!ctxMenu.isVisible || !contextMenuItems) return []
    // targetPath が空 = 空白エリアクリック → nodes=[]
    if (ctxMenu.targetPath === '') return contextMenuItems([])
    const targetNodes = flatList
      .filter((f) => selectedPaths.has(f.node.path))
      .map((f) => f.node)
    return contextMenuItems(targetNodes)
  }, [ctxMenu.isVisible, ctxMenu.targetPath, contextMenuItems, flatList, selectedPaths])

  return (
    <div
      style={{ height: '100%', outline: 'none' }}
      onContextMenu={handleBackgroundContextMenu}
      onKeyDown={onKeyDown}
      onFocus={focusProps.onFocus}
      onBlur={focusProps.onBlur}
      tabIndex={focusProps.tabIndex}
      onDragStart={dnd.handleDragStart}
      onDragOver={dnd.handleDragOver}
      onDragLeave={dnd.handleDragLeave}
      onDrop={dnd.handleDrop}
      onDragEnd={dnd.handleDragEnd}
    >
      {showFilterBar && <TreeFilterBar />}
      <Virtuoso
        totalCount={rowItems.length}
        fixedItemHeight={22}
        increaseViewportBy={200}
        computeItemKey={(index) => {
          const item = rowItems[index]
          return item.type === 'create' ? `__create__${item.parentPath}` : item.node.path
        }}
        itemContent={(index) => {
          const item = rowItems[index]

          if (item.type === 'create') {
            return (
              <div className="momoi-explorer-row">
                {/* TreeNodeRowと同じインデント構造 */}
                <span className="momoi-explorer-indent">
                  {Array.from({ length: item.depth }, (_, i) => (
                    <span key={i} className="momoi-explorer-indent-guide" />
                  ))}
                </span>
                <span className="momoi-explorer-chevron" data-is-dir="false">
                  <svg viewBox="0 0 16 16"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
                </span>
                <span className="momoi-explorer-icon">
                  {item.isDirectory ? '📁' : '📄'}
                </span>
                <InlineRename
                  currentName=""
                  onCommit={(name) => controller.commitCreate(name)}
                  onCancel={() => controller.cancelCreate()}
                />
              </div>
            )
          }

          const { node, depth } = item
          return (
            <TreeNodeRow
              node={node}
              depth={depth}
              isExpanded={expandedPaths.has(node.path)}
              isSelected={selectedPaths.has(node.path)}
              isRenaming={renamingPath === node.path}
              draggable={dragEnabled}
              onClick={(e) => handleClick(node.path, node.isDirectory, e)}
              onDoubleClick={() => handleDoubleClick(node.path, node.isDirectory)}
              onContextMenu={(e) => handleContextMenu(e, node.path)}
              onToggleExpand={() => controller.toggleExpand(node.path)}
              onCommitRename={(name) => controller.commitRename(name)}
              onCancelRename={() => controller.cancelRename()}
              renderIcon={renderIcon}
              renderBadge={renderBadge}
            />
          )
        }}
      />
      {ctxMenu.isVisible && menuItems.length > 0 && (
        <ContextMenu
          items={menuItems}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={ctxMenu.hide}
        />
      )}
    </div>
  )
}

/**
 * TreeProvider を内包するオールインワンのファイルエクスプローラーコンポーネント。
 * これ単体でファイルツリーUIが動作する。仮想スクロール対応。
 *
 * @example
 * ```tsx
 * import { FileExplorer } from 'momoi-explorer/ui'
 * import 'momoi-explorer/ui/style.css'
 *
 * <FileExplorer
 *   adapter={myAdapter}
 *   rootPath="/home/user/project"
 *   onOpen={(path) => openFile(path)}
 * />
 * ```
 */
export function FileExplorer({
  adapter,
  rootPath,
  sort,
  filter,
  watchOptions,
  onEvent,
  onOpen,
  renderIcon,
  renderBadge,
  contextMenuItems,
  showFilterBar,
  onControllerReady,
  inputService,
  onKeyDown,
  className,
  style,
}: FileExplorerProps): React.JSX.Element {
  return (
    <div className={`momoi-explorer ${className ?? ''}`} style={style}>
      <TreeProvider
        adapter={adapter}
        rootPath={rootPath}
        sort={sort}
        filter={filter}
        watchOptions={watchOptions}
        onEvent={onEvent}
      >
        <FileExplorerInner
          onOpen={onOpen}
          renderIcon={renderIcon}
          renderBadge={renderBadge}
          contextMenuItems={contextMenuItems}
          showFilterBar={showFilterBar}
          onControllerReady={onControllerReady}
          inputService={inputService}
          onKeyDown={onKeyDown}
          dragEnabled={!!adapter.move}
        />
      </TreeProvider>
    </div>
  )
}
