// フィルタ

import type { FileEntry } from './types'

/**
 * デフォルトフィルタ: 全表示（フィルタなし）
 */
export function defaultFilter(_entry: FileEntry): boolean {
  return true
}
