import { useMemo } from 'react'
import { useTreeContext } from './context'
import type { TreeNode } from '../core/types'

export interface UseTreeNodeResult {
  node: TreeNode
  isExpanded: boolean
  isSelected: boolean
  isRenaming: boolean
  depth: number
}

/** 個別ノードの状態を取得 */
export function useTreeNode(path: string): UseTreeNodeResult | null {
  const { state } = useTreeContext()

  return useMemo(() => {
    const flatItem = state.flatList.find((f) => f.node.path === path)
    if (!flatItem) return null

    return {
      node: flatItem.node,
      isExpanded: state.expandedPaths.has(path),
      isSelected: state.selectedPaths.has(path),
      isRenaming: state.renamingPath === path,
      depth: flatItem.depth,
    }
  }, [state, path])
}
