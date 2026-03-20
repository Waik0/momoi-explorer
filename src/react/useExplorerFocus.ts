import { useCallback, useRef } from 'react'
import type { InputServiceLike } from './useExplorerKeybindings'

/**
 * エクスプローラーのフォーカス状態をmomoi-keybindのコンテキストに連動させるhook。
 * 返されたpropsをエクスプローラーのルート要素に渡す。
 *
 * @param inputService - momoi-keybindのInputServiceインスタンス。nullならno-op
 * @param contextKey - コンテキストキー名。デフォルト: 'explorerFocus'
 */
export function useExplorerFocus(
  inputService: InputServiceLike | null,
  contextKey: string = 'explorerFocus',
): {
  onFocus: () => void
  onBlur: () => void
  tabIndex: number
} {
  const focused = useRef(false)

  const onFocus = useCallback(() => {
    if (!focused.current) {
      focused.current = true
      inputService?.setContext(contextKey, true)
    }
  }, [inputService, contextKey])

  const onBlur = useCallback(() => {
    if (focused.current) {
      focused.current = false
      inputService?.deleteContext(contextKey)
    }
  }, [inputService, contextKey])

  return { onFocus, onBlur, tabIndex: 0 }
}
