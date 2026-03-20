// 選択管理（単一/複数/範囲）

import type { FlatNode } from './types'

/**
 * replace: 既存選択をクリアして新しいパスのみ選択
 * toggle: 指定パスの選択を反転（Ctrl+Click）
 * range: anchorから指定パスまでの範囲を選択（Shift+Click）
 */
export function computeSelection(
  currentSelected: Set<string>,
  anchorPath: string | null,
  targetPath: string,
  mode: 'replace' | 'toggle' | 'range',
  flatList: FlatNode[],
): { selectedPaths: Set<string>; anchorPath: string } {
  switch (mode) {
    case 'replace':
      return {
        selectedPaths: new Set([targetPath]),
        anchorPath: targetPath,
      }

    case 'toggle': {
      const next = new Set(currentSelected)
      if (next.has(targetPath)) {
        next.delete(targetPath)
      } else {
        next.add(targetPath)
      }
      return {
        selectedPaths: next,
        anchorPath: targetPath,
      }
    }

    case 'range': {
      if (!anchorPath) {
        return {
          selectedPaths: new Set([targetPath]),
          anchorPath: targetPath,
        }
      }

      const paths = flatList.map((f) => f.node.path)
      const anchorIdx = paths.indexOf(anchorPath)
      const targetIdx = paths.indexOf(targetPath)

      if (anchorIdx === -1 || targetIdx === -1) {
        return {
          selectedPaths: new Set([targetPath]),
          anchorPath: targetPath,
        }
      }

      const start = Math.min(anchorIdx, targetIdx)
      const end = Math.max(anchorIdx, targetIdx)
      const rangePaths = new Set(paths.slice(start, end + 1))

      return {
        selectedPaths: rangePaths,
        anchorPath, // range選択ではanchorは変えない
      }
    }
  }
}
