import { useCallback, useEffect, useRef } from 'react'
import { useTreeContext } from './context'
import { ExplorerCommands } from '../core/keybindings'
import type { ExplorerCommandId } from '../core/keybindings'

/**
 * InputService（momoi-keybind）を受け取り、エクスプローラーのコマンドハンドラーを登録する。
 * momoi-keybindが無い場合は使わなくてOK。
 *
 * @param inputService - momoi-keybindのInputServiceインスタンス。nullならスキップ
 * @param options - コマンド実行時の追加処理
 */
export function useExplorerKeybindings(
  inputService: InputServiceLike | null,
  options?: {
    onCopyPath?: (paths: string[]) => void
  },
): void {
  const { controller, state } = useTreeContext()
  const stateRef = useRef(state)
  stateRef.current = state
  const optionsRef = useRef(options)
  optionsRef.current = options

  const getSelectedParent = useCallback((): string => {
    const s = stateRef.current
    if (s.selectedPaths.size === 0) return s.rootPath
    const firstSelected = s.flatList.find((f) => s.selectedPaths.has(f.node.path))
    if (!firstSelected) return s.rootPath
    if (firstSelected.node.isDirectory) return firstSelected.node.path
    const sep = firstSelected.node.path.includes('\\') ? '\\' : '/'
    const idx = firstSelected.node.path.lastIndexOf(sep)
    return idx === -1 ? s.rootPath : firstSelected.node.path.slice(0, idx)
  }, [])

  useEffect(() => {
    if (!inputService) return

    const disposers: Array<() => void> = []

    const handlers: Record<ExplorerCommandId, () => void> = {
      [ExplorerCommands.DELETE]: () => controller.deleteSelected(),
      [ExplorerCommands.RENAME]: () => {
        const s = stateRef.current
        if (s.selectedPaths.size === 1) {
          controller.startRename(Array.from(s.selectedPaths)[0])
        }
      },
      [ExplorerCommands.NEW_FILE]: () => controller.startCreate(getSelectedParent(), false),
      [ExplorerCommands.NEW_FOLDER]: () => controller.startCreate(getSelectedParent(), true),
      [ExplorerCommands.REFRESH]: () => controller.refresh(),
      [ExplorerCommands.COLLAPSE_ALL]: () => {
        const s = stateRef.current
        for (const path of s.expandedPaths) {
          controller.collapse(path)
        }
      },
      [ExplorerCommands.SELECT_ALL]: () => controller.selectAll(),
      [ExplorerCommands.COPY_PATH]: () => {
        const s = stateRef.current
        const paths = Array.from(s.selectedPaths)
        optionsRef.current?.onCopyPath?.(paths)
      },
    }

    for (const [command, handler] of Object.entries(handlers)) {
      disposers.push(inputService.registerCommand(command, handler))
    }

    return () => {
      for (const dispose of disposers) {
        dispose()
      }
    }
  }, [inputService, controller, getSelectedParent])
}

/**
 * momoi-keybindのInputServiceの最小インターフェース。
 * momoi-keybindに直接依存せず、duck typingで受け入れる。
 */
export interface InputServiceLike {
  registerCommand(command: string, handler: (args?: unknown) => void): () => void
  setContext(key: string, value: unknown): void
  deleteContext(key: string): void
}
