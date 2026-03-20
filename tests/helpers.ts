// テスト用のインメモリFileSystemAdapter

import type { FileEntry, FileSystemAdapter, RawWatchEvent } from '../src/core/types'

export interface MemoryFsNode {
  name: string
  isDirectory: boolean
  children?: MemoryFsNode[]
}

export function createMemoryAdapter(tree: MemoryFsNode[]): FileSystemAdapter & {
  emitWatch(events: RawWatchEvent[]): void
} {
  let watchCallback: ((events: RawWatchEvent[]) => void) | null = null

  function findChildren(path: string, nodes: MemoryFsNode[], currentPath: string): MemoryFsNode[] | null {
    if (currentPath === path) {
      return nodes
    }
    for (const node of nodes) {
      if (node.isDirectory && node.children) {
        const childPath = currentPath ? `${currentPath}/${node.name}` : node.name
        if (path === childPath) {
          return node.children
        }
        const found = findChildren(path, node.children, childPath)
        if (found) return found
      }
    }
    return null
  }

  return {
    async readDir(path: string): Promise<FileEntry[]> {
      const children = path === '/root' ? tree : findChildren(path, tree, '/root')
      if (!children) return []
      return children.map((c) => ({
        name: c.name,
        path: `${path}/${c.name}`,
        isDirectory: c.isDirectory,
      }))
    },

    async rename(oldPath: string, newPath: string): Promise<void> {
      // テスト用: no-op
    },

    async delete(paths: string[]): Promise<void> {
      // テスト用: no-op
    },

    async createFile(parentPath: string, name: string): Promise<void> {
      const children = parentPath === '/root' ? tree : findChildren(parentPath, tree, '/root')
      if (children) {
        children.push({ name, isDirectory: false })
      }
    },

    async createDir(parentPath: string, name: string): Promise<void> {
      const children = parentPath === '/root' ? tree : findChildren(parentPath, tree, '/root')
      if (children) {
        children.push({ name, isDirectory: true, children: [] })
      }
    },

    watch(_path: string, callback: (events: RawWatchEvent[]) => void): () => void {
      watchCallback = callback
      return () => { watchCallback = null }
    },

    emitWatch(events: RawWatchEvent[]): void {
      watchCallback?.(events)
    },
  }
}
