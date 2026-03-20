import { useCallback, useState } from 'react'

export interface ContextMenuState {
  isVisible: boolean
  x: number
  y: number
  targetPath: string | null
}

export interface UseContextMenuResult extends ContextMenuState {
  show(e: React.MouseEvent, targetPath: string): void
  hide(): void
}

/** 右クリックメニューの表示制御 */
export function useContextMenu(): UseContextMenuResult {
  const [menuState, setMenuState] = useState<ContextMenuState>({
    isVisible: false,
    x: 0,
    y: 0,
    targetPath: null,
  })

  const show = useCallback((e: React.MouseEvent, targetPath: string) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuState({
      isVisible: true,
      x: e.clientX,
      y: e.clientY,
      targetPath,
    })
  }, [])

  const hide = useCallback(() => {
    setMenuState((prev) => ({ ...prev, isVisible: false, targetPath: null }))
  }, [])

  return { ...menuState, show, hide }
}
