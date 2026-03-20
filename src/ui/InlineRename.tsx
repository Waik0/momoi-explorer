import type React from 'react'
import { useEffect, useRef, useState } from 'react'

export interface InlineRenameProps {
  currentName: string
  onCommit(newName: string): void
  onCancel(): void
}

export function InlineRename({ currentName, onCommit, onCancel }: InlineRenameProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(currentName)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    // 拡張子の前まで選択
    const dotIndex = currentName.lastIndexOf('.')
    if (dotIndex > 0) {
      input.setSelectionRange(0, dotIndex)
    } else {
      input.select()
    }
  }, [currentName])

  function handleKeyDown(e: React.KeyboardEvent): void {
    e.stopPropagation()
    if (e.key === 'Enter') {
      const trimmed = value.trim()
      if (trimmed && trimmed !== currentName) {
        onCommit(trimmed)
      } else {
        onCancel()
      }
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  function handleBlur(): void {
    const trimmed = value.trim()
    if (trimmed && trimmed !== currentName) {
      onCommit(trimmed)
    } else {
      onCancel()
    }
  }

  return (
    <input
      ref={inputRef}
      className="momoi-explorer-rename-input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    />
  )
}
