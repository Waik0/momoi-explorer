// ツリー → フラットリスト変換（仮想スクロール用）

import type { FlatNode, TreeNode } from './types'

/**
 * 展開されたツリーをフラットリストに変換する。
 * react-virtuoso等の仮想スクロールに渡すためのもの。
 */
export function flattenTree(
  nodes: TreeNode[],
  expandedPaths: Set<string>,
): FlatNode[] {
  const result: FlatNode[] = []

  function walk(children: TreeNode[], depth: number): void {
    for (const node of children) {
      result.push({ node, depth })
      if (node.isDirectory && expandedPaths.has(node.path) && node.children) {
        walk(node.children, depth + 1)
      }
    }
  }

  walk(nodes, 0)
  return result
}
