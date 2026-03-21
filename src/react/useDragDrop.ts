// useDragDrop - ドラッグ&ドロップ制御hook
//
// VSCode準拠の挙動:
// - ドロップ先はフォルダのみ（ファイル行へのドロップは親フォルダに解決）
// - 閉じたフォルダ上で500msホバー → 自動展開
// - 自分自身・子孫・同一親へのドロップ禁止
// - 複数選択のドラッグ対応
// - ドラッグ中のビジュアルはDOM直接操作（パフォーマンス最適化）

import { useCallback, useRef } from 'react'
import { useTreeContext } from './context'

/** ドラッグ中のフォルダ自動展開までの待機時間(ms) */
const AUTO_EXPAND_DELAY = 500

/** @internal data-path属性を持つ最近い祖先要素を取得 */
function findRowElement(target: EventTarget): HTMLElement | null {
  return (target as HTMLElement).closest?.('[data-path]') as HTMLElement | null
}

/** @internal パスの親ディレクトリを取得 */
function dirname(path: string): string {
  const sep = path.includes('\\') ? '\\' : '/'
  const idx = path.lastIndexOf(sep)
  return idx === -1 ? '' : path.slice(0, idx)
}

/**
 * ドラッグ&ドロップのコンテナレベルイベントハンドラを返すhook。
 * adapter.moveが未実装の場合は全ハンドラがno-opになる。
 *
 * パフォーマンス最適化:
 * - ドロップ先ハイライトはDOM直接操作（React再レンダリング不要）
 * - ドラッグソースのハイライトはCSSの[data-dragging]親属性で実現
 * - useCallbackで安定したハンドラ参照を返す
 *
 * @param enabled - DnDを有効にするか（adapter.moveの存在で判定）
 * @returns コンテナ要素に設定するイベントハンドラ群
 */
export function useDragDrop(enabled: boolean) {
  const { controller } = useTreeContext()

  // refs（React再レンダリングを発生させない）
  const dragSourcePathsRef = useRef<string[]>([])
  const currentDropTargetRef = useRef<HTMLElement | null>(null)
  const autoExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragGhostRef = useRef<HTMLElement | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)

  const clearAutoExpandTimer = useCallback(() => {
    if (autoExpandTimerRef.current !== null) {
      clearTimeout(autoExpandTimerRef.current)
      autoExpandTimerRef.current = null
    }
  }, [])

  const clearDropHighlight = useCallback(() => {
    if (currentDropTargetRef.current) {
      currentDropTargetRef.current.removeAttribute('data-drag-over')
      currentDropTargetRef.current = null
    }
  }, [])

  const cleanupDrag = useCallback(() => {
    clearAutoExpandTimer()
    clearDropHighlight()
    dragSourcePathsRef.current = []
    // data-dragging属性を削除
    if (containerRef.current) {
      containerRef.current.removeAttribute('data-dragging')
    }
    // ドラッグゴーストを削除
    if (dragGhostRef.current) {
      dragGhostRef.current.remove()
      dragGhostRef.current = null
    }
  }, [clearAutoExpandTimer, clearDropHighlight])

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!enabled) return

    const row = findRowElement(e.target)
    if (!row) return

    const path = row.dataset.path!
    const { selectedPaths } = controller.getState()

    // ドラッグ元の決定: 選択中のアイテムをドラッグ → 全選択、それ以外 → 単体
    let srcPaths: string[]
    if (selectedPaths.has(path)) {
      srcPaths = Array.from(selectedPaths)
    } else {
      controller.select(path, 'replace')
      srcPaths = [path]
    }

    dragSourcePathsRef.current = srcPaths

    // ドラッグデータ設定
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', srcPaths.join('\n'))

    // ドラッグゴースト生成
    const ghost = document.createElement('div')
    ghost.className = 'momoi-explorer-drag-ghost'
    const sep = path.includes('\\') ? '\\' : '/'
    const firstName = path.slice(path.lastIndexOf(sep) + 1)
    ghost.textContent = firstName
    if (srcPaths.length > 1) {
      const badge = document.createElement('span')
      badge.className = 'momoi-explorer-drag-count'
      badge.textContent = String(srcPaths.length)
      ghost.appendChild(badge)
    }
    document.body.appendChild(ghost)
    dragGhostRef.current = ghost
    e.dataTransfer.setDragImage(ghost, -10, -10)

    // コンテナにdata-dragging属性を設定（CSS用）
    containerRef.current = (e.currentTarget as HTMLElement).closest('.momoi-explorer') as HTMLElement
    if (containerRef.current) {
      containerRef.current.setAttribute('data-dragging', 'true')
    }
  }, [enabled, controller])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!enabled || dragSourcePathsRef.current.length === 0) return

    const row = findRowElement(e.target)
    if (!row) {
      // 空白エリア → ルートへのドロップ
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      clearDropHighlight()
      clearAutoExpandTimer()
      return
    }

    const path = row.dataset.path!
    const srcPaths = dragSourcePathsRef.current

    // canDropチェック
    if (!controller.canDrop(srcPaths, path)) {
      e.dataTransfer.dropEffect = 'none'
      clearDropHighlight()
      clearAutoExpandTimer()
      return
    }

    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    // ドロップ先ハイライト更新（DOM直接操作）
    // ファイル行の場合は親フォルダ行をハイライト
    const { flatList } = controller.getState()
    const flatNode = flatList.find((f) => f.node.path === path)
    let highlightRow = row
    if (flatNode && !flatNode.node.isDirectory) {
      const parentPath = dirname(path)
      const parentRow = row.closest('[data-path]')?.parentElement?.querySelector(`[data-path="${CSS.escape(parentPath)}"]`) as HTMLElement | null
      if (parentRow) {
        highlightRow = parentRow
      }
    }

    if (currentDropTargetRef.current !== highlightRow) {
      clearDropHighlight()
      highlightRow.setAttribute('data-drag-over', 'true')
      currentDropTargetRef.current = highlightRow

      // フォルダ自動展開タイマー
      clearAutoExpandTimer()
      if (flatNode?.node.isDirectory) {
        const { expandedPaths } = controller.getState()
        if (!expandedPaths.has(path)) {
          autoExpandTimerRef.current = setTimeout(() => {
            controller.expand(path)
          }, AUTO_EXPAND_DELAY)
        }
      }
    }
  }, [enabled, controller, clearDropHighlight, clearAutoExpandTimer])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!enabled) return

    // コンテナ外に出た場合のみクリア
    const container = (e.currentTarget as HTMLElement)
    const related = e.relatedTarget as HTMLElement | null
    if (!related || !container.contains(related)) {
      clearDropHighlight()
      clearAutoExpandTimer()
    }
  }, [enabled, clearDropHighlight, clearAutoExpandTimer])

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!enabled) return
    e.preventDefault()

    const srcPaths = dragSourcePathsRef.current
    if (srcPaths.length === 0) return

    // ドロップ先を解決
    const row = findRowElement(e.target)
    const { flatList, rootPath } = controller.getState()
    let destDir: string

    if (!row) {
      // 空白エリア → ルート
      destDir = rootPath
    } else {
      const path = row.dataset.path!
      const flatNode = flatList.find((f) => f.node.path === path)
      if (flatNode?.node.isDirectory) {
        destDir = path
      } else {
        destDir = dirname(path)
      }
    }

    // 最終バリデーション
    if (!controller.canDrop(srcPaths, row?.dataset.path ?? '')) {
      // ルートへのドロップの場合、canDropのtargetPathは空文字にならないようにrootPathを使う
      if (!row && controller.canDrop(srcPaths, rootPath)) {
        // ルートへの移動は有効
      } else {
        cleanupDrag()
        return
      }
    }

    cleanupDrag()
    controller.moveItems(srcPaths, destDir)
  }, [enabled, controller, cleanupDrag])

  const handleDragEnd = useCallback((_e: React.DragEvent) => {
    cleanupDrag()
  }, [cleanupDrag])

  return {
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  }
}
