import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileEntry, FileTreeController } from '../core/types'
import { fuzzyFind } from '../core/search'

export interface QuickOpenProps {
  controller: FileTreeController
  isOpen: boolean
  onClose(): void
  onSelect(entry: FileEntry): void
  placeholder?: string
  maxResults?: number
}

export function QuickOpen({
  controller,
  isOpen,
  onClose,
  onSelect,
  placeholder = 'Search files by name...',
  maxResults = 50,
}: QuickOpenProps): React.JSX.Element | null {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [allFiles, setAllFiles] = useState<FileEntry[]>([])
  const [results, setResults] = useState<FileEntry[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  // ファイル一覧を収集
  useEffect(() => {
    if (!isOpen) return
    controller.collectAllFiles().then(setAllFiles)
  }, [isOpen, controller])

  // フォーカス
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  // 検索実行
  useEffect(() => {
    if (!query) {
      setResults([])
      setSelectedIndex(0)
      return
    }
    const found = fuzzyFind(allFiles, query, maxResults)
    setResults(found)
    setSelectedIndex(0)
  }, [query, allFiles, maxResults])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        onClose()
        break
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex])
          onClose()
        }
        break
    }
  }, [onClose, onSelect, results, selectedIndex])

  if (!isOpen) return null

  return (
    <div className="momoi-explorer-quickopen-overlay" onClick={onClose}>
      <div
        className="momoi-explorer-quickopen"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="momoi-explorer-quickopen-input"
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {results.length > 0 && (
          <div className="momoi-explorer-quickopen-results">
            {results.map((entry, i) => (
              <div
                key={entry.path}
                className="momoi-explorer-quickopen-item"
                data-selected={i === selectedIndex}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => {
                  onSelect(entry)
                  onClose()
                }}
              >
                <span className="momoi-explorer-quickopen-name">{entry.name}</span>
                <span className="momoi-explorer-quickopen-path">{entry.path}</span>
              </div>
            ))}
          </div>
        )}
        {query && results.length === 0 && (
          <div className="momoi-explorer-quickopen-empty">No matching files</div>
        )}
      </div>
    </div>
  )
}
