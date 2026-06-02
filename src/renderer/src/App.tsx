import { useEffect, useState } from 'react'
import { useNotesStore } from './store/useNotesStore'
import { useSettingsStore } from './store/useSettingsStore'
import { Sidebar } from './features/notes/components/Sidebar'
import { NotesList } from './features/notes/components/NotesList'
import { Editor } from './features/notes/components/Editor'
import { SettingsPanel } from './features/settings/components/SettingsPanel'
import { CommandPalette } from './features/search/components/CommandPalette'
import { KnowledgeGraphPanel } from './features/notes/components/KnowledgeGraphPanel'
import { Toasts } from './components/Toasts'
import { LockScreen } from './components/LockScreen'
import { ShortcutOverlay } from './components/ShortcutOverlay'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

const searchInputId = 'global-search'

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [graphOpen, setGraphOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const notes = useNotesStore((state) => state.notes)
  const activeNoteId = useNotesStore((state) => state.activeNoteId)
  const loadNotes = useNotesStore((state) => state.loadNotes)
  const loadTags = useNotesStore((state) => state.loadTags)
  const loadFolders = useNotesStore((state) => state.loadFolders)
  const loadSettings = useSettingsStore((state) => state.loadSettings)
  const settings = useSettingsStore((state) => state.settings)
  const activeNote = notes.find((note) => note.id === activeNoteId) ?? null

  useKeyboardShortcuts(
    searchInputId,
    () => setPaletteOpen(true),
    () => setShortcutsOpen(true),
    () => setGraphOpen(true)
  )

  useEffect(() => {
    void (async () => {
      await loadSettings()
      const loadedSettings = useSettingsStore.getState().settings
      setUnlocked(!loadedSettings.passwordHash)
      await Promise.all([loadNotes(), loadTags(), loadFolders()])
    })()
  }, [loadFolders, loadNotes, loadSettings, loadTags])

  useEffect(() => {
    if (!settings.passwordHash) {
      setUnlocked(true)
      return
    }

    if (!unlocked) return

    let timer = window.setTimeout(() => setUnlocked(false), settings.autoLockMinutes * 60 * 1000)
    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setUnlocked(false), settings.autoLockMinutes * 60 * 1000)
    }
    window.addEventListener('mousemove', reset)
    window.addEventListener('keydown', reset)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('mousemove', reset)
      window.removeEventListener('keydown', reset)
    }
  }, [settings.autoLockMinutes, settings.passwordHash, unlocked])

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-black text-white">
      <Sidebar
        searchInputId={searchInputId}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenGraph={() => setGraphOpen(true)}
      />
      <NotesList />
      <Editor />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <KnowledgeGraphPanel open={graphOpen} onClose={() => setGraphOpen(false)} />
      <CommandPalette
        open={paletteOpen}
        activeNote={activeNote}
        onClose={() => setPaletteOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <ShortcutOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {settings.passwordHash && !unlocked ? (
        <LockScreen passwordHash={settings.passwordHash} onUnlock={() => setUnlocked(true)} />
      ) : null}
      <Toasts />
    </div>
  )
}
