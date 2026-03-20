import { useTreeContext } from './context'
import type { FileTreeController, TreeState } from '../core/types'

export interface UseFileTreeResult extends TreeState {
  controller: FileTreeController
}

/** ツリー全体の状態とコントローラを取得 */
export function useFileTree(): UseFileTreeResult {
  const { controller, state } = useTreeContext()
  return { ...state, controller }
}
