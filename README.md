# momoi-explorer

A headless file explorer library. Framework-agnostic core + React bindings + default UI in a 3-layer architecture.

## Install

```bash
npm install momoi-explorer
```

## Architecture

Three entry points with a layered architecture:

| Entry Point | Purpose | Requires React |
|---|---|---|
| `momoi-explorer` | Core engine (framework-agnostic) | No |
| `momoi-explorer/react` | React bindings (hooks + context) | Yes |
| `momoi-explorer/ui` | Default UI components | Yes |

## Quick Start

### 1. Implement a FileSystemAdapter

Everything starts with implementing `FileSystemAdapter`. Only `readDir` is required; other methods are optional (implementing them enables the corresponding features).

```ts
import type { FileSystemAdapter } from 'momoi-explorer'

const adapter: FileSystemAdapter = {
  // Required: return directory contents
  async readDir(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries.map(e => ({
      name: e.name,
      path: path.join(dirPath, e.name),
      isDirectory: e.isDirectory(),
    }))
  },
  // Optional: rename
  async rename(oldPath, newPath) {
    await fs.rename(oldPath, newPath)
  },
  // Optional: delete
  async delete(paths) {
    for (const p of paths) await fs.rm(p, { recursive: true })
  },
  // Optional: create file
  async createFile(parentPath, name) {
    await fs.writeFile(path.join(parentPath, name), '')
  },
  // Optional: create directory
  async createDir(parentPath, name) {
    await fs.mkdir(path.join(parentPath, name))
  },
  // Optional: file watching (debounce & coalescing handled by core)
  watch(dirPath, callback) {
    const watcher = fs.watch(dirPath, { recursive: true }, (event, filename) => {
      callback([{ type: event === 'rename' ? 'create' : 'modify', path: filename, isDirectory: false }])
    })
    return () => watcher.close()
  },
}
```

### 2a. Use the Default UI (easiest)

```tsx
import { FileExplorer } from 'momoi-explorer/ui'
import 'momoi-explorer/ui/style.css'

function App() {
  return (
    <FileExplorer
      adapter={adapter}
      rootPath="/home/user/project"
      onOpen={(path) => openFile(path)}
      onEvent={(e) => console.log('tree event:', e)}
      showFilterBar
    />
  )
}
```

### 2b. Build Custom UI with React Hooks

```tsx
import { TreeProvider, useFileTree, useTreeNode } from 'momoi-explorer/react'

function App() {
  return (
    <TreeProvider adapter={adapter} rootPath="/home/user/project">
      <MyCustomTree />
    </TreeProvider>
  )
}

function MyCustomTree() {
  const { flatList, controller } = useFileTree()

  return (
    <div>
      {flatList.map(({ node, depth }) => (
        <div key={node.path} style={{ paddingLeft: depth * 16 }}>
          <span onClick={() => controller.toggleExpand(node.path)}>
            {node.name}
          </span>
        </div>
      ))}
    </div>
  )
}
```

### 2c. Core Only (framework-agnostic)

```ts
import { createFileTree } from 'momoi-explorer'

const tree = createFileTree({
  adapter,
  rootPath: '/home/user/project',
  onEvent: (e) => console.log(e),
})

// Subscribe to state changes
tree.subscribe((state) => {
  console.log('nodes:', state.rootNodes)
  console.log('flatList:', state.flatList)
})

// Load the tree
await tree.loadRoot()

// Operations
await tree.expand('/home/user/project/src')
tree.select('/home/user/project/src/index.ts')
tree.setSearchQuery('config')

// Cleanup
tree.destroy()
```

## API Reference

### Core (`momoi-explorer`)

#### `createFileTree(options): FileTreeController`

Main entry point for the headless file tree.

**FileTreeOptions:**
| Property | Type | Description |
|---|---|---|
| `adapter` | `FileSystemAdapter` | File system adapter (required) |
| `rootPath` | `string` | Absolute path to the root directory |
| `sort` | `(a, b) => number` | Custom sort function |
| `filter` | `(entry) => boolean` | Custom filter function |
| `watchOptions` | `WatchOptions` | File watching options |
| `onEvent` | `(event: TreeEvent) => void` | Event callback |

**FileTreeController Methods:**

| Method | Description |
|---|---|
| `getState()` | Get current TreeState |
| `subscribe(listener)` | Subscribe to state changes. Returns unsubscribe function |
| `loadRoot()` | Load and initialize root (must be called first) |
| `expand(path)` | Expand a directory |
| `collapse(path)` | Collapse a directory |
| `toggleExpand(path)` | Toggle expand/collapse |
| `expandTo(path)` | Expand all ancestors up to the given path |
| `select(path, mode?)` | Select a node (mode: 'replace' / 'toggle' / 'range') |
| `selectAll()` | Select all nodes |
| `clearSelection()` | Clear selection |
| `startRename(path)` | Enter rename mode |
| `commitRename(newName)` | Commit rename |
| `cancelRename()` | Cancel rename |
| `startCreate(parentPath, isDirectory, insertAfterPath?)` | Enter inline creation mode (insertAfterPath: position for the input row) |
| `commitCreate(name)` | Commit creation |
| `cancelCreate()` | Cancel creation |
| `createFile(parentPath, name)` | Create a file |
| `createDir(parentPath, name)` | Create a directory |
| `deleteSelected()` | Delete selected items |
| `refresh(path?)` | Refresh the tree (preserves expanded state) |
| `setSearchQuery(query)` | Set fuzzy search query (null to clear) |
| `collectAllFiles()` | Recursively collect all files (for QuickOpen) |
| `setFilter(fn)` | Dynamically change the filter function |
| `setSort(fn)` | Dynamically change the sort function |
| `destroy()` | Destroy the controller (stops watching, clears subscriptions) |

#### Utility Functions

| Function | Description |
|---|---|
| `flattenTree(nodes, expandedPaths, matchingPaths?)` | Convert tree to flat list |
| `computeSelection(current, anchor, target, mode, flatList)` | Compute selection state |
| `fuzzyMatch(query, target)` | Fuzzy match (match + score) |
| `fuzzyFind(files, query, maxResults?)` | Fuzzy search sorted by score |
| `findMatchingPaths(nodes, query)` | Return Set of matching paths |
| `coalesceEvents(raw)` | Coalesce raw watch events |
| `createEventProcessor(callback, options?)` | Event processor with debounce |
| `defaultSort(a, b)` | Default sort (directories first, name ascending) |
| `defaultFilter(entry)` | Default filter (show all) |
| `ExplorerCommands` | Explorer command ID constants (DELETE, RENAME, etc.) |
| `defaultExplorerKeybindings` | Default keybinding definitions (for momoi-keybind) |

### React (`momoi-explorer/react`)

| Export | Kind | Description |
|---|---|---|
| `TreeProvider` | Component | File tree context provider. Calls `createFileTree` + `loadRoot` internally |
| `useFileTree()` | Hook | Returns full tree state and controller |
| `useTreeNode(path)` | Hook | Returns expand/select/rename state for a node (null if not found) |
| `useContextMenu()` | Hook | Context menu visibility control (show/hide + position) |
| `useExplorerKeybindings(inputService)` | Hook | momoi-keybind integration. Registers explorer command handlers |
| `useExplorerFocus(inputService)` | Hook | Syncs focus state with momoi-keybind context |
| `useTreeContext()` | Hook | Raw TreeContext value (usually use useFileTree instead) |

### UI (`momoi-explorer/ui`)

| Export | Description |
|---|---|
| `FileExplorer` | All-in-one component (includes TreeProvider, virtual scrolling, context menu) |
| `TreeNodeRow` | Single tree row (icon, indent, selection, rename) |
| `ContextMenu` | Right-click menu (closes on outside click/Esc) |
| `InlineRename` | Inline rename input (Enter to confirm, Esc to cancel) |
| `TreeFilterBar` | Fuzzy search filter bar |
| `QuickOpen` | VSCode-style quick open dialog (Ctrl+P equivalent) |

**Styles:**

```ts
import 'momoi-explorer/ui/style.css'
```

VSCode-style dark theme. Customizable via CSS variables and class names (`.momoi-explorer-*`).

### FileExplorer Props

```tsx
<FileExplorer
  adapter={adapter}            // FileSystemAdapter (required)
  rootPath="/path/to/dir"      // Root path (required)
  sort={(a, b) => ...}         // Custom sort
  filter={(entry) => ...}      // Custom filter
  watchOptions={{ ... }}       // File watching options
  onEvent={(e) => ...}         // Tree event callback
  onOpen={(path) => ...}       // File double-click handler
  renderIcon={(node, expanded) => ...}   // Custom icon renderer
  renderBadge={(node) => ...}  // Custom badge renderer (e.g. git status)
  contextMenuItems={(nodes) => [...]}    // Context menu items
  showFilterBar                // Show filter bar
  onControllerReady={(ctrl) => ...}      // Get controller reference
  inputService={inputService}  // momoi-keybind InputService instance (optional)
  onKeyDown={(e) => ...}       // Key event handler when not using momoi-keybind
  className="my-explorer"      // CSS class
  style={{ height: 400 }}      // Inline styles
/>
```

### QuickOpen Usage

```tsx
import { FileExplorer, QuickOpen } from 'momoi-explorer/ui'

function App() {
  const [ctrl, setCtrl] = useState<FileTreeController | null>(null)
  const [quickOpen, setQuickOpen] = useState(false)

  return (
    <>
      <FileExplorer
        adapter={adapter}
        rootPath={rootPath}
        onControllerReady={setCtrl}
      />
      {ctrl && (
        <QuickOpen
          controller={ctrl}
          isOpen={quickOpen}
          onClose={() => setQuickOpen(false)}
          onSelect={(entry) => openFile(entry.path)}
        />
      )}
    </>
  )
}
```

## Key Types

```ts
interface FileEntry {
  name: string          // File name
  path: string          // Absolute path
  isDirectory: boolean  // Is directory
  meta?: Record<string, unknown>  // Extension metadata
}

interface TreeNode extends FileEntry {
  depth: number
  children?: TreeNode[]
  childrenLoaded: boolean
}

interface FlatNode {
  node: TreeNode
  depth: number
}

interface TreeState {
  rootPath: string
  rootNodes: TreeNode[]
  expandedPaths: Set<string>
  selectedPaths: Set<string>
  anchorPath: string | null
  renamingPath: string | null
  creatingState: CreatingState | null
  searchQuery: string | null
  flatList: FlatNode[]
}

type TreeEvent =
  | { type: 'expand'; path: string }
  | { type: 'collapse'; path: string }
  | { type: 'select'; paths: string[] }
  | { type: 'open'; path: string }
  | { type: 'rename'; oldPath: string; newPath: string }
  | { type: 'delete'; paths: string[] }
  | { type: 'create'; parentPath: string; name: string; isDirectory: boolean }
  | { type: 'refresh'; path?: string }
  | { type: 'external-change'; changes: WatchEvent[] }
```

## File Watching

Implementing `adapter.watch` automatically enables file watching. Just emit raw events; the core handles:

- **Debounce** (75ms, VSCode-compatible)
- **Event coalescing**: rename → delete+create, delete+create (same path) → modify, child events removed on parent delete
- **Throttling**: Chunk splitting for large batches (500 events / 200ms interval)

```ts
const tree = createFileTree({
  adapter,
  rootPath: '/project',
  watchOptions: {
    debounceMs: 100,        // Default: 75
    coalesce: true,         // Default: true
    throttle: {
      maxChunkSize: 1000,   // Default: 500
      delayMs: 300,         // Default: 200
    },
  },
})
```

## Keybinding Integration (momoi-keybind)

When `momoi-keybind` is installed, pass an `inputService` prop to enable keybindings. `momoi-keybind` is an optional peer dependency.

```tsx
import { InputService } from 'momoi-keybind'
import { defaultExplorerKeybindings } from 'momoi-explorer'
import { FileExplorer } from 'momoi-explorer/ui'

const inputService = new InputService({
  defaultKeybindings: defaultExplorerKeybindings,
})
inputService.start()

<FileExplorer
  adapter={adapter}
  rootPath={rootPath}
  inputService={inputService}
/>
```

**Default Keybindings:**

| Key | Command |
|---|---|
| `Delete` | Delete selected items |
| `F2` | Rename |
| `Ctrl+N` | New file |
| `Ctrl+Shift+N` | New folder |
| `Ctrl+R` | Refresh |
| `Ctrl+Shift+E` | Collapse all folders |
| `Ctrl+A` | Select all |
| `Ctrl+Shift+C` | Copy path |

Override, add, or disable keybindings on the user side:

```ts
const inputService = new InputService({
  defaultKeybindings: defaultExplorerKeybindings,
  userKeybindings: [
    { key: 'F2', command: 'myApp.quickPreview', when: 'explorerFocus' }, // Override
    { key: '', command: '-explorer.delete' },  // Disable
  ],
})
```

## License

MIT
