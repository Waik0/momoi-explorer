import type React from 'react'
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

// デフォルトのファイルアイコン
function FileIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 1h7l3 3v11H3z" fill="none" stroke="#888" strokeWidth="1" />
      <path d="M10 1v3h3" fill="none" stroke="#888" strokeWidth="1" />
    </svg>
  )
}

export interface TreeNodeRowProps {
  node: TreeNode
  depth: number
  isExpanded: boolean
  isSelected: boolean
  isRenaming: boolean
  onClick(e: React.MouseEvent): void
  onDoubleClick(): void
  onContextMenu(e: React.MouseEvent): void
  onToggleExpand(): void
  onCommitRename(newName: string): void
  onCancelRename(): void
  renderIcon?: (node: TreeNode, isExpanded: boolean) => React.ReactNode
  renderBadge?: (node: TreeNode) => React.ReactNode
}

export function TreeNodeRow({
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
            : <FileIcon />
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
}
