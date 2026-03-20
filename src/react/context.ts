import { createContext, useContext } from 'react'
import type { FileTreeController, TreeState } from '../core/types'

export interface TreeContextValue {
  controller: FileTreeController
  state: TreeState
}

export const TreeContext = createContext<TreeContextValue | null>(null)

export function useTreeContext(): TreeContextValue {
  const ctx = useContext(TreeContext)
  if (!ctx) {
    throw new Error('useTreeContext must be used within a <TreeProvider>')
  }
  return ctx
}
