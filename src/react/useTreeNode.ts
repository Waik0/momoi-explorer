import { useMemo } from 'react'
import { useTreeContext } from './context'
import type { TreeNode } from '../core/types'

/** {@link useTreeNode} の戻り値 */
export interface UseTreeNodeResult {
  /** ノード本体 */
  node: TreeNode
  /** ディレクトリが展開されているか */
  isExpanded: boolean
  /** 選択されているか */
  isSelected: boolean
  /** リネーム中か */
  isRenaming: boolean
  /** ツリー上のネスト深度 */
  depth: number
}

/**
 * 指定パスのノード状態を返すフック。
 * TreeProvider 内で使用すること。パスが見つからない場合は `null` を返す。
 * @param path - 取得したいノードのファイルパス
 * @returns ノードの状態。パスが見つからなければ `null`
 */
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
