import { useMemo, useState } from 'react'
import { Archive, Copy, Download, FilePlus, Moon, RotateCcw, Search, Settings, Upload } from 'lucide-react'
import type { Note } from '../../../../../shared/types'
import { copyNote } from '../../../lib/clipboard'
import { useNotesStore } from '../../../store/useNotesStore'
import { useSettingsStore } from '../../../store/useSettingsStore'
import { useToastStore } from '../../../store/useToastStore'

interface CommandPaletteProps {
  open: boolean
  activeNote: Note | null
  onClose: () => void
  onOpenSettings: () => void
}

export function CommandPalette({ open, activeNote, onClose, onOpenSettings }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const createNote = useNotesStore((state) => state.createNote)
  const setSearchQuery = useNotesStore((state) => state.setSearchQuery)
  const loadNotes = useNotesStore((state) => state.loadNotes)
  const refreshOrganization = useNotesStore((state) => state.refreshOrganization)
  const selectedFolder = useNotesStore((state) => state.selectedFolder)
  const settings = useSettingsStore((state) => state.settings)
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const showToast = useToastStore((state) => state.showToast)

  const commands = useMemo(
    () => [
      {
        label: 'Create note',
        icon: FilePlus,
        run: async () => {
          await createNote({ folder: selectedFolder ?? undefined })
          showToast('Note created', 'success')
        }
      },
      {
        label: 'Search note',
        icon: Search,
        run: async () => {
          await setSearchQuery(query)
          document.getElementById('global-search')?.focus()
        }
      },
      {
        label: 'Copy current note',
        icon: Copy,
        run: async () => {
          if (!activeNote) return
          await copyNote(activeNote, 'markdown')
          showToast('Copied successfully', 'success')
        }
      },
      {
        label: 'Export note as Markdown',
        icon: Download,
        run: async () => {
          if (!activeNote) return
          const exported = await window.privateNotes.files.export({ noteId: activeNote.id, format: 'markdown' })
          showToast(exported ? 'Exported successfully' : 'Export cancelled', exported ? 'success' : 'info')
        }
      },
      {
        label: 'Import Markdown files',
        icon: Upload,
        run: async () => {
          const result = await window.privateNotes.files.import('markdown')
          await loadNotes()
          await refreshOrganization()
          showToast(`${result.imported} note(s) imported`, 'success')
        }
      },
      {
        label: 'Toggle theme',
        icon: Moon,
        run: async () => {
          await updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
          showToast('Theme updated', 'success')
        }
      },
      {
        label: 'Open settings',
        icon: Settings,
        run: async () => {
          onOpenSettings()
        }
      },
      {
        label: 'Backup now',
        icon: RotateCcw,
        run: async () => {
          await window.privateNotes.backup.create()
          showToast('Backup created', 'success')
        }
      },
      {
        label: 'Archive current note',
        icon: Archive,
        run: async () => {
          if (!activeNote) return
          await window.privateNotes.notes.update(activeNote.id, { archived: true, pinned: false })
          await loadNotes()
          showToast('Note archived', 'success')
        }
      }
    ],
    [activeNote, createNote, loadNotes, onOpenSettings, query, refreshOrganization, setSearchQuery, settings.theme, showToast, updateSettings, selectedFolder]
  )

  const filtered = commands.filter((command) => command.label.toLowerCase().includes(query.toLowerCase()))

  if (!open) return null

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/45 pt-24 backdrop-blur-sm">
      <div className="w-[560px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-white/25 bg-black shadow-2xl">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose()
          }}
          placeholder="Run command..."
          className="h-14 w-full border-b border-white/25 bg-transparent px-4 text-sm text-white outline-none placeholder:text-zinc-400"
        />
        <div className="max-h-96 overflow-y-auto p-2">
          {filtered.map((command) => (
            <button
              key={command.label}
              type="button"
              onClick={() => {
                void command.run()
                onClose()
              }}
              className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-zinc-100 transition hover:bg-white/10 hover:text-white"
            >
              <command.icon size={17} />
              <span>{command.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
