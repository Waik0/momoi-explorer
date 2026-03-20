import { createContext, useContext } from 'react'
import type { FileTreeController, TreeState } from '../core/types'

/** TreeProvider が提供するコンテキスト値 */
export interface TreeContextValue {
  /** ツリー操作用コントローラ */
  controller: FileTreeController
  /** 現在のツリー状態 */
  state: TreeState
}

/** @internal ツリーコンテキスト。通常は直接使わず `useTreeContext` 経由で利用する */
export const TreeContext = createContext<TreeContextValue | null>(null)

/**
 * TreeProvider のコンテキストを取得する。
 * TreeProvider の外で使用すると Error をスローする。
 * @returns ツリーのコントローラと状態
 */
export function useTreeContext(): TreeContextValue {
  const ctx = useContext(TreeContext)
  if (!ctx) {
    throw new Error('useTreeContext must be used within a <TreeProvider>')
  }
  return ctx
}
