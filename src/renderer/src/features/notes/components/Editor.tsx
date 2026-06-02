import { useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import {
  Archive,
  ArchiveRestore,
  Copy,
  Download,
  Eye,
  Flame,
  FilePlus,
  LayoutPanelLeft,
  PanelRight,
  Pin,
  Plus,
  Save,
  Star,
  Trash2
} from 'lucide-react'
import { TagPill } from '../../tags/components/TagPill'
import { TableOfContents } from './TableOfContents'
import { copyNote, type CopyKind } from '../../../lib/clipboard'
import { useNotesStore } from '../../../store/useNotesStore'
import { useSettingsStore } from '../../../store/useSettingsStore'
import { useToastStore } from '../../../store/useToastStore'
import type { ExportFormat, NoteUpdate } from '../../../../../shared/types'
import { parseHeadings, type TocHeading } from '../lib/headings'

type ViewMode = 'edit' | 'split' | 'preview'

marked.use({ gfm: true, breaks: true })

export function Editor() {
  const notes = useNotesStore((state) => state.notes)
  const activeNoteId = useNotesStore((state) => state.activeNoteId)
  const updateNote = useNotesStore((state) => state.updateNote)
  const createNote = useNotesStore((state) => state.createNote)
  const duplicateNote = useNotesStore((state) => state.duplicateNote)
  const moveToTrash = useNotesStore((state) => state.moveToTrash)
  const restoreNote = useNotesStore((state) => state.restoreNote)
  const deletePermanent = useNotesStore((state) => state.deletePermanent)
  const setActiveNote = useNotesStore((state) => state.setActiveNote)
  const autoSaveDelay = useSettingsStore((state) => state.settings.autoSaveDelay)
  const showToast = useToastStore((state) => state.showToast)

  const activeNote = notes.find((note) => note.id === activeNoteId) ?? null
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [folder, setFolder] = useState('')
  const [colorLabel, setColorLabel] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [tocOpen, setTocOpen] = useState(true)
  const [tocWidth, setTocWidth] = useState(300)
  const [headings, setHeadings] = useState<TocHeading[]>([])
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null)
  const [highlightedHeadingId, setHighlightedHeadingId] = useState<string | null>(null)
  const previewRef = useRef<HTMLElement | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tocTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<NoteUpdate>({})

  useEffect(() => {
    if (!activeNote) {
      setTitle('')
      setContent('')
      setTags([])
      return
    }

    setTitle(activeNote.title)
    setContent(activeNote.content)
    setTags(activeNote.tags)
    setFolder(activeNote.folder ?? '')
    setColorLabel(activeNote.colorLabel ?? '')
    setHeadings(parseHeadings(activeNote.content))
    setActiveHeadingId(null)
    pendingRef.current = {}
  }, [activeNote])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (tocTimeoutRef.current) clearTimeout(tocTimeoutRef.current)
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (tocTimeoutRef.current) clearTimeout(tocTimeoutRef.current)
    tocTimeoutRef.current = setTimeout(() => {
      setHeadings(parseHeadings(content))
    }, 150)
  }, [content])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 's' && activeNoteId) {
        event.preventDefault()
        pendingRef.current = { ...pendingRef.current, title, content, tags }
        void flushSave()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const html = useMemo(() => {
    const raw = marked.parse(enhanceMarkdown(content || '*Empty note*'), { async: false }) as string
    const withCodeButtons = raw.replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g, (_match, attrs, code) => {
      const encoded = encodeURIComponent(decodeHtml(String(code)))
      return `<div class="code-block-shell"><button type="button" class="code-copy-button" data-copy-code="${encoded}">Copy</button><pre><code${attrs}>${code}</code></pre></div>`
    })
    return DOMPurify.sanitize(addHeadingAnchors(withCodeButtons, headings, highlightedHeadingId), {
      ADD_ATTR: ['data-outline-heading', 'data-copy-code', 'data-note-title']
    })
  }, [content, headings, highlightedHeadingId])

  useEffect(() => {
    const preview = previewRef.current
    if (!preview) return

    let frame = 0
    const updateActiveHeading = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const headingElements = Array.from(preview.querySelectorAll<HTMLElement>('[data-outline-heading]'))
        if (!headingElements.length) {
          setActiveHeadingId(null)
          return
        }

        const previewTop = preview.getBoundingClientRect().top
        const candidates = headingElements.map((element) => ({
          id: element.dataset.outlineHeading ?? '',
          distance: element.getBoundingClientRect().top - previewTop
        }))
        const current =
          candidates
            .filter((item) => item.distance <= 96)
            .sort((a, b) => b.distance - a.distance)[0] ?? candidates[0]

        setActiveHeadingId(current.id || null)
      })
    }

    updateActiveHeading()
    preview.addEventListener('scroll', updateActiveHeading, { passive: true })
    return () => {
      window.cancelAnimationFrame(frame)
      preview.removeEventListener('scroll', updateActiveHeading)
    }
  }, [html, viewMode])

  const flushSave = async () => {
    if (!activeNoteId) return
    const updates = pendingRef.current
    pendingRef.current = {}
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (Object.keys(updates).length > 0) {
      await updateNote(activeNoteId, updates)
    }
  }

  const scheduleSave = (updates: NoteUpdate) => {
    pendingRef.current = { ...pendingRef.current, ...updates }
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      void flushSave()
    }, autoSaveDelay)
  }

  const setTagsAndSave = (nextTags: string[]) => {
    const normalized = Array.from(new Set(nextTags.map((tag) => tag.trim()).filter(Boolean)))
    setTags(normalized)
    scheduleSave({ tags: normalized })
  }

  const copy = async (kind: CopyKind) => {
    if (!activeNote) return
    await copyNote({ ...activeNote, title, content, tags, folder: folder || null, colorLabel: colorLabel || null }, kind)
    showToast('Copied successfully', 'success')
  }

  const exportNote = async (format: ExportFormat) => {
    if (!activeNote) return
    await flushSave()
    const exported = await window.privateNotes.files.export({ noteId: activeNote.id, format })
    showToast(exported ? 'Exported successfully' : 'Export cancelled', exported ? 'success' : 'info')
  }

  const insertImage = (name: string, dataUrl: string) => {
    const markdown = `\n![${name}](${dataUrl})\n`
    const next = `${content}${markdown}`
    setContent(next)
    scheduleSave({ content: next })
    showToast('Image added', 'success')
  }

  const handleImageFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .forEach((file) => {
        const reader = new FileReader()
        reader.onload = () => insertImage(file.name, String(reader.result))
        reader.readAsDataURL(file)
      })
  }

  const navigateToHeading = (heading: TocHeading) => {
    if (viewMode === 'edit') {
      setViewMode('split')
    }

    window.setTimeout(() => {
      const preview = previewRef.current
      const target = preview?.querySelector<HTMLElement>(`[data-outline-heading="${CSS.escape(heading.id)}"]`)
      if (!preview || !target) return

      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveHeadingId(heading.id)
      setHighlightedHeadingId(heading.id)

      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedHeadingId(null)
      }, 1400)
    }, viewMode === 'edit' ? 80 : 0)
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
  const characterCount = content.length

  const addTag = () => {
    if (!tagDraft.trim()) return
    setTagsAndSave([...tags, tagDraft])
    setTagDraft('')
  }

  if (!activeNote) {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,rgba(103,232,249,0.08),transparent_35%),#09090b]">
        <div className="text-center">
          <p className="text-lg font-medium text-zinc-200">Select or create a note</p>
          <p className="mt-2 text-sm text-zinc-300">Your local workspace is ready.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-black">
      <header className="flex min-h-16 items-center justify-between border-b border-white/20 bg-zinc-950 px-5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void createNote({ folder: folder || undefined })}
            className="grid h-9 w-9 place-items-center rounded-lg text-zinc-200 transition hover:bg-white/10 hover:text-white"
            title={folder ? `New note in ${folder}` : 'New note'}
          >
            <FilePlus size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              pendingRef.current = { ...pendingRef.current, title, content, tags, folder: folder || null, colorLabel: colorLabel || null }
              void flushSave().then(() => showToast('Saved', 'success'))
            }}
            className="grid h-9 w-9 place-items-center rounded-lg text-zinc-200 transition hover:bg-white/10 hover:text-white"
            title="Save now"
          >
            <Save size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              scheduleSave({ favorite: !activeNote.favorite })
            }}
            className={`grid h-9 w-9 place-items-center rounded-lg transition ${
              activeNote.favorite
                ? 'bg-amber-300/25 text-amber-100 ring-1 ring-amber-200/40'
                : 'text-zinc-200 hover:bg-white/10 hover:text-white'
            }`}
            title="Favorite"
          >
            <Star size={18} fill={activeNote.favorite ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={() => {
              scheduleSave({ pinned: !activeNote.pinned })
            }}
            className={`grid h-9 w-9 place-items-center rounded-lg transition ${
              activeNote.pinned
                ? 'bg-cyan-300/25 text-white ring-1 ring-cyan-200/40'
                : 'text-zinc-200 hover:bg-white/10 hover:text-white'
            }`}
            title="Pin"
          >
            <Pin size={18} fill={activeNote.pinned ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={() => void duplicateNote(activeNote.id)}
            className="grid h-9 w-9 place-items-center rounded-lg text-zinc-200 transition hover:bg-white/10 hover:text-white"
            title="Duplicate"
          >
            <Copy size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              scheduleSave({ archived: !activeNote.archived, pinned: activeNote.archived ? activeNote.pinned : false })
              showToast(activeNote.archived ? 'Note restored from archive' : 'Note archived', 'success')
            }}
            className={`grid h-9 w-9 place-items-center rounded-lg transition ${
              activeNote.archived
                ? 'bg-cyan-300/25 text-white ring-1 ring-cyan-200/40'
                : 'text-zinc-200 hover:bg-white/10 hover:text-white'
            }`}
            title="Archive"
          >
            <Archive size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-white/25 bg-black p-1">
          {[
            { id: 'edit' as const, icon: LayoutPanelLeft, label: 'Edit' },
            { id: 'split' as const, icon: PanelRight, label: 'Split' },
            { id: 'preview' as const, icon: Eye, label: 'Preview' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setViewMode(item.id)}
              className={`grid h-8 w-8 place-items-center rounded-md transition ${
                viewMode === item.id ? 'bg-cyan-300/20 text-white' : 'text-zinc-200 hover:text-white'
              }`}
              title={item.label}
            >
              <item.icon size={16} />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            defaultValue=""
            onChange={(event) => {
              const value = event.target.value as CopyKind | ''
              if (value) void copy(value)
              event.target.value = ''
            }}
            className="h-9 rounded-lg border border-white/25 bg-black px-2 text-xs text-white outline-none"
            title="Copy"
          >
            <option value="">Copy</option>
            <option value="title">Title</option>
            <option value="content">Content</option>
            <option value="plain">Plain text</option>
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
            <option value="link">Note link</option>
          </select>
          <select
            defaultValue=""
            onChange={(event) => {
              const value = event.target.value as ExportFormat | ''
              if (value) void exportNote(value)
              event.target.value = ''
            }}
            className="h-9 rounded-lg border border-white/25 bg-black px-2 text-xs text-white outline-none"
            title="Export"
          >
            <option value="">Export</option>
            <option value="markdown">Markdown</option>
            <option value="txt">TXT</option>
            <option value="html">HTML</option>
            <option value="pdf">PDF</option>
            <option value="json">JSON backup</option>
          </select>
          <Download size={16} className="text-zinc-300" />
          {activeNote.trashed ? (
            <>
              <button
                type="button"
                onClick={() => void restoreNote(activeNote.id)}
                className="grid h-9 w-9 place-items-center rounded-lg text-cyan-100 transition hover:bg-cyan-300/15"
                title="Restore"
              >
                <ArchiveRestore size={18} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Permanently delete this note? This cannot be undone.')) {
                    void deletePermanent(activeNote.id)
                  }
                }}
                className="grid h-9 w-9 place-items-center rounded-lg text-red-300 transition hover:bg-red-500/15"
                title="Delete permanently"
              >
                <Flame size={18} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Move this note to trash?')) {
                  void moveToTrash(activeNote.id)
                }
              }}
              className="grid h-9 w-9 place-items-center rounded-lg text-zinc-200 transition hover:bg-red-500/25 hover:text-red-100"
              title="Move to trash"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-white/20 bg-zinc-950 px-8 py-5">
          <input
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              scheduleSave({ title: event.target.value })
            }}
            className="w-full bg-transparent text-3xl font-semibold tracking-normal text-white outline-none placeholder:text-zinc-400"
            placeholder="Untitled Note"
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {tags.map((tag) => (
              <TagPill
                key={tag}
                label={tag}
                onRemove={() => setTagsAndSave(tags.filter((current) => current !== tag))}
              />
            ))}
            <div className="flex h-7 items-center gap-1 rounded-md border border-white/25 bg-black px-2">
              <Plus size={13} className="text-zinc-300" />
              <input
                type="text"
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addTag()
                  }
                }}
                onBlur={addTag}
                placeholder="Tag"
                className="w-24 bg-transparent text-xs text-white outline-none placeholder:text-zinc-400"
              />
            </div>
            <input
              type="text"
              value={folder}
              onChange={(event) => {
                setFolder(event.target.value)
                scheduleSave({ folder: event.target.value || null })
              }}
              placeholder="Folder / nested/folder"
              className="h-7 w-44 rounded-md border border-white/25 bg-black px-2 text-xs text-white outline-none placeholder:text-zinc-400"
            />
            <select
              value={colorLabel}
              onChange={(event) => {
                setColorLabel(event.target.value)
                scheduleSave({ colorLabel: event.target.value || null })
              }}
              className="h-7 rounded-md border border-white/25 bg-black px-2 text-xs text-white outline-none"
            >
              <option value="">No label</option>
              <option value="Red">Red</option>
              <option value="Amber">Amber</option>
              <option value="Green">Green</option>
              <option value="Cyan">Cyan</option>
              <option value="Violet">Violet</option>
            </select>
            <span className="ml-auto text-xs text-zinc-300">
              {wordCount} words · {characterCount} chars
            </span>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <div className="grid min-w-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
            {viewMode !== 'preview' ? (
              <textarea
                value={content}
                onChange={(event) => {
                  setContent(event.target.value)
                  scheduleSave({ content: event.target.value })
                }}
                onPaste={(event) => handleImageFiles(event.clipboardData.files)}
                onDrop={(event) => {
                  event.preventDefault()
                  handleImageFiles(event.dataTransfer.files)
                }}
                onDragOver={(event) => event.preventDefault()}
                placeholder="Start typing..."
                className={`min-h-0 resize-none overflow-y-auto bg-black px-8 py-6 text-[length:var(--editor-font-size)] leading-8 text-zinc-50 outline-none placeholder:text-zinc-400 ${
                  viewMode === 'edit' ? 'lg:col-span-2' : 'border-r border-white/20'
                }`}
              />
            ) : null}

            {viewMode !== 'edit' ? (
              <article
                ref={previewRef}
                className={`markdown-body min-h-0 scroll-smooth overflow-y-auto px-8 py-6 ${
                  viewMode === 'preview' ? 'lg:col-span-2' : ''
                }`}
                onClick={(event) => {
                  const target = event.target as HTMLElement
                  const code = target.dataset.copyCode
                  if (code) {
                    void navigator.clipboard.writeText(decodeURIComponent(code)).then(() => showToast('Copied successfully', 'success'))
                  }
                  const noteTitle = target.dataset.noteTitle
                  if (noteTitle) {
                    const match = notes.find((note) => note.title.toLowerCase() === decodeURIComponent(noteTitle).toLowerCase())
                    if (match) setActiveNote(match.id)
                  }
                }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : null}
          </div>

          <TableOfContents
            headings={headings}
            activeHeadingId={activeHeadingId}
            open={tocOpen}
            width={tocWidth}
            onOpenChange={setTocOpen}
            onWidthChange={setTocWidth}
            onNavigate={navigateToHeading}
          />
        </div>

        <footer className="flex h-8 shrink-0 items-center justify-between border-t border-white/15 bg-zinc-950 px-4 text-[11px] text-zinc-300">
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate">{folder ? `Folder: ${folder}` : 'No folder'}</span>
            <span>{headings.length} headings</span>
            <span>{tags.length} tags</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Autosave {autoSaveDelay}ms</span>
            <span>{wordCount} words</span>
            <span>{characterCount} chars</span>
          </div>
        </footer>
      </div>
    </main>
  )
}

function enhanceMarkdown(value: string): string {
  return value
    .replace(/```mermaid\n([\s\S]*?)```/g, (_match, diagram) => {
      return `<div class="mermaid-diagram"><strong>Mermaid</strong><pre>${escapeHtml(diagram)}</pre></div>`
    })
    .replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => {
      return `<div class="math-block">${escapeHtml(math.trim())}</div>`
    })
    .replace(/\[\[([^\]]+)\]\]/g, (_match, title) => {
      const safeTitle = escapeHtml(title.trim())
      return `<button type="button" class="internal-note-link" data-note-title="${encodeURIComponent(title.trim())}">${safeTitle}</button>`
    })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function decodeHtml(value: string): string {
  const element = document.createElement('textarea')
  element.innerHTML = value
  return element.value
}

function addHeadingAnchors(html: string, headings: TocHeading[], highlightedHeadingId: string | null): string {
  let headingIndex = 0

  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (match, level, innerHtml) => {
    const heading = headings[headingIndex]
    headingIndex += 1
    if (!heading) return match

    const highlightClass = heading.id === highlightedHeadingId ? ' outline-heading-highlight' : ''
    return `<h${level} id="${heading.id}" data-outline-heading="${heading.id}" class="outline-heading${highlightClass}">${innerHtml}</h${level}>`
  })
}
