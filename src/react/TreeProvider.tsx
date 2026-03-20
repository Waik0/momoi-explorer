import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FileSystemAdapter, FileTreeController, FileTreeOptions, TreeEvent, TreeState } from '../core/types'
import { createFileTree } from '../core/tree'
import { TreeContext } from './context'
import type { ReactNode } from 'react'

export interface TreeProviderProps {
  adapter: FileSystemAdapter
  rootPath: string
  sort?: FileTreeOptions['sort']
  filter?: FileTreeOptions['filter']
  watchOptions?: FileTreeOptions['watchOptions']
  onEvent?: (event: TreeEvent) => void
  children: ReactNode
}

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
