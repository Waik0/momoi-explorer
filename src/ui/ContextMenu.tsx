import type React from 'react'
import { useEffect, useRef } from 'react'
import type { MenuItemDef } from '../core/types'

export interface ContextMenuProps {
  items: MenuItemDef[]
  x: number
  y: number
  onClose(): void
}

export function ContextMenu({ items, x, y, onClose }: ContextMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // 画面外にはみ出さないように調整
  useEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      menu.style.left = `${window.innerWidth - rect.width - 4}px`
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${window.innerHeight - rect.height - 4}px`
    }
  }, [x, y])

  return (
    <div
      ref={menuRef}
      className="momoi-explorer-context-menu"
      style={{ left: x, top: y }}
    >
      {items.map((item) => {
        if (item.separator) {
          return <div key={item.id} className="momoi-explorer-context-menu-separator" />
        }
        return (
          <div
            key={item.id}
            className="momoi-explorer-context-menu-item"
            data-disabled={item.disabled ?? false}
            onClick={() => {
              if (!item.disabled) {
                item.action([])
                onClose()
              }
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="momoi-explorer-context-menu-shortcut">{item.shortcut}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
