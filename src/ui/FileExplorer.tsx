import type React from 'react'
import { useCallback, useEffect, useMemo } from 'react'
import { Virtuoso } from 'react-virtuoso'
import type { FileSystemAdapter, FileTreeController, FileTreeOptions, MenuItemDef, TreeEvent, TreeNode } from '../core/types'
import { TreeProvider } from '../react/TreeProvider'
import { useFileTree } from '../react/useFileTree'
import { useContextMenu } from '../react/useContextMenu'
import { TreeNodeRow } from './TreeNodeRow'
import { ContextMenu } from './ContextMenu'
import { TreeFilterBar } from './TreeFilterBar'

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
  /** ルート要素に付与するCSSクラス */
  className?: string
  /** ルート要素に付与するインラインスタイル */
  style?: React.CSSProperties
}

function FileExplorerInner({
  onOpen,
  renderIcon,
  renderBadge,
  contextMenuItems,
  showFilterBar,
  onControllerReady,
}: Pick<FileExplorerProps, 'onOpen' | 'renderIcon' | 'renderBadge' | 'contextMenuItems' | 'showFilterBar' | 'onControllerReady'>): React.JSX.Element {
  const { flatList, expandedPaths, selectedPaths, renamingPath, controller } = useFileTree()

  useEffect(() => {
    onControllerReady?.(controller)
  }, [controller, onControllerReady])
  const ctxMenu = useContextMenu()

  const handleClick = useCallback((path: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      controller.select(path, 'range')
    } else if (e.ctrlKey || e.metaKey) {
      controller.select(path, 'toggle')
    } else {
      controller.select(path, 'replace')
    }
  }, [controller])

  const handleDoubleClick = useCallback((path: string, isDirectory: boolean) => {
    if (isDirectory) {
      controller.toggleExpand(path)
    } else {
      onOpen?.(path)
    }
  }, [controller, onOpen])

  const handleContextMenu = useCallback((e: React.MouseEvent, path: string) => {
    if (!selectedPaths.has(path)) {
      controller.select(path, 'replace')
    }
    ctxMenu.show(e, path)
  }, [controller, selectedPaths, ctxMenu])

  const menuItems = useMemo(() => {
    if (!ctxMenu.isVisible || !contextMenuItems) return []
    const targetNodes = flatList
      .filter((f) => selectedPaths.has(f.node.path))
      .map((f) => f.node)
    return contextMenuItems(targetNodes)
  }, [ctxMenu.isVisible, contextMenuItems, flatList, selectedPaths])

  return (
    <>
      {showFilterBar && <TreeFilterBar />}
      <Virtuoso
        totalCount={flatList.length}
        fixedItemHeight={22}
        itemContent={(index) => {
          const { node, depth } = flatList[index]
          return (
            <TreeNodeRow
              node={node}
              depth={depth}
              isExpanded={expandedPaths.has(node.path)}
              isSelected={selectedPaths.has(node.path)}
              isRenaming={renamingPath === node.path}
              onClick={(e) => handleClick(node.path, e)}
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
    </>
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
        />
      </TreeProvider>
    </div>
  )
}
