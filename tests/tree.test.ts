import { describe, it, expect, vi } from 'vitest'
import { createFileTree } from '../src/core/tree'
import { createMemoryAdapter } from './helpers'

function makeTree() {
  return createMemoryAdapter([
    {
      name: 'src',
      isDirectory: true,
      children: [
        { name: 'index.ts', isDirectory: false },
        { name: 'utils.ts', isDirectory: false },
        {
          name: 'components',
          isDirectory: true,
          children: [
            { name: 'App.tsx', isDirectory: false },
          ],
        },
      ],
    },
    { name: 'package.json', isDirectory: false },
    { name: 'README.md', isDirectory: false },
  ])
}

describe('createFileTree', () => {
  it('loadRoot でルートノードを読み込む', async () => {
    const adapter = makeTree()
    const tree = createFileTree({ adapter, rootPath: '/root' })
    await tree.loadRoot()

    const state = tree.getState()
    expect(state.rootNodes).toHaveLength(3)
    // フォルダが先に来る（デフォルトソート）
    expect(state.rootNodes[0].name).toBe('src')
    expect(state.rootNodes[0].isDirectory).toBe(true)
    expect(state.rootNodes[1].name).toBe('package.json')
    expect(state.rootNodes[2].name).toBe('README.md')
    tree.destroy()
  })

  it('expand でフォルダを展開できる', async () => {
    const adapter = makeTree()
    const tree = createFileTree({ adapter, rootPath: '/root' })
    await tree.loadRoot()
    await tree.expand('/root/src')

    const state = tree.getState()
    expect(state.expandedPaths.has('/root/src')).toBe(true)
    // flatListに子が含まれる
    const names = state.flatList.map((f) => f.node.name)
    expect(names).toContain('index.ts')
    expect(names).toContain('utils.ts')
    expect(names).toContain('components')
    tree.destroy()
  })

  it('collapse でフォルダを閉じる', async () => {
    const adapter = makeTree()
    const tree = createFileTree({ adapter, rootPath: '/root' })
    await tree.loadRoot()
    await tree.expand('/root/src')
    tree.collapse('/root/src')

    const state = tree.getState()
    expect(state.expandedPaths.has('/root/src')).toBe(false)
    expect(state.flatList).toHaveLength(3) // ルートのみ
    tree.destroy()
  })

  it('select で単一選択', async () => {
    const adapter = makeTree()
    const tree = createFileTree({ adapter, rootPath: '/root' })
    await tree.loadRoot()

    tree.select('/root/package.json')
    expect(tree.getState().selectedPaths.has('/root/package.json')).toBe(true)
    expect(tree.getState().selectedPaths.size).toBe(1)
    tree.destroy()
  })

  it('select toggle で複数選択', async () => {
    const adapter = makeTree()
    const tree = createFileTree({ adapter, rootPath: '/root' })
    await tree.loadRoot()

    tree.select('/root/package.json')
    tree.select('/root/README.md', 'toggle')
    expect(tree.getState().selectedPaths.size).toBe(2)

    tree.select('/root/package.json', 'toggle')
    expect(tree.getState().selectedPaths.size).toBe(1)
    expect(tree.getState().selectedPaths.has('/root/README.md')).toBe(true)
    tree.destroy()
  })

  it('select range で範囲選択', async () => {
    const adapter = makeTree()
    const tree = createFileTree({ adapter, rootPath: '/root' })
    await tree.loadRoot()

    tree.select('/root/src')
    tree.select('/root/README.md', 'range')
    expect(tree.getState().selectedPaths.size).toBe(3)
    tree.destroy()
  })

  it('subscribe で状態変更を通知', async () => {
    const adapter = makeTree()
    const tree = createFileTree({ adapter, rootPath: '/root' })
    const listener = vi.fn()
    tree.subscribe(listener)

    await tree.loadRoot()
    expect(listener).toHaveBeenCalled()
    tree.destroy()
  })

  it('onEvent で展開イベントを通知', async () => {
    const adapter = makeTree()
    const onEvent = vi.fn()
    const tree = createFileTree({ adapter, rootPath: '/root', onEvent })
    await tree.loadRoot()
    await tree.expand('/root/src')

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'expand', path: '/root/src' }),
    )
    tree.destroy()
  })

  it('filter で表示を制限', async () => {
    const adapter = makeTree()
    const tree = createFileTree({
      adapter,
      rootPath: '/root',
      filter: (entry) => entry.name !== 'README.md',
    })
    await tree.loadRoot()

    const names = tree.getState().rootNodes.map((n) => n.name)
    expect(names).not.toContain('README.md')
    expect(names).toHaveLength(2)
    tree.destroy()
  })

  it('カスタムソートが適用される', async () => {
    const adapter = makeTree()
    const tree = createFileTree({
      adapter,
      rootPath: '/root',
      sort: (a, b) => b.name.localeCompare(a.name), // 逆順
    })
    await tree.loadRoot()

    const names = tree.getState().rootNodes.map((n) => n.name)
    expect(names[0]).toBe('src')
    expect(names[1]).toBe('README.md')
    expect(names[2]).toBe('package.json')
    tree.destroy()
  })

  it('startRename / cancelRename', async () => {
    const adapter = makeTree()
    const tree = createFileTree({ adapter, rootPath: '/root' })
    await tree.loadRoot()

    tree.startRename('/root/package.json')
    expect(tree.getState().renamingPath).toBe('/root/package.json')

    tree.cancelRename()
    expect(tree.getState().renamingPath).toBeNull()
    tree.destroy()
  })

  it('深いフォルダまで展開できる', async () => {
    const adapter = makeTree()
    const tree = createFileTree({ adapter, rootPath: '/root' })
    await tree.loadRoot()
    await tree.expand('/root/src')
    await tree.expand('/root/src/components')

    const state = tree.getState()
    const names = state.flatList.map((f) => f.node.name)
    expect(names).toContain('App.tsx')

    const appNode = state.flatList.find((f) => f.node.name === 'App.tsx')
    expect(appNode?.depth).toBe(2)
    tree.destroy()
  })
})
