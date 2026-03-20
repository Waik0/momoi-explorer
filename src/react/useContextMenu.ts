import { useCallback, useState } from 'react'

/** コンテキストメニューの表示状態 */
export interface ContextMenuState {
  /** メニューが表示されているか */
  isVisible: boolean
  /** メニューのX座標（clientX） */
  x: number
  /** メニューのY座標（clientY） */
  y: number
  /** 右クリック対象のファイルパス */
  targetPath: string | null
}

/** {@link useContextMenu} の戻り値 */
export interface UseContextMenuResult extends ContextMenuState {
  /** 指定位置にコンテキストメニューを表示する */
  show(e: React.MouseEvent, targetPath: string): void
  /** コンテキストメニューを閉じる */
  hide(): void
}

/**
 * 右クリックメニューの表示位置・表示状態を管理するフック。
 * @returns メニュー状態と表示/非表示の操作関数
 */
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
