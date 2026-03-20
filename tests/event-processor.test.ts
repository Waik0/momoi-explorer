import { describe, it, expect, vi } from 'vitest'
import { coalesceEvents, createEventProcessor } from '../src/core/event-processor'
import type { RawWatchEvent } from '../src/core/types'

describe('coalesceEvents', () => {
  it('rename を delete + create に分解', () => {
    const result = coalesceEvents([
      { type: 'rename', path: '/a.txt', newPath: '/b.txt', isDirectory: false },
    ])
    expect(result).toEqual([
      { type: 'delete', path: '/a.txt', isDirectory: false },
      { type: 'create', path: '/b.txt', isDirectory: false },
    ])
  })

  it('delete + create → modify', () => {
    const result = coalesceEvents([
      { type: 'delete', path: '/a.txt', isDirectory: false },
      { type: 'create', path: '/a.txt', isDirectory: false },
    ])
    expect(result).toEqual([
      { type: 'modify', path: '/a.txt', isDirectory: false },
    ])
  })

  it('create + modify → create を維持', () => {
    const result = coalesceEvents([
      { type: 'create', path: '/a.txt', isDirectory: false },
      { type: 'modify', path: '/a.txt', isDirectory: false },
    ])
    expect(result).toEqual([
      { type: 'create', path: '/a.txt', isDirectory: false },
    ])
  })

  it('create + delete → 相殺して除去', () => {
    const result = coalesceEvents([
      { type: 'create', path: '/a.txt', isDirectory: false },
      { type: 'delete', path: '/a.txt', isDirectory: false },
    ])
    expect(result).toEqual([])
  })

  it('親フォルダ delete で子の delete を除去', () => {
    const result = coalesceEvents([
      { type: 'delete', path: '/dir', isDirectory: true },
      { type: 'delete', path: '/dir/a.txt', isDirectory: false },
      { type: 'delete', path: '/dir/b.txt', isDirectory: false },
    ])
    expect(result).toEqual([
      { type: 'delete', path: '/dir', isDirectory: true },
    ])
  })

  it('無関係のイベントはそのまま保持', () => {
    const result = coalesceEvents([
      { type: 'create', path: '/a.txt', isDirectory: false },
      { type: 'modify', path: '/b.txt', isDirectory: false },
      { type: 'delete', path: '/c.txt', isDirectory: false },
    ])
    expect(result).toHaveLength(3)
  })
})

describe('createEventProcessor', () => {
  it('デバウンスしてからコールバックが呼ばれる', async () => {
    const callback = vi.fn()
    const processor = createEventProcessor(callback, { debounceMs: 10 })

    processor.push([{ type: 'create', path: '/a.txt', isDirectory: false }])
    expect(callback).not.toHaveBeenCalled()

    await new Promise((r) => setTimeout(r, 50))
    expect(callback).toHaveBeenCalledTimes(1)
    processor.destroy()
  })

  it('flush で即座に処理', () => {
    const callback = vi.fn()
    const processor = createEventProcessor(callback, { debounceMs: 1000 })

    processor.push([{ type: 'modify', path: '/a.txt', isDirectory: false }])
    processor.flush()

    expect(callback).toHaveBeenCalledTimes(1)
    processor.destroy()
  })

  it('合体が適用される', () => {
    const callback = vi.fn()
    const processor = createEventProcessor(callback, { debounceMs: 0, coalesce: true })

    processor.push([
      { type: 'delete', path: '/a.txt', isDirectory: false },
      { type: 'create', path: '/a.txt', isDirectory: false },
    ])
    processor.flush()

    expect(callback).toHaveBeenCalledWith([
      { type: 'modify', path: '/a.txt', isDirectory: false },
    ])
    processor.destroy()
  })

  it('destroy 後は処理しない', async () => {
    const callback = vi.fn()
    const processor = createEventProcessor(callback, { debounceMs: 10 })

    processor.push([{ type: 'create', path: '/a.txt', isDirectory: false }])
    processor.destroy()

    await new Promise((r) => setTimeout(r, 50))
    expect(callback).not.toHaveBeenCalled()
  })
})
