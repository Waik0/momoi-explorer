import { useState } from 'react'
import { FileExplorer } from 'momoi-explorer/ui'
import type { MenuItemDef, TreeNode } from 'momoi-explorer'
import { createElectronAdapter } from './adapter'
import 'momoi-explorer/ui/style.css'

const adapter = createElectronAdapter()

export function App(): React.JSX.Element {
  const [rootPath, setRootPath] = useState(process.cwd())

  const contextMenuItems = (nodes: TreeNode[]): MenuItemDef[] => [
    {
      id: 'open',
      label: 'Open',
      action: () => console.log('Open:', nodes.map((n) => n.path)),
    },
    {
      id: 'copy-path',
      label: 'Copy Path',
      shortcut: 'Ctrl+Shift+C',
      action: () => {
        const paths = nodes.map((n) => n.path).join('\n')
        navigator.clipboard.writeText(paths)
      },
    },
    { id: 'sep1', label: '', separator: true, action: () => {} },
    {
      id: 'delete',
      label: 'Delete',
      shortcut: 'Delete',
      action: () => console.log('Delete:', nodes.map((n) => n.path)),
    },
  ]

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <FileExplorer
        adapter={adapter}
        rootPath={rootPath}
        onOpen={(path) => console.log('Open file:', path)}
        contextMenuItems={contextMenuItems}
        filter={(entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules'}
      />
    </div>
  )
}
