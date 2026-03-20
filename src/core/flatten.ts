// ツリー → フラットリスト変換（仮想スクロール用）

import type { FlatNode, TreeNode } from './types'

/**
 * 展開されたツリーをフラットリストに変換する。
 * react-virtuoso等の仮想スクロールに渡すためのもの。
 * matchingPaths が指定された場合、そこに含まれるノードのみ表示する。
 */
export function flattenTree(
  nodes: TreeNode[],
  expandedPaths: Set<string>,
  matchingPaths?: Set<string> | null,
): FlatNode[] {
  const result: FlatNode[] = []

  function walk(children: TreeNode[], depth: number): void {
    for (const node of children) {
      if (matchingPaths && !matchingPaths.has(node.path)) continue

      result.push({ node, depth })
      if (node.isDirectory && node.children) {
        // 検索中はマッチしたディレクトリを自動展開
        if (matchingPaths || expandedPaths.has(node.path)) {
          walk(node.children, depth + 1)
        }
      }
    }
  }

  walk(nodes, 0)
  return result
}
