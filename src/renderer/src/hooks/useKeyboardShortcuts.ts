import { useEffect } from 'react'
import { useNotesStore } from '../store/useNotesStore'

export function useKeyboardShortcuts(
  searchInputId: string,
  openCommandPalette: () => void,
  openShortcuts: () => void,
  openGraph: () => void
): void {
  const activeNoteId = useNotesStore((state) => state.activeNoteId)
  const createNote = useNotesStore((state) => state.createNote)
  const duplicateNote = useNotesStore((state) => state.duplicateNote)
  const moveToTrash = useNotesStore((state) => state.moveToTrash)
  const selectedFolder = useNotesStore((state) => state.selectedFolder)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable === true

      if (event.ctrlKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        void createNote({ folder: selectedFolder ?? undefined })
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        document.getElementById(searchInputId)?.focus()
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openCommandPalette()
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'g') {
        event.preventDefault()
        openGraph()
      }

      if (event.ctrlKey && event.key === '/') {
        event.preventDefault()
        openShortcuts()
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'd' && activeNoteId) {
        event.preventDefault()
        void duplicateNote(activeNoteId)
      }

      if (!isTyping && event.key === 'Delete' && activeNoteId) {
        event.preventDefault()
        void moveToTrash(activeNoteId)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeNoteId, createNote, duplicateNote, moveToTrash, openCommandPalette, openGraph, openShortcuts, searchInputId, selectedFolder])
}
