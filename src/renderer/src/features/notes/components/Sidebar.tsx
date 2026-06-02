import { Archive, Clock3, FileText, GitBranch, Pin, Plus, Settings, Sparkles, Star, Trash2 } from 'lucide-react'
import type { NoteFilter, NoteSort } from '../../../../../shared/types'
import { SearchBox } from '../../search/components/SearchBox'
import { useNotesStore } from '../../../store/useNotesStore'
import { useToastStore } from '../../../store/useToastStore'
import { FolderTree } from './FolderTree'

const navItems: Array<{ id: NoteFilter; label: string; icon: typeof FileText }> = [
  { id: 'all', label: 'All Notes', icon: FileText },
  { id: 'favorites', label: 'Favorites', icon: Star },
  { id: 'pinned', label: 'Pinned', icon: Pin },
  { id: 'recent', label: 'Recently Edited', icon: Clock3 },
  { id: 'created', label: 'Recently Created', icon: Sparkles },
  { id: 'archive', label: 'Archive', icon: Archive },
  { id: 'trash', label: 'Trash', icon: Trash2 }
]

const colorLabels = ['Red', 'Amber', 'Green', 'Cyan', 'Violet']

const sortOptions: Array<{ id: NoteSort; label: string }> = [
  { id: 'updatedAt', label: 'Updated' },
  { id: 'createdAt', label: 'Created' },
  { id: 'title', label: 'Title' },
  { id: 'favorite', label: 'Favorite' },
  { id: 'pinned', label: 'Pinned' }
]

interface SidebarProps {
  searchInputId: string
  onOpenSettings: () => void
  onOpenGraph: () => void
}

export function Sidebar({ searchInputId, onOpenSettings, onOpenGraph }: SidebarProps) {
  const filter = useNotesStore((state) => state.filter)
  const tags = useNotesStore((state) => state.tags)
  const folders = useNotesStore((state) => state.folders)
  const selectedTag = useNotesStore((state) => state.selectedTag)
  const selectedFolder = useNotesStore((state) => state.selectedFolder)
  const selectedColorLabel = useNotesStore((state) => state.selectedColorLabel)
  const sort = useNotesStore((state) => state.sort)
  const setFilter = useNotesStore((state) => state.setFilter)
  const setSelectedTag = useNotesStore((state) => state.setSelectedTag)
  const setSelectedFolder = useNotesStore((state) => state.setSelectedFolder)
  const setSelectedColorLabel = useNotesStore((state) => state.setSelectedColorLabel)
  const setSort = useNotesStore((state) => state.setSort)
  const createNote = useNotesStore((state) => state.createNote)
  const createFolder = useNotesStore((state) => state.createFolder)
  const deleteFolder = useNotesStore((state) => state.deleteFolder)
  const updateNote = useNotesStore((state) => state.updateNote)
  const showToast = useToastStore((state) => state.showToast)

  const handleCreateFolder = (parentFolder: string | null, name: string) => {
    const path = parentFolder ? `${parentFolder}/${name}` : name
    void createFolder(path)
      .then((folder) => {
        if (folder) showToast(`Created folder ${folder}`, 'success')
      })
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : 'Could not create folder', 'error')
      })
  }

  const handleCreateNote = (targetFolder: string | null = selectedFolder) => {
    void createNote({ folder: targetFolder ?? undefined })
  }

  const handleDeleteFolder = (folder: string) => {
    if (!window.confirm(`Delete folder "${folder}"?\n\nNotes inside this folder will be kept and moved out of the folder.`)) {
      return
    }

    void deleteFolder(folder)
      .then(() => showToast(`Deleted folder ${folder}`, 'success'))
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : 'Could not delete folder', 'error')
      })
  }

  const handleDropFiles = (folder: string, files: FileList) => {
    const fileList = Array.from(files)
    if (fileList.length === 0) return

    void Promise.all(
      fileList.map(
        (file) =>
          new Promise<void>((resolve) => {
            const reader = new FileReader()
            reader.onload = async () => {
              const content = String(reader.result ?? '')
              const lowerName = file.name.toLowerCase()
              const title = file.name.replace(/\.[^.]+$/, '')

              try {
                if (lowerName.endsWith('.json')) {
                  const parsed = JSON.parse(content) as { notes?: Array<{ title?: string; content?: string; tags?: string[] }> }
                  const notes = parsed.notes ?? []
                  for (const note of notes) {
                    await createNote({
                      title: note.title || 'Imported Note',
                      content: note.content || '',
                      tags: note.tags || ['Imported'],
                      folder
                    })
                  }
                } else {
                  await createNote({
                    title,
                    content,
                    tags: lowerName.endsWith('.md') || lowerName.endsWith('.markdown') ? ['Imported Markdown'] : ['Imported'],
                    folder
                  })
                }
              } catch {
                await createNote({ title, content, tags: ['Imported'], folder })
              }

              resolve()
            }
            reader.onerror = () => resolve()
            reader.readAsText(file)
          })
      )
    ).then(() => showToast(`Imported ${fileList.length} file(s) into ${folder}`, 'success'))
  }

  const handleDropNote = (folder: string, noteId: string) => {
    void updateNote(noteId, { folder })
      .then((note) => {
        if (note) showToast(`Moved "${note.title}" to ${folder}`, 'success')
      })
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : 'Could not move note', 'error')
      })
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/20 bg-black px-3 py-4 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between px-1">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-50">Private Notes</h1>
          <p className="text-xs text-zinc-300">Offline encrypted workspace</p>
        </div>
        <button
          type="button"
          onClick={() => handleCreateNote()}
          className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-300 text-black shadow-lg shadow-cyan-300/30 transition hover:bg-cyan-200"
          title={selectedFolder ? `Create note in ${selectedFolder}` : 'Create note'}
        >
          <Plus size={18} />
        </button>
      </div>

      <SearchBox id={searchInputId} />

      <nav className="mt-5 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => void setFilter(item.id)}
            className={`flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm transition ${
              filter === item.id
                ? 'bg-cyan-300/20 text-white shadow-sm ring-1 ring-cyan-300/30'
                : 'text-zinc-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            <item.icon size={17} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-6 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        <FolderTree
          folders={folders}
          selectedFolder={selectedFolder}
          onSelect={(folder) => void setSelectedFolder(folder)}
          onCreateFolder={handleCreateFolder}
          onCreateNote={(folder) => handleCreateNote(folder)}
          onDeleteFolder={handleDeleteFolder}
          onDropNote={handleDropNote}
          onDropFiles={handleDropFiles}
        />

        <div>
        <div className="mb-2 flex items-center justify-between px-2">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-300">Tags</p>
          {selectedTag ? (
            <button
              type="button"
              onClick={() => void setSelectedTag(null)}
              className="text-xs text-cyan-200 hover:text-cyan-100"
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="space-y-1">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => void setSelectedTag(tag)}
              className={`flex h-8 w-full items-center justify-between rounded-md px-2 text-left text-sm transition ${
                selectedTag === tag
                  ? 'bg-cyan-300/20 text-white ring-1 ring-cyan-300/30'
                  : 'text-zinc-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="truncate">{tag}</span>
            </button>
          ))}
        </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-300">Labels</p>
            {selectedColorLabel ? (
              <button
                type="button"
                onClick={() => void setSelectedColorLabel(null)}
                className="text-xs text-cyan-200 hover:text-cyan-100"
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 px-2">
            {colorLabels.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => void setSelectedColorLabel(label)}
                className={`h-6 rounded-md border px-2 text-xs transition ${
                  selectedColorLabel === label
                    ? 'border-cyan-200 bg-cyan-300/20 text-white'
                    : 'border-white/20 text-zinc-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-zinc-300">Sort</p>
          <select
            value={sort}
            onChange={(event) => void setSort(event.target.value as NoteSort)}
            className="h-9 w-full rounded-lg border border-white/25 bg-zinc-950 px-2 text-sm text-white outline-none"
          >
            {sortOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        <button
          type="button"
          onClick={onOpenGraph}
          className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-zinc-200 transition hover:bg-white/10 hover:text-white"
        >
          <GitBranch size={17} />
          <span>Graph</span>
          <kbd className="ml-auto rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-300">
            Ctrl G
          </kbd>
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-zinc-200 transition hover:bg-white/10 hover:text-white"
        >
          <Settings size={17} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  )
}
