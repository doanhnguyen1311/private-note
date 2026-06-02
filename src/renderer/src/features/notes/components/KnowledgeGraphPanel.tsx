import { useMemo, useState } from 'react'
import { FileText, Folder, GitBranch, Search, X } from 'lucide-react'
import type { Note } from '../../../../../shared/types'
import { buildFolderTree, type FolderNode } from '../lib/folderTree'
import { useNotesStore } from '../../../store/useNotesStore'

interface KnowledgeGraphPanelProps {
  open: boolean
  onClose: () => void
}

export function KnowledgeGraphPanel({ open, onClose }: KnowledgeGraphPanelProps) {
  const [query, setQuery] = useState('')
  const notes = useNotesStore((state) => state.notes)
  const folders = useNotesStore((state) => state.folders)
  const setActiveNote = useNotesStore((state) => state.setActiveNote)
  const setSelectedFolder = useNotesStore((state) => state.setSelectedFolder)

  const tree = useMemo(() => buildFolderTree(folders), [folders])
  const normalizedQuery = query.trim().toLowerCase()
  const filteredNotes = useMemo(() => {
    if (!normalizedQuery) return notes
    return notes.filter((note) => {
      const haystack = `${note.title} ${note.content} ${note.tags.join(' ')} ${note.folder ?? ''}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [normalizedQuery, notes])

  const unfiledNotes = filteredNotes.filter((note) => !note.folder)

  const openNote = (note: Note) => {
    setActiveNote(note.id)
    onClose()
  }

  const openFolder = (path: string) => {
    void setSelectedFolder(path)
    onClose()
  }

  if (!open) return null

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-6 backdrop-blur-md">
      <section className="animate-scale-in flex h-[min(760px,calc(100vh-48px))] w-[940px] max-w-full flex-col overflow-hidden rounded-2xl border border-white/20 bg-zinc-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/15 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/20 text-cyan-50">
              <GitBranch size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Knowledge Graph</h2>
              <p className="text-sm text-zinc-300">Folder tree and notes for quick opening.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-zinc-200 transition hover:bg-white/10 hover:text-white"
            title="Close graph"
          >
            <X size={18} />
          </button>
        </header>

        <div className="border-b border-white/15 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-300" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') onClose()
              }}
              placeholder="Search notes, folders, tags..."
              className="h-11 w-full rounded-xl border border-white/20 bg-black pl-10 pr-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-cyan-200"
            />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(260px,320px)_1fr] overflow-hidden">
          <aside className="min-h-0 overflow-y-auto border-r border-white/15 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-300">Folders</div>
            <div className="space-y-1">
              {tree.length === 0 ? (
                <div className="rounded-xl border border-white/15 bg-black/40 p-4 text-sm text-zinc-300">
                  No folders yet.
                </div>
              ) : (
                tree.map((node) => <GraphFolder key={node.path} node={node} depth={0} onOpenFolder={openFolder} />)
              )}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Notes</div>
              <div className="rounded-md border border-white/15 bg-black px-2 py-1 text-xs text-zinc-300">
                {filteredNotes.length} notes
              </div>
            </div>

            <div className="space-y-4">
              {tree.map((folder) => (
                <GraphFolderNotes
                  key={folder.path}
                  folder={folder}
                  notes={filteredNotes}
                  onOpenNote={openNote}
                  onOpenFolder={openFolder}
                />
              ))}

              {unfiledNotes.length > 0 ? (
                <section>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                    <Folder size={15} className="text-zinc-300" />
                    No folder
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {unfiledNotes.map((note) => (
                      <GraphNote key={note.id} note={note} onOpen={() => openNote(note)} />
                    ))}
                  </div>
                </section>
              ) : null}

              {filteredNotes.length === 0 ? (
                <div className="rounded-2xl border border-white/15 bg-black/40 p-8 text-center">
                  <p className="text-sm font-medium text-white">No matching notes</p>
                  <p className="mt-1 text-sm text-zinc-300">Try a different search term.</p>
                </div>
              ) : null}
            </div>
          </main>
        </div>
      </section>
    </div>
  )
}

function GraphFolder({
  node,
  depth,
  onOpenFolder
}: {
  node: FolderNode
  depth: number
  onOpenFolder: (path: string) => void
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onOpenFolder(node.path)}
        className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-zinc-200 transition hover:bg-white/10 hover:text-white"
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        <Folder size={15} className="shrink-0 text-cyan-100" />
        <span className="truncate">{node.name}</span>
      </button>
      {node.children.map((child) => (
        <GraphFolder key={child.path} node={child} depth={depth + 1} onOpenFolder={onOpenFolder} />
      ))}
    </div>
  )
}

function GraphFolderNotes({
  folder,
  notes,
  onOpenNote,
  onOpenFolder
}: {
  folder: FolderNode
  notes: Note[]
  onOpenNote: (note: Note) => void
  onOpenFolder: (path: string) => void
}) {
  const folderNotes = notes.filter((note) => note.folder === folder.path)
  const hasContent = folderNotes.length > 0 || folder.children.some((child) => folderHasNotes(child, notes))

  if (!hasContent) return null

  return (
    <section>
      <button
        type="button"
        onClick={() => onOpenFolder(folder.path)}
        className="mb-2 flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-white transition hover:bg-white/10"
      >
        <Folder size={15} className="text-cyan-100" />
        {folder.path}
      </button>
      {folderNotes.length > 0 ? (
        <div className="grid gap-2 md:grid-cols-2">
          {folderNotes.map((note) => (
            <GraphNote key={note.id} note={note} onOpen={() => onOpenNote(note)} />
          ))}
        </div>
      ) : null}
      <div className="mt-3 space-y-3 border-l border-white/15 pl-4">
        {folder.children.map((child) => (
          <GraphFolderNotes
            key={child.path}
            folder={child}
            notes={notes}
            onOpenNote={onOpenNote}
            onOpenFolder={onOpenFolder}
          />
        ))}
      </div>
    </section>
  )
}

function folderHasNotes(folder: FolderNode, notes: Note[]): boolean {
  return notes.some((note) => note.folder === folder.path) || folder.children.some((child) => folderHasNotes(child, notes))
}

function GraphNote({ note, onOpen }: { note: Note; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group rounded-xl border border-white/15 bg-black/45 p-3 text-left transition hover:border-cyan-200/60 hover:bg-cyan-300/10"
    >
      <div className="flex items-start gap-2">
        <FileText size={15} className="mt-0.5 shrink-0 text-cyan-100" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{note.title || 'Untitled Note'}</div>
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-300">
            {note.content.replace(/[#*_`>|-]/g, ' ').replace(/\s+/g, ' ').trim() || 'No content'}
          </div>
        </div>
      </div>
    </button>
  )
}
