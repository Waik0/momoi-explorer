// ブラウザ用のモックFileSystemAdapter

import type { FileEntry, FileSystemAdapter } from 'momoi-explorer'

interface MockNode {
  name: string
  isDirectory: boolean
  children?: MockNode[]
}

const MOCK_TREE: MockNode[] = [
  {
    name: '.github',
    isDirectory: true,
    children: [
      {
        name: 'workflows',
        isDirectory: true,
        children: [
          { name: 'ci.yml', isDirectory: false },
          { name: 'release.yml', isDirectory: false },
        ],
      },
    ],
  },
  {
    name: 'src',
    isDirectory: true,
    children: [
      {
        name: 'components',
        isDirectory: true,
        children: [
          { name: 'App.tsx', isDirectory: false },
          { name: 'Header.tsx', isDirectory: false },
          { name: 'Sidebar.tsx', isDirectory: false },
          {
            name: 'explorer',
            isDirectory: true,
            children: [
              { name: 'FileTree.tsx', isDirectory: false },
              { name: 'FileRow.tsx', isDirectory: false },
              { name: 'ContextMenu.tsx', isDirectory: false },
              { name: 'index.ts', isDirectory: false },
            ],
          },
          {
            name: 'editor',
            isDirectory: true,
            children: [
              { name: 'MonacoEditor.tsx', isDirectory: false },
              { name: 'TabBar.tsx', isDirectory: false },
              { name: 'index.ts', isDirectory: false },
            ],
          },
        ],
      },
      {
        name: 'hooks',
        isDirectory: true,
        children: [
          { name: 'useTheme.ts', isDirectory: false },
          { name: 'useKeyboard.ts', isDirectory: false },
        ],
      },
      {
        name: 'stores',
        isDirectory: true,
        children: [
          { name: 'app-store.ts', isDirectory: false },
          { name: 'file-store.ts', isDirectory: false },
        ],
      },
      { name: 'index.tsx', isDirectory: false },
      { name: 'main.ts', isDirectory: false },
      { name: 'global.css', isDirectory: false },
    ],
  },
  {
    name: 'tests',
    isDirectory: true,
    children: [
      { name: 'app.test.ts', isDirectory: false },
      { name: 'explorer.test.ts', isDirectory: false },
      { name: 'helpers.ts', isDirectory: false },
    ],
  },
  { name: '.gitignore', isDirectory: false },
  { name: 'package.json', isDirectory: false },
  { name: 'tsconfig.json', isDirectory: false },
  { name: 'vite.config.ts', isDirectory: false },
  { name: 'README.md', isDirectory: false },
]

function findChildren(path: string, nodes: MockNode[], currentPath: string): MockNode[] | null {
  if (currentPath === path) return nodes
  for (const node of nodes) {
    if (node.isDirectory && node.children) {
      const childPath = currentPath + '/' + node.name
      if (path === childPath) return node.children
      const found = findChildren(path, node.children, childPath)
      if (found) return found
    }
  }
  return null
}

export function createMockAdapter(): FileSystemAdapter {
  return {
    async readDir(path: string): Promise<FileEntry[]> {
      // 読み込み遅延をシミュレート
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 100))

      const children = path === '/project' ? MOCK_TREE : findChildren(path, MOCK_TREE, '/project')
      if (!children) return []

      return children.map((c) => ({
        name: c.name,
        path: path + '/' + c.name,
        isDirectory: c.isDirectory,
      }))
    },

    async rename(oldPath: string, newPath: string): Promise<void> {
      console.log('[mock] rename', oldPath, '->', newPath)
    },

    async delete(paths: string[]): Promise<void> {
      console.log('[mock] delete', paths)
    },

    async createFile(parentPath: string, name: string): Promise<void> {
      console.log('[mock] createFile', parentPath, name)
    },

    async createDir(parentPath: string, name: string): Promise<void> {
      console.log('[mock] createDir', parentPath, name)
    },
  }
}
