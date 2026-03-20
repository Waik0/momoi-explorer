// ソート

import type { FileEntry } from './types'

/**
 * デフォルトソート: フォルダ優先 → 名前の大文字小文字無視で昇順
 */
export function defaultSort(a: FileEntry, b: FileEntry): number {
  if (a.isDirectory !== b.isDirectory) {
    return a.isDirectory ? -1 : 1
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}
