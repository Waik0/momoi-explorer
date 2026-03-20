// createFileTree - ヘッドレスファイルツリーコントローラ

import type {
  FileEntry,
  FileSystemAdapter,
  FileTreeController,
  FileTreeOptions,
  FlatNode,
  TreeEvent,
  TreeNode,
  TreeState,
  WatchEvent,
} from './types'
import { createEventProcessor } from './event-processor'
import { flattenTree } from './flatten'
import { computeSelection } from './selection'
import { defaultSort } from './sort'
import { defaultFilter } from './filter'
import { findMatchingPaths } from './search'

function toTreeNode(entry: FileEntry, depth: number): TreeNode {
  return {
    ...entry,
    depth,
    children: entry.isDirectory ? undefined : undefined,
    childrenLoaded: false,
  }
}

function findNode(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const found = findNode(node.children, path)
      if (found) return found
    }
  }
  return undefined
}

function findParentNodes(nodes: TreeNode[], targetPath: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.children) {
      for (const child of node.children) {
        if (child.path === targetPath) return node
      }
      const found = findParentNodes(node.children, targetPath)
      if (found) return found
    }
  }
  return undefined
}

/** パスの親ディレクトリを取得 */
function dirname(path: string): string {
  const sep = path.includes('\\') ? '\\' : '/'
  const idx = path.lastIndexOf(sep)
  return idx === -1 ? '' : path.slice(0, idx)
}

/** パスの末尾（ファイル名）を取得 */
function basename(path: string): string {
  const sep = path.includes('\\') ? '\\' : '/'
  const idx = path.lastIndexOf(sep)
  return idx === -1 ? path : path.slice(idx + 1)
}

/**
 * ヘッドレスファイルツリーコントローラを生成する。
 * フレームワーク非依存。React等で使う場合は `momoi-explorer/react` のTreeProviderを推奨。
 *
 * @param options - ツリーの初期化オプション
 * @returns FileTreeController インスタンス
 *
 * @example
 * ```ts
 * import { createFileTree } from 'momoi-explorer'
 *
 * const tree = createFileTree({
 *   adapter: myAdapter,
 *   rootPath: '/home/user/project',
 *   onEvent: (e) => console.log(e),
 * })
 * await tree.loadRoot()
 * ```
 */
export function createFileTree(options: FileTreeOptions): FileTreeController {
  const { adapter, rootPath, onEvent } = options
  let sortFn = options.sort ?? defaultSort
  let filterFn = options.filter ?? defaultFilter

  let state: TreeState = {
    rootPath,
    rootNodes: [],
    expandedPaths: new Set(),
    selectedPaths: new Set(),
    anchorPath: null,
    renamingPath: null,
    creatingState: null,
    searchQuery: null,
    flatList: [],
  }

  const listeners = new Set<(state: TreeState) => void>()
  let expandingPaths = new Set<string>()

  function emit(event: TreeEvent): void {
    onEvent?.(event)
  }

  function notify(): void {
    const matchingPaths = state.searchQuery
      ? findMatchingPaths(state.rootNodes, state.searchQuery)
      : null
    state = { ...state, flatList: flattenTree(state.rootNodes, state.expandedPaths, matchingPaths) }
    for (const listener of listeners) {
      listener(state)
    }
  }

  async function loadChildren(node: TreeNode): Promise<void> {
    const entries = await adapter.readDir(node.path)
    const filtered = entries.filter(filterFn)
    filtered.sort(sortFn)
    // 既存の展開済み子ノードのchildrenを引き継ぐ
    const oldChildMap = node.children
      ? new Map(node.children.map((c) => [c.path, c]))
      : new Map<string, TreeNode>()
    node.children = filtered.map((e) => {
      const existing = oldChildMap.get(e.path)
      if (existing && existing.childrenLoaded) {
        return { ...toTreeNode(e, node.depth + 1), children: existing.children, childrenLoaded: true }
      }
      return toTreeNode(e, node.depth + 1)
    })
    node.childrenLoaded = true
  }

  /** 親ディレクトリをリフレッシュし、展開中のフォルダの子も再読み込みする */
  async function refreshParent(parentPath: string): Promise<void> {
    const parentNode = findNode(state.rootNodes, parentPath)
    if (parentNode) {
      await loadChildren(parentNode)
      state.expandedPaths = new Set(state.expandedPaths)
      state.expandedPaths.add(parentPath)
    } else if (parentPath === rootPath) {
      const entries = await adapter.readDir(rootPath)
      const filtered = entries.filter(filterFn)
      filtered.sort(sortFn)
      // 既存の展開済みノードのchildrenを引き継ぐ
      const oldNodeMap = new Map(state.rootNodes.map((n) => [n.path, n]))
      state.rootNodes = filtered.map((e) => {
        const existing = oldNodeMap.get(e.path)
        if (existing && existing.childrenLoaded) {
          return { ...toTreeNode(e, 0), children: existing.children, childrenLoaded: true }
        }
        return toTreeNode(e, 0)
      })
    }
  }

  function sortNodes(nodes: TreeNode[]): void {
    nodes.sort(sortFn)
    for (const node of nodes) {
      if (node.children) {
        sortNodes(node.children)
      }
    }
  }

  function filterNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes.filter((node) => {
      if (!filterFn(node)) return false
      if (node.children) {
        node.children = filterNodes(node.children)
      }
      return true
    })
  }

  // ウォッチ関連
  let unwatchFn: (() => void) | null = null
  let eventProcessor: ReturnType<typeof createEventProcessor> | null = null

  function handleWatchEvents(events: WatchEvent[]): void {
    emit({ type: 'external-change', changes: events })

    // 変更されたパスの親ディレクトリを収集してリフレッシュ
    const dirsToRefresh = new Set<string>()
    for (const event of events) {
      const parent = dirname(event.path)
      // 展開中のディレクトリのみリフレッシュ
      if (parent === rootPath || state.expandedPaths.has(parent)) {
        dirsToRefresh.add(parent)
      }
      // ディレクトリ自体が変更された場合、展開中ならそれもリフレッシュ
      if (event.isDirectory && state.expandedPaths.has(event.path)) {
        dirsToRefresh.add(event.path)
      }
    }

    // 非同期でリフレッシュ（展開状態を保持）
    for (const dir of dirsToRefresh) {
      refreshParent(dir).then(() => notify()).catch(() => {})
    }
  }

  function startWatching(): void {
    if (!adapter.watch) return

    eventProcessor = createEventProcessor(handleWatchEvents, options.watchOptions)
    unwatchFn = adapter.watch(rootPath, (events) => {
      eventProcessor!.push(events)
    })
  }

  function stopWatching(): void {
    if (unwatchFn) {
      unwatchFn()
      unwatchFn = null
    }
    if (eventProcessor) {
      eventProcessor.destroy()
      eventProcessor = null
    }
  }

  const controller: FileTreeController = {
    getState(): TreeState {
      return state
    },

    subscribe(listener: (s: TreeState) => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async loadRoot(): Promise<void> {
      const entries = await adapter.readDir(rootPath)
      const filtered = entries.filter(filterFn)
      filtered.sort(sortFn)
      state.rootNodes = filtered.map((e) => toTreeNode(e, 0))
      notify()
      startWatching()
    },

    async expand(path: string): Promise<void> {
      // 再入ガード: 同じパスの展開処理が進行中なら無視
      if (expandingPaths.has(path)) return
      expandingPaths.add(path)

      try {
        const node = findNode(state.rootNodes, path)
        if (!node || !node.isDirectory) return

        if (!node.childrenLoaded) {
          await loadChildren(node)
        }

        // await後にstateが変わっている可能性があるので再確認
        state.expandedPaths = new Set(state.expandedPaths)
        state.expandedPaths.add(path)
        notify()
        emit({ type: 'expand', path })
      } finally {
        expandingPaths.delete(path)
      }
    },

    collapse(path: string): void {
      const sep = path.includes('\\') ? '\\' : '/'
      const prefix = path + sep
      state.expandedPaths = new Set(state.expandedPaths)
      state.expandedPaths.delete(path)
      // 子孫の展開状態もクリア
      for (const p of state.expandedPaths) {
        if (p.startsWith(prefix)) {
          state.expandedPaths.delete(p)
        }
      }
      notify()
      emit({ type: 'collapse', path })
    },

    async toggleExpand(path: string): Promise<void> {
      // expand進行中は無視（ダブルクリックで展開→即collapseを防止）
      if (expandingPaths.has(path)) return

      if (state.expandedPaths.has(path)) {
        controller.collapse(path)
      } else {
        await controller.expand(path)
      }
    },

    async expandTo(path: string): Promise<void> {
      // パスの各祖先を展開していく
      const parts: string[] = []
      let current = path
      while (current !== rootPath && current !== '') {
        const parent = dirname(current)
        if (parent === current) break
        parts.unshift(parent)
        current = parent
      }

      for (const ancestorPath of parts) {
        if (ancestorPath === rootPath) continue
        if (!state.expandedPaths.has(ancestorPath)) {
          await controller.expand(ancestorPath)
        }
      }
    },

    select(path: string, mode: 'replace' | 'toggle' | 'range' = 'replace'): void {
      const result = computeSelection(
        state.selectedPaths,
        state.anchorPath,
        path,
        mode,
        state.flatList,
      )
      state.selectedPaths = result.selectedPaths
      state.anchorPath = result.anchorPath
      notify()
      emit({ type: 'select', paths: Array.from(result.selectedPaths) })
    },

    selectAll(): void {
      state.selectedPaths = new Set(state.flatList.map((f) => f.node.path))
      notify()
      emit({ type: 'select', paths: Array.from(state.selectedPaths) })
    },

    clearSelection(): void {
      state.selectedPaths = new Set()
      state.anchorPath = null
      notify()
      emit({ type: 'select', paths: [] })
    },

    startRename(path: string): void {
      state.renamingPath = path
      notify()
    },

    async commitRename(newName: string): Promise<void> {
      if (!state.renamingPath || !adapter.rename) return

      const oldPath = state.renamingPath
      const parent = dirname(oldPath)
      const sep = oldPath.includes('\\') ? '\\' : '/'
      const newPath = parent + sep + newName

      await adapter.rename(oldPath, newPath)
      state.renamingPath = null

      // リネームされたノードの親をリフレッシュ
      if (parent === rootPath) {
        await controller.loadRoot()
      } else {
        const parentNode = findNode(state.rootNodes, parent)
        if (parentNode) {
          await loadChildren(parentNode)
        }
      }

      notify()
      emit({ type: 'rename', oldPath, newPath })
    },

    cancelRename(): void {
      state.renamingPath = null
      notify()
    },

    async startCreate(parentPath: string, isDirectory: boolean, insertAfterPath?: string): Promise<void> {
      // 親フォルダを展開してから作成モードに入る
      if (parentPath !== rootPath && !state.expandedPaths.has(parentPath)) {
        await controller.expand(parentPath)
      }
      state.creatingState = { parentPath, isDirectory, insertAfterPath }
      notify()
    },

    async commitCreate(name: string): Promise<void> {
      if (!state.creatingState) return

      const { parentPath, isDirectory } = state.creatingState
      state.creatingState = null

      if (isDirectory) {
        await controller.createDir(parentPath, name)
      } else {
        await controller.createFile(parentPath, name)
      }
    },

    cancelCreate(): void {
      state.creatingState = null
      notify()
    },

    async createFile(parentPath: string, name: string): Promise<void> {
      if (!adapter.createFile) return
      await adapter.createFile(parentPath, name)
      await refreshParent(parentPath)

      notify()
      emit({ type: 'create', parentPath, name, isDirectory: false })
    },

    async createDir(parentPath: string, name: string): Promise<void> {
      if (!adapter.createDir) return
      await adapter.createDir(parentPath, name)
      await refreshParent(parentPath)

      notify()
      emit({ type: 'create', parentPath, name, isDirectory: true })
    },

    async deleteSelected(): Promise<void> {
      if (!adapter.delete || state.selectedPaths.size === 0) return

      const paths = Array.from(state.selectedPaths)
      await adapter.delete(paths)

      state.selectedPaths = new Set()
      state.anchorPath = null

      // 影響を受ける親ディレクトリをリフレッシュ
      const parentDirs = new Set(paths.map(dirname))
      for (const dir of parentDirs) {
        await refreshParent(dir)
      }

      notify()
      emit({ type: 'delete', paths })
    },

    async refresh(path?: string): Promise<void> {
      if (!path || path === rootPath) {
        await refreshParent(rootPath)
      } else {
        const node = findNode(state.rootNodes, path)
        if (node && node.isDirectory) {
          await loadChildren(node)
        }
      }

      notify()
      emit({ type: 'refresh', path })
    },

    setSearchQuery(query: string | null): void {
      state.searchQuery = query && query.trim() ? query.trim() : null
      notify()
    },

    async collectAllFiles(): Promise<FileEntry[]> {
      const result: FileEntry[] = []

      async function walk(dirPath: string): Promise<void> {
        const entries = await adapter.readDir(dirPath)
        for (const entry of entries) {
          if (!filterFn(entry)) continue
          result.push(entry)
          if (entry.isDirectory) {
            await walk(entry.path)
          }
        }
      }

      await walk(rootPath)
      return result
    },

    setFilter(fn: ((entry: FileEntry) => boolean) | null): void {
      filterFn = fn ?? defaultFilter
      // 既に読み込み済みのノードを再フィルタ
      state.rootNodes = filterNodes(state.rootNodes)
      notify()
    },

    setSort(fn: ((a: FileEntry, b: FileEntry) => number) | null): void {
      sortFn = fn ?? defaultSort
      sortNodes(state.rootNodes)
      notify()
    },

    destroy(): void {
      stopWatching()
      listeners.clear()
    },
  }

  return controller
}
