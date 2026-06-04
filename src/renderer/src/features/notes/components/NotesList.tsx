import { useMemo, useRef, useState } from 'react'
import { Archive, ArchiveRestore, Copy, FilePlus, Flame, GripVertical, Pin, Search, Star, Trash2 } from 'lucide-react'
import { copyNote } from '../../../lib/clipboard'
import { useNotesStore } from '../../../store/useNotesStore'
import { useSettingsStore } from '../../../store/useSettingsStore'
import { useToastStore } from '../../../store/useToastStore'

const rowHeight = 116
const overscan = 5

function previewText(content: string): string {
  return content.replace(/[#*_`>|-]/g, ' ').replace(/\s+/g, ' ').trim() || 'No additional text'
}

function formatUpdated(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

export function NotesList() {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [menu, setMenu] = useState<{ noteId: string; x: number; y: number } | null>(null)
  const notes = useNotesStore((state) => state.notes)
  const activeNoteId = useNotesStore((state) => state.activeNoteId)
  const filter = useNotesStore((state) => state.filter)
  const loading = useNotesStore((state) => state.loading)
  const setActiveNote = useNotesStore((state) => state.setActiveNote)
  const createNote = useNotesStore((state) => state.createNote)
  const moveToTrash = useNotesStore((state) => state.moveToTrash)
  const restoreNote = useNotesStore((state) => state.restoreNote)
  const deletePermanent = useNotesStore((state) => state.deletePermanent)
  const updateNote = useNotesStore((state) => state.updateNote)
  const selectedFolder = useNotesStore((state) => state.selectedFolder)
  const hideRecentContent = useSettingsStore((state) => state.settings.hideRecentContent)
  const showToast = useToastStore((state) => state.showToast)

  const viewportHeight = listRef.current?.clientHeight ?? 800
  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
    const end = Math.min(notes.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan)
    return { start, end }
  }, [notes.length, scrollTop, viewportHeight])

  const visibleNotes = notes.slice(visibleRange.start, visibleRange.end)

  const menuNote = notes.find((note) => note.id === menu?.noteId)

  return (
    <section className="flex h-full w-80 shrink-0 flex-col border-r border-white/20 bg-zinc-950">
      <div className="border-b border-white/20 bg-zinc-900 px-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-100">{filter}</h2>
          <span className="rounded-md border border-white/20 bg-black px-2 py-1 text-xs text-zinc-100">{notes.length}</span>
        </div>
      </div>

      {notes.length === 0 ? (
        loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 h-4 w-2/3 rounded bg-white/15" />
                <div className="mb-2 h-3 w-full rounded bg-white/10" />
                <div className="h-3 w-1/2 rounded bg-white/10" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <div className="animate-fade-in rounded-2xl border border-white/15 bg-black/40 p-5">
              <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-cyan-300/15 text-cyan-50">
                <Search size={19} />
              </div>
              <p className="text-sm font-medium text-white">No notes in this view</p>
              <p className="mt-1 text-xs leading-5 text-zinc-300">Create a note, clear filters, or drop files into a folder.</p>
              <button
                type="button"
                onClick={() => void createNote({ folder: selectedFolder ?? undefined })}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-cyan-300 px-3 text-sm font-medium text-black transition hover:bg-cyan-200"
              >
                <FilePlus size={15} />
                New note
              </button>
            </div>
          </div>
        )
      ) : (
        <div
          ref={listRef}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          className="relative flex-1 overflow-y-auto"
        >
          <div style={{ height: notes.length * rowHeight }}>
            <div style={{ transform: `translateY(${visibleRange.start * rowHeight}px)` }}>
              {visibleNotes.map((note) => (
                <div
                  key={note.id}
                  role="button"
                  tabIndex={0}
                  draggable={!note.trashed}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('application/private-notes-note-id', note.id)
                    event.dataTransfer.setData('text/plain', note.title || 'Untitled Note')
                    setActiveNote(note.id)
                  }}
                  onClick={() => setActiveNote(note.id)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    setActiveNote(note.id)
                    setMenu({ noteId: note.id, x: event.clientX, y: event.clientY })
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setActiveNote(note.id)
                    }
                  }}
                  className={`group flex h-[116px] w-full cursor-default flex-col border-b border-white/15 px-4 py-3 text-left transition duration-200 ${
                    activeNoteId === note.id
                      ? 'bg-cyan-300/15 shadow-[inset_3px_0_0_rgba(103,232,249,1)]'
                      : 'hover:bg-white/10 hover:shadow-[inset_3px_0_0_rgba(255,255,255,0.25)]'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical size={14} className="mt-0.5 shrink-0 text-zinc-600 opacity-0 transition group-hover:opacity-100" />
                    <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">
                      {note.title || 'Untitled Note'}
                    </h3>
                    <div className="flex shrink-0 items-center gap-1 text-zinc-300">
                      {note.pinned ? <Pin size={13} /> : null}
                      {note.favorite ? <Star size={13} className="text-amber-300" /> : null}
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-200">
                    {hideRecentContent ? 'Content hidden' : previewText(note.content)}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {note.folder ? <span className="truncate text-[10px] text-cyan-100">{note.folder}</span> : null}
                    {note.colorLabel ? (
                      <span className="rounded border border-white/15 bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-100">
                        {note.colorLabel}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3">
                    <span className="truncate text-[11px] text-zinc-300">{formatUpdated(note.updatedAt)}</span>
                    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      {note.trashed ? (
                        <>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              void restoreNote(note.id)
                            }}
                            className="rounded p-1 text-zinc-200 hover:bg-white/15 hover:text-cyan-100"
                            title="Restore"
                          >
                            <ArchiveRestore size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              if (window.confirm('Permanently delete this note? This cannot be undone.')) {
                                void deletePermanent(note.id)
                              }
                            }}
                            className="rounded p-1 text-zinc-200 hover:bg-red-500/25 hover:text-red-100"
                            title="Delete permanently"
                          >
                            <Flame size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            if (window.confirm('Move this note to trash?')) {
                              void moveToTrash(note.id)
                            }
                          }}
                          className="rounded p-1 text-zinc-200 hover:bg-red-500/25 hover:text-red-100"
                          title="Move to trash"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {menu && menuNote ? (
        <div
          className="fixed z-50 w-52 rounded-lg border border-white/25 bg-black p-1 text-sm shadow-2xl"
          style={{ left: menu.x, top: menu.y }}
          onMouseLeave={() => setMenu(null)}
        >
          <button
            type="button"
            onClick={() => {
              void copyNote(menuNote, 'markdown').then(() => showToast('Copied successfully', 'success'))
              setMenu(null)
            }}
            className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-zinc-100 hover:bg-white/10"
          >
            <Copy size={15} />
            Copy as Markdown
          </button>
          <button
            type="button"
            onClick={() => {
              void updateNote(menuNote.id, { archived: !menuNote.archived, pinned: menuNote.archived ? menuNote.pinned : false })
              setMenu(null)
            }}
            className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-zinc-100 hover:bg-white/10"
          >
            <Archive size={15} />
            {menuNote.archived ? 'Unarchive' : 'Archive'}
          </button>
          {menuNote.trashed ? (
            <>
              <button
                type="button"
                onClick={() => {
                  void restoreNote(menuNote.id)
                  setMenu(null)
                }}
                className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-zinc-100 hover:bg-white/10"
              >
                <ArchiveRestore size={15} />
                Restore
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Permanently delete this note? This cannot be undone.')) {
                    void deletePermanent(menuNote.id)
                  }
                  setMenu(null)
                }}
                className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-red-300 hover:bg-red-500/15"
              >
                <Flame size={15} />
                Delete permanently
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Move this note to trash?')) {
                  void moveToTrash(menuNote.id)
                }
                setMenu(null)
              }}
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-red-300 hover:bg-red-500/15"
            >
              <Trash2 size={15} />
              Move to trash
            </button>
          )}
        </div>
      ) : null}
    </section>
  )
}
