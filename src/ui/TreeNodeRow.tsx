import type React from 'react'
import { memo, useMemo } from 'react'
import { getIcon } from 'material-file-icons'
import type { TreeNode } from '../core/types'
import { InlineRename } from './InlineRename'

// デフォルトの展開/折りたたみ矢印SVG
function ChevronIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  )
}

// デフォルトのフォルダアイコン
function FolderIcon({ isExpanded }: { isExpanded: boolean }): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      {isExpanded ? (
        <path d="M1.5 3h5l1 1.5H14.5v9h-13z" fill="#dcb67a" opacity="0.9" />
      ) : (
        <path d="M1.5 2.5h5l1 1.5H14.5v10h-13z" fill="#dcb67a" />
      )}
    </svg>
  )
}

/**
 * material-file-iconsを使ったファイルアイコン。
 * ファイル名からアイコンを自動判定しSVGを描画する。
 */
function MaterialFileIcon({ filename }: { filename: string }): React.JSX.Element {
  const svg = useMemo(() => getIcon(filename).svg, [filename])
  return <span className="momoi-explorer-icon-inner" dangerouslySetInnerHTML={{ __html: svg }} />
}

/** {@link TreeNodeRow} に渡すprops */
export interface TreeNodeRowProps {
  /** 表示対象のノード */
  node: TreeNode
  /** ネスト深度（インデント量に使用） */
  depth: number
  /** ディレクトリが展開されているか */
  isExpanded: boolean
  /** 選択されているか */
  isSelected: boolean
  /** リネーム中か */
  isRenaming: boolean
  /** 行クリック時のハンドラ */
  onClick(e: React.MouseEvent): void
  /** 行ダブルクリック時のハンドラ */
  onDoubleClick(): void
  /** 右クリック時のハンドラ */
  onContextMenu(e: React.MouseEvent): void
  /** 展開/折りたたみトグル */
  onToggleExpand(): void
  /** リネーム確定時のハンドラ */
  onCommitRename(newName: string): void
  /** リネームキャンセル時のハンドラ */
  onCancelRename(): void
  /** ノードアイコンのカスタムレンダラー */
  renderIcon?: (node: TreeNode, isExpanded: boolean) => React.ReactNode
  /** ノード右端に表示するバッジのカスタムレンダラー */
  renderBadge?: (node: TreeNode) => React.ReactNode
}

/**
 * ツリーの1行を表すコンポーネント。
 * インデント・展開矢印・アイコン・ファイル名・バッジ・インラインリネームを描画する。
 */
export const TreeNodeRow = memo(function TreeNodeRow({
  node,
  depth,
  isExpanded,
  isSelected,
  isRenaming,
  onClick,
  onDoubleClick,
  onContextMenu,
  onToggleExpand,
  onCommitRename,
  onCancelRename,
  renderIcon,
  renderBadge,
}: TreeNodeRowProps): React.JSX.Element {
  return (
    <div
      className="momoi-explorer-row"
      data-selected={isSelected}
      data-path={node.path}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {/* インデントガイド */}
      <span className="momoi-explorer-indent">
        {Array.from({ length: depth }, (_, i) => (
          <span key={i} className="momoi-explorer-indent-guide" />
        ))}
      </span>

      {/* 展開矢印 */}
      <span
        className="momoi-explorer-chevron"
        data-expanded={isExpanded}
        data-is-dir={node.isDirectory}
        onClick={(e) => {
          e.stopPropagation()
          onToggleExpand()
        }}
      >
        <ChevronIcon />
      </span>

      {/* アイコン */}
      <span className="momoi-explorer-icon">
        {renderIcon
          ? renderIcon(node, isExpanded)
          : node.isDirectory
            ? <FolderIcon isExpanded={isExpanded} />
            : <MaterialFileIcon filename={node.name} />
        }
      </span>

      {/* 名前 or リネーム入力 */}
      {isRenaming ? (
        <InlineRename
          currentName={node.name}
          onCommit={onCommitRename}
          onCancel={onCancelRename}
        />
      ) : (
        <span className="momoi-explorer-name">{node.name}</span>
      )}

      {/* バッジ */}
      {renderBadge && (
        <span className="momoi-explorer-badge">
          {renderBadge(node)}
        </span>
      )}
    </div>
  )
})
