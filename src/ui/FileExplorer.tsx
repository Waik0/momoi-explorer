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
}: Pick<FileExplorerProps, 'onOpen' | 'renderIcon' | 'renderBadge' | 'contextMenuItems' | 'showFilterBar' | 'onControllerReady'>): React.JSX.Element {
  const { flatList, expandedPaths, selectedPaths, renamingPath, creatingState, rootPath, controller } = useFileTree()

  useEffect(() => {
    onControllerReady?.(controller)
  }, [controller, onControllerReady])
  const ctxMenu = useContextMenu()

  // flatListに新規作成行を挿入したリストを生成
  const rowItems = useMemo<RowItem[]>(() => {
    const items: RowItem[] = flatList.map((f) => ({
      type: 'node' as const,
      node: f.node,
      depth: f.depth,
    }))

    if (!creatingState) return items

    const { parentPath, isDirectory } = creatingState

    if (parentPath === rootPath) {
      // ルート直下: フォルダ作成なら先頭、ファイル作成ならフォルダの後
      let insertIdx = 0
      if (!isDirectory) {
        // フォルダの後に挿入
        while (insertIdx < items.length && items[insertIdx].type === 'node' && items[insertIdx].depth === 0 && (items[insertIdx] as NodeRowItem).node.isDirectory) {
          insertIdx++
        }
      }
      items.splice(insertIdx, 0, { type: 'create', parentPath, isDirectory, depth: 0 })
    } else {
      // 親フォルダの直後（子の先頭）に挿入
      const parentIdx = items.findIndex((item) => item.type === 'node' && (item as NodeRowItem).node.path === parentPath)
      if (parentIdx !== -1) {
        const parentDepth = items[parentIdx].depth
        items.splice(parentIdx + 1, 0, { type: 'create', parentPath, isDirectory, depth: parentDepth + 1 })
      }
    }

    return items
  }, [flatList, creatingState, rootPath])

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
    <div style={{ height: '100%' }} onContextMenu={handleBackgroundContextMenu}>
      {showFilterBar && <TreeFilterBar />}
      <Virtuoso
        totalCount={rowItems.length}
        fixedItemHeight={22}
        itemContent={(index) => {
          const item = rowItems[index]

          if (item.type === 'create') {
            return (
              <div className="momoi-explorer-row" style={{ paddingLeft: item.depth * 16 + 32 }}>
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
