import { useCallback, useEffect, useRef, useState } from 'react'
import { FileExplorer } from 'momoi-explorer/ui'
import type { FileTreeController, MenuItemDef, TreeEvent, TreeNode } from 'momoi-explorer'
import { createElectronAdapter } from './adapter'
import 'momoi-explorer/ui/style.css'

const adapter = createElectronAdapter()

interface LogEntry {
  time: string
  type: string
  detail: string
}

function formatTime(): string {
  const d = new Date()
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}

export function App(): React.JSX.Element {
  const [rootPath, setRootPath] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [controllerRef, setControllerRef] = useState<FileTreeController | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electronAPI.getCwd().then(setRootPath)
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const addLog = useCallback((type: string, detail: string) => {
    setLogs((prev) => [...prev.slice(-200), { time: formatTime(), type, detail }])
  }, [])

  const handleEvent = useCallback((event: TreeEvent) => {
    switch (event.type) {
      case 'expand':
        addLog('expand', event.path)
        break
      case 'collapse':
        addLog('collapse', event.path)
        break
      case 'select':
        addLog('select', `${event.paths.length} items: ${event.paths.join(', ')}`)
        break
      case 'open':
        addLog('open', event.path)
        break
      case 'rename':
        addLog('rename', `${event.oldPath} → ${event.newPath}`)
        break
      case 'delete':
        addLog('delete', event.paths.join(', '))
        break
      case 'create':
        addLog('create', `${event.isDirectory ? 'dir' : 'file'}: ${event.parentPath}/${event.name}`)
        break
      case 'refresh':
        addLog('refresh', event.path ?? 'root')
        break
      case 'external-change':
        addLog('watch', `${event.changes.length} changes`)
        break
    }
  }, [addLog])

  const contextMenuItems = (nodes: TreeNode[]): MenuItemDef[] => {
    // 空白エリア右クリック → New File / New Folder のみ
    if (nodes.length === 0) {
      return [
        {
          id: 'new-file',
          label: 'New File',
          action: () => {
            controllerRef?.startCreate(rootPath!, false)
            addLog('menu:new-file', rootPath!)
          },
        },
        {
          id: 'new-folder',
          label: 'New Folder',
          action: () => {
            controllerRef?.startCreate(rootPath!, true)
            addLog('menu:new-folder', rootPath!)
          },
        },
      ]
    }

    const target = nodes[0]
    const parentPath = target.isDirectory ? target.path : target.path.replace(/[/\\][^/\\]+$/, '')

    return [
      {
        id: 'new-file',
        label: 'New File',
        action: () => {
          controllerRef?.startCreate(parentPath, false)
          addLog('menu:new-file', parentPath)
        },
      },
      {
        id: 'new-folder',
        label: 'New Folder',
        action: () => {
          controllerRef?.startCreate(parentPath, true)
          addLog('menu:new-folder', parentPath)
        },
      },
      { id: 'sep1', label: '', separator: true, action: () => {} },
      {
        id: 'open',
        label: 'Open',
        action: () => addLog('menu:open', nodes.map((n) => n.path).join(', ')),
      },
      {
        id: 'copy-path',
        label: 'Copy Path',
        shortcut: 'Ctrl+Shift+C',
        action: () => {
          const paths = nodes.map((n) => n.path).join('\n')
          navigator.clipboard.writeText(paths)
          addLog('menu:copy', paths)
        },
      },
      { id: 'sep2', label: '', separator: true, action: () => {} },
      {
        id: 'delete',
        label: 'Delete',
        shortcut: 'Delete',
        action: () => addLog('menu:delete', nodes.map((n) => n.path).join(', ')),
      },
    ]
  }

  if (!rootPath) {
    return <div style={{ color: '#888', padding: 16 }}>Loading...</div>
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', background: '#1e1e1e' }}>
      {/* ファイルツリー */}
      <div style={{ width: 300, borderRight: '1px solid #333', flexShrink: 0 }}>
        <div style={{
          height: 30,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          color: '#bbb',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          borderBottom: '1px solid #333',
        }}>
          Explorer
        </div>
        <div style={{ height: 'calc(100vh - 30px)' }}>
          <FileExplorer
            adapter={adapter}
            rootPath={rootPath}
            showFilterBar
            onOpen={(path) => addLog('open', path)}
            onEvent={handleEvent}
            contextMenuItems={contextMenuItems}
            onControllerReady={setControllerRef}
            filter={(entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules'}
          />
        </div>
      </div>

      {/* イベントログ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          color: '#bbb',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          borderBottom: '1px solid #333',
        }}>
          <span>Event Log</span>
          <span
            style={{ cursor: 'pointer', color: '#888', fontSize: 12 }}
            onClick={() => setLogs([])}
          >
            Clear
          </span>
        </div>
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '4px 0',
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: 12,
        }}>
          {logs.length === 0 && (
            <div style={{ color: '#555', padding: '12px', fontStyle: 'italic' }}>
              Interact with the file tree to see events here...
            </div>
          )}
          {logs.map((log, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 8,
                padding: '2px 12px',
                lineHeight: '18px',
                borderBottom: '1px solid #2a2a2a',
              }}
            >
              <span style={{ color: '#555', flexShrink: 0 }}>{log.time}</span>
              <span style={{
                color: eventColor(log.type),
                flexShrink: 0,
                minWidth: 80,
                fontWeight: 'bold',
              }}>
                {log.type}
              </span>
              <span style={{ color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.detail}
              </span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  )
}

function eventColor(type: string): string {
  switch (type) {
    case 'expand':
    case 'collapse':
      return '#569cd6'
    case 'select':
      return '#9cdcfe'
    case 'open':
      return '#4ec9b0'
    case 'rename':
      return '#dcdcaa'
    case 'delete':
    case 'menu:delete':
      return '#f44747'
    case 'create':
      return '#6a9955'
    case 'watch':
      return '#c586c0'
    default:
      return '#d4d4d4'
  }
}
