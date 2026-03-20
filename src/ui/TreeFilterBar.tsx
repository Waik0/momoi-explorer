import type React from 'react'
import { useCallback, useRef } from 'react'
import { useTreeContext } from '../react/context'

export interface TreeFilterBarProps {
  placeholder?: string
}

export function TreeFilterBar({
  placeholder = 'Filter files...',
}: TreeFilterBarProps): React.JSX.Element {
  const { controller, state } = useTreeContext()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    controller.setSearchQuery(e.target.value || null)
  }, [controller])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      controller.setSearchQuery(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }, [controller])

  return (
    <div className="momoi-explorer-filter-bar">
      <input
        ref={inputRef}
        className="momoi-explorer-filter-input"
        type="text"
        placeholder={placeholder}
        defaultValue={state.searchQuery ?? ''}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      {state.searchQuery && (
        <span
          className="momoi-explorer-filter-clear"
          onClick={() => {
            controller.setSearchQuery(null)
            if (inputRef.current) inputRef.current.value = ''
          }}
        >
          ×
        </span>
      )}
    </div>
  )
}
