// イベント処理ユーティリティ
//
// VSCode準拠のデバウンス・イベント合体・スロットリング

import type { RawWatchEvent, WatchEvent, WatchOptions } from './types'

const DEFAULT_DEBOUNCE_MS = 75
const DEFAULT_THROTTLE_CHUNK_SIZE = 500
const DEFAULT_THROTTLE_DELAY_MS = 200

/**
 * 生イベントを合体する（VSCode EventCoalescer 準拠）。
 * - rename → delete(old) + create(new) に分解
 * - delete + create（同一パス） → modify に合体
 * - create + modify（同一パス） → create を維持
 * - 親フォルダ delete → 子の delete を除去
 *
 * @param raw - アダプタから受け取った生イベントの配列
 * @returns 合体処理後のWatchEvent配列
 */
export function coalesceEvents(raw: RawWatchEvent[]): WatchEvent[] {
  // rename を分解
  const expanded: WatchEvent[] = []
  for (const event of raw) {
    if (event.type === 'rename' && event.newPath) {
      expanded.push({ type: 'delete', path: event.path, isDirectory: event.isDirectory })
      expanded.push({ type: 'create', path: event.newPath, isDirectory: event.isDirectory })
    } else {
      expanded.push({ type: event.type as WatchEvent['type'], path: event.path, isDirectory: event.isDirectory })
    }
  }

  // 同一パスのイベントを合体
  const byPath = new Map<string, WatchEvent>()
  for (const event of expanded) {
    const existing = byPath.get(event.path)
    if (!existing) {
      byPath.set(event.path, event)
      continue
    }

    // delete + create → modify
    if (existing.type === 'delete' && event.type === 'create') {
      byPath.set(event.path, { type: 'modify', path: event.path, isDirectory: event.isDirectory })
      continue
    }

    // create + modify → create を維持
    if (existing.type === 'create' && event.type === 'modify') {
      continue
    }

    // create + delete → 相殺して除去
    if (existing.type === 'create' && event.type === 'delete') {
      byPath.delete(event.path)
      continue
    }

    // それ以外は後勝ち
    byPath.set(event.path, event)
  }

  const result = Array.from(byPath.values())

  // 親フォルダ delete がある場合、子の delete を除去
  const deletedDirs = new Set<string>()
  for (const event of result) {
    if (event.type === 'delete' && event.isDirectory) {
      deletedDirs.add(event.path)
    }
  }

  if (deletedDirs.size === 0) return result

  return result.filter((event) => {
    if (event.type !== 'delete') return true
    for (const dir of deletedDirs) {
      if (event.path !== dir && event.path.startsWith(dir + '/')) {
        return false
      }
    }
    return true
  })
}

/**
 * イベントプロセッサを生成する。
 * デバウンス → 合体 → スロットリング → コールバック のパイプラインで処理する。
 *
 * @param callback - 処理済みイベントを受け取るコールバック
 * @param options - デバウンス・合体・スロットリングの設定
 * @returns push/flush/destroyメソッドを持つプロセッサオブジェクト
 */
export function createEventProcessor(
  callback: (events: WatchEvent[]) => void,
  options: WatchOptions = {},
): {
  push(events: RawWatchEvent[]): void
  flush(): void
  destroy(): void
} {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const shouldCoalesce = options.coalesce ?? true
  const throttleChunkSize = options.throttle?.maxChunkSize ?? DEFAULT_THROTTLE_CHUNK_SIZE
  const throttleDelayMs = options.throttle?.delayMs ?? DEFAULT_THROTTLE_DELAY_MS

  let buffer: RawWatchEvent[] = []
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let throttleTimer: ReturnType<typeof setTimeout> | null = null
  let destroyed = false

  function processBuffer(): void {
    if (destroyed || buffer.length === 0) return

    const raw = buffer
    buffer = []

    const events = shouldCoalesce ? coalesceEvents(raw) : raw.map((e) => ({
      type: e.type === 'rename' ? 'modify' as const : e.type as WatchEvent['type'],
      path: e.type === 'rename' && e.newPath ? e.newPath : e.path,
      isDirectory: e.isDirectory,
    }))

    if (events.length === 0) return

    // スロットリング: 大量イベントをチャンクに分割
    if (events.length <= throttleChunkSize) {
      callback(events)
      return
    }

    let offset = 0
    function emitChunk(): void {
      if (destroyed || offset >= events.length) return
      const chunk = events.slice(offset, offset + throttleChunkSize)
      offset += throttleChunkSize
      callback(chunk)
      if (offset < events.length) {
        throttleTimer = setTimeout(emitChunk, throttleDelayMs)
      }
    }
    emitChunk()
  }

  return {
    push(events: RawWatchEvent[]): void {
      if (destroyed) return
      buffer.push(...events)
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = setTimeout(processBuffer, debounceMs)
    },

    flush(): void {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
      processBuffer()
    },

    destroy(): void {
      destroyed = true
      if (debounceTimer !== null) clearTimeout(debounceTimer)
      if (throttleTimer !== null) clearTimeout(throttleTimer)
      buffer = []
    },
  }
}
