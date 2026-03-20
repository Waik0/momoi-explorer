import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FileSystemAdapter, FileTreeController, FileTreeOptions, TreeEvent, TreeState } from '../core/types'
import { createFileTree } from '../core/tree'
import { TreeContext } from './context'
import type { ReactNode } from 'react'

/** {@link TreeProvider} に渡すprops */
export interface TreeProviderProps {
  /** ファイルシステム操作の実装 */
  adapter: FileSystemAdapter
  /** ツリーのルートディレクトリパス */
  rootPath: string
  /** ファイル/フォルダのソート関数 */
  sort?: FileTreeOptions['sort']
  /** 表示対象を絞り込むフィルタ関数 */
  filter?: FileTreeOptions['filter']
  /** ファイル監視の設定 */
  watchOptions?: FileTreeOptions['watchOptions']
  /** ツリー操作イベントのコールバック */
  onEvent?: (event: TreeEvent) => void
  children: ReactNode
}

/**
 * ファイルツリーのコンテキストプロバイダー。
 * 内部で `createFileTree` を呼び出し、マウント時に `loadRoot` でルートを読み込む。
 * 子コンポーネントから `useFileTree` / `useTreeNode` でツリー状態にアクセスできる。
 */
export function TreeProvider({
  adapter,
  rootPath,
  sort,
  filter,
  watchOptions,
  onEvent,
  children,
}: TreeProviderProps): React.JSX.Element {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const controller = useMemo<FileTreeController>(() => {
    return createFileTree({
      adapter,
      rootPath,
      sort,
      filter,
      watchOptions,
      onEvent: (event) => onEventRef.current?.(event),
    })
  }, [adapter, rootPath])

  const [state, setState] = useState<TreeState>(() => controller.getState())

  useEffect(() => {
    const unsub = controller.subscribe(setState)
    controller.loadRoot()
    return () => {
      unsub()
      controller.destroy()
    }
  }, [controller])

  const value = useMemo(() => ({ controller, state }), [controller, state])

  return (
    <TreeContext.Provider value={value}>
      {children}
    </TreeContext.Provider>
  )
}
