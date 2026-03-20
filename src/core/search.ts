// ファイル名検索ユーティリティ

import type { FileEntry, TreeNode } from './types'

/**
 * ファジーマッチ: クエリの各文字が順番に含まれているかチェック
 * スコアも返す（連続マッチ・先頭マッチ・セパレータ後マッチが高スコア）
 */
export function fuzzyMatch(query: string, target: string): { match: boolean; score: number } {
  const q = query.toLowerCase()
  const t = target.toLowerCase()

  if (q.length === 0) return { match: true, score: 0 }
  if (q.length > t.length) return { match: false, score: 0 }

  // 完全一致は最高スコア
  if (t === q) return { match: true, score: 100 }

  // 前方一致は高スコア
  if (t.startsWith(q)) return { match: true, score: 90 }

  // 部分一致
  if (t.includes(q)) return { match: true, score: 80 }

  // ファジーマッチ
  let qi = 0
  let score = 0
  let lastMatchIndex = -2

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++
      // 連続マッチボーナス
      if (ti === lastMatchIndex + 1) {
        score += 5
      }
      // セパレータ直後のマッチボーナス（パス区切り、ハイフン、アンダースコア等）
      if (ti === 0 || '/\\-_.'.includes(t[ti - 1])) {
        score += 10
      }
      score += 1
      lastMatchIndex = ti
    }
  }

  if (qi < q.length) return { match: false, score: 0 }
  return { match: true, score }
}

/**
 * ツリーフィルタ用: クエリにマッチするノードとその祖先を残す
 * マッチしたパスのSetを返す
 */
export function findMatchingPaths(
  nodes: TreeNode[],
  query: string,
): Set<string> {
  const matching = new Set<string>()

  function walk(node: TreeNode, ancestors: string[]): boolean {
    const nameMatch = fuzzyMatch(query, node.name).match
    let childMatch = false

    if (node.children) {
      for (const child of node.children) {
        if (walk(child, [...ancestors, node.path])) {
          childMatch = true
        }
      }
    }

    if (nameMatch || childMatch) {
      matching.add(node.path)
      for (const a of ancestors) {
        matching.add(a)
      }
      return true
    }
    return false
  }

  for (const node of nodes) {
    walk(node, [])
  }

  return matching
}

/**
 * ファジーファインド用: 全ファイルからスコア順に候補を返す
 */
export function fuzzyFind(
  files: FileEntry[],
  query: string,
  maxResults: number = 50,
): FileEntry[] {
  if (!query) return []

  const scored: Array<{ entry: FileEntry; score: number }> = []

  for (const entry of files) {
    // ファイル名でマッチ
    const nameResult = fuzzyMatch(query, entry.name)
    // パスでもマッチ（スコアは低め）
    const pathResult = fuzzyMatch(query, entry.path)

    const bestScore = Math.max(nameResult.score, pathResult.score * 0.5)

    if (nameResult.match || pathResult.match) {
      scored.push({ entry, score: bestScore })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, maxResults).map((s) => s.entry)
}
