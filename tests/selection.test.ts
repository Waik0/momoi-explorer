import { describe, it, expect } from 'vitest'
import { computeSelection } from '../src/core/selection'
import type { FlatNode, TreeNode } from '../src/core/types'

function makeFlatList(): FlatNode[] {
  const nodes: TreeNode[] = [
    { name: 'a', path: '/a', isDirectory: false, depth: 0, childrenLoaded: false },
    { name: 'b', path: '/b', isDirectory: false, depth: 0, childrenLoaded: false },
    { name: 'c', path: '/c', isDirectory: false, depth: 0, childrenLoaded: false },
    { name: 'd', path: '/d', isDirectory: false, depth: 0, childrenLoaded: false },
  ]
  return nodes.map((n) => ({ node: n, depth: 0 }))
}

describe('computeSelection', () => {
  it('replace: 単一選択に切り替え', () => {
    const result = computeSelection(new Set(['/a', '/b']), '/a', '/c', 'replace', makeFlatList())
    expect(result.selectedPaths).toEqual(new Set(['/c']))
    expect(result.anchorPath).toBe('/c')
  })

  it('toggle: 選択を反転', () => {
    const result = computeSelection(new Set(['/a']), '/a', '/b', 'toggle', makeFlatList())
    expect(result.selectedPaths).toEqual(new Set(['/a', '/b']))
  })

  it('toggle: 既存選択を解除', () => {
    const result = computeSelection(new Set(['/a', '/b']), '/a', '/a', 'toggle', makeFlatList())
    expect(result.selectedPaths).toEqual(new Set(['/b']))
  })

  it('range: アンカーからターゲットまで選択', () => {
    const result = computeSelection(new Set(['/a']), '/a', '/c', 'range', makeFlatList())
    expect(result.selectedPaths).toEqual(new Set(['/a', '/b', '/c']))
  })

  it('range: 逆方向も動作', () => {
    const result = computeSelection(new Set(['/c']), '/c', '/a', 'range', makeFlatList())
    expect(result.selectedPaths).toEqual(new Set(['/a', '/b', '/c']))
  })

  it('range: アンカーなしの場合は単一選択', () => {
    const result = computeSelection(new Set(), null, '/b', 'range', makeFlatList())
    expect(result.selectedPaths).toEqual(new Set(['/b']))
  })
})
