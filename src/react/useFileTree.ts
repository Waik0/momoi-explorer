import { useTreeContext } from './context'
import type { FileTreeController, TreeState } from '../core/types'

/** {@link useFileTree} の戻り値。ツリー状態の全フィールドに加えコントローラを含む */
export interface UseFileTreeResult extends TreeState {
  /** ツリー操作用コントローラ */
  controller: FileTreeController
}

/**
 * ツリー全体の状態とコントローラを返すフック。
 * TreeProvider 内で使用すること。
 * @returns ツリー状態（flatList, expandedPaths 等）とコントローラ
 */
export function useFileTree(): UseFileTreeResult {
  const { controller, state } = useTreeContext()
  return { ...state, controller }
}
