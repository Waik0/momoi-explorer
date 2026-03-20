import { describe, it, expect } from 'vitest'
import { flattenTree } from '../src/core/flatten'
import type { TreeNode } from '../src/core/types'

function makeNodes(): TreeNode[] {
  return [
    {
      name: 'src',
      path: '/src',
      isDirectory: true,
      depth: 0,
      childrenLoaded: true,
      children: [
        { name: 'index.ts', path: '/src/index.ts', isDirectory: false, depth: 1, childrenLoaded: false },
        {
          name: 'lib',
          path: '/src/lib',
          isDirectory: true,
          depth: 1,
          childrenLoaded: true,
          children: [
            { name: 'util.ts', path: '/src/lib/util.ts', isDirectory: false, depth: 2, childrenLoaded: false },
          ],
        },
      ],
    },
    { name: 'README.md', path: '/README.md', isDirectory: false, depth: 0, childrenLoaded: false },
  ]
}

describe('flattenTree', () => {
  it('展開なしではルートのみ', () => {
    const result = flattenTree(makeNodes(), new Set())
    expect(result.map((f) => f.node.name)).toEqual(['src', 'README.md'])
  })

  it('フォルダ展開で子が含まれる', () => {
    const result = flattenTree(makeNodes(), new Set(['/src']))
    const names = result.map((f) => f.node.name)
    expect(names).toEqual(['src', 'index.ts', 'lib', 'README.md'])
  })

  it('ネストされた展開', () => {
    const result = flattenTree(makeNodes(), new Set(['/src', '/src/lib']))
    const names = result.map((f) => f.node.name)
    expect(names).toEqual(['src', 'index.ts', 'lib', 'util.ts', 'README.md'])
  })

  it('depth が正しく設定される', () => {
    const result = flattenTree(makeNodes(), new Set(['/src', '/src/lib']))
    const depths = result.map((f) => f.depth)
    expect(depths).toEqual([0, 1, 1, 2, 0])
  })
})
