import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight, PanelRightClose, PanelRightOpen, Search } from 'lucide-react'
import { headingHasChildren, type TocHeading, visibleHeadings } from '../lib/headings'

interface TableOfContentsProps {
  headings: TocHeading[]
  activeHeadingId: string | null
  open: boolean
  width: number
  onOpenChange: (open: boolean) => void
  onWidthChange: (width: number) => void
  onNavigate: (heading: TocHeading) => void
}

export function TableOfContents({
  headings,
  activeHeadingId,
  open,
  width,
  onOpenChange,
  onWidthChange,
  onNavigate
}: TableOfContentsProps) {
  const [query, setQuery] = useState('')
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const resizingRef = useRef(false)

  useEffect(() => {
    if (!activeHeadingId) return
    setCollapsedIds((current) => {
      const next = new Set(current)
      let parentId = headings.find((heading) => heading.id === activeHeadingId)?.parentId ?? null
      while (parentId) {
        next.delete(parentId)
        parentId = headings.find((heading) => heading.id === parentId)?.parentId ?? null
      }
      return next
    })
  }, [activeHeadingId, headings])

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!resizingRef.current) return
      const nextWidth = Math.min(420, Math.max(220, window.innerWidth - event.clientX))
      onWidthChange(nextWidth)
    }

    const onMouseUp = () => {
      resizingRef.current = false
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onWidthChange])

  const displayedHeadings = useMemo(
    () => visibleHeadings(headings, collapsedIds, query),
    [collapsedIds, headings, query]
  )

  const activeIndex = displayedHeadings.findIndex((heading) => heading.id === (focusedId ?? activeHeadingId))

  const navigateByKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!displayedHeadings.length) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = displayedHeadings[Math.min(displayedHeadings.length - 1, Math.max(0, activeIndex) + 1)]
      setFocusedId(next.id)
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const next = displayedHeadings[Math.max(0, activeIndex - 1)]
      setFocusedId(next.id)
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const heading = displayedHeadings.find((candidate) => candidate.id === focusedId) ?? displayedHeadings[activeIndex]
      if (heading) onNavigate(heading)
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      onOpenChange(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="absolute bottom-5 right-5 z-10 flex h-10 items-center gap-2 rounded-lg border border-cyan-200/50 bg-black px-3 text-sm text-cyan-50 shadow-2xl transition hover:bg-cyan-300/20"
        title="Open outline"
      >
        <BookOpen size={16} />
        Outline
      </button>
    )
  }

  return (
    <aside
      className="relative hidden h-full shrink-0 border-l border-white/20 bg-zinc-950/95 lg:flex lg:flex-col"
      style={{ width }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={() => {
          resizingRef.current = true
        }}
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize transition hover:bg-cyan-300/60"
      />
      <div className="sticky top-0 z-10 border-b border-white/20 bg-zinc-950 p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <BookOpen size={16} className="text-cyan-100" />
            Outline
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-200 transition hover:bg-white/10 hover:text-white"
            title="Collapse outline"
          >
            <PanelRightClose size={16} />
          </button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-300" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search headings"
            className="h-9 w-full rounded-lg border border-white/25 bg-black pl-8 pr-2 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-cyan-200"
          />
        </div>
      </div>

      <div
        tabIndex={0}
        onKeyDown={navigateByKeyboard}
        className="min-h-0 flex-1 overflow-y-auto px-2 py-3 outline-none"
      >
        {headings.length === 0 ? (
          <div className="rounded-lg border border-white/15 bg-black/50 px-3 py-4 text-sm text-zinc-300">
            Add Markdown headings to build an outline.
          </div>
        ) : null}

        {displayedHeadings.map((heading) => {
          const hasChildren = headingHasChildren(heading, headings)
          const collapsed = collapsedIds.has(heading.id)
          const active = heading.id === activeHeadingId
          const focused = heading.id === focusedId

          return (
            <div key={heading.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (!hasChildren) return
                  setCollapsedIds((current) => {
                    const next = new Set(current)
                    if (next.has(heading.id)) next.delete(heading.id)
                    else next.add(heading.id)
                    return next
                  })
                }}
                className={`grid h-7 w-6 shrink-0 place-items-center rounded text-zinc-300 transition hover:bg-white/10 ${
                  hasChildren ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ marginLeft: Math.max(0, heading.level - 1) * 12 }}
                title={collapsed ? 'Expand section' : 'Collapse section'}
              >
                {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFocusedId(heading.id)
                  onNavigate(heading)
                }}
                className={`min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm transition ${
                  active
                    ? 'bg-cyan-300/20 text-white ring-1 ring-cyan-200/40'
                    : focused
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-200 hover:bg-white/10 hover:text-white'
                }`}
                title={`${heading.title} · line ${heading.line}`}
              >
                <span className="block truncate">{heading.title}</span>
              </button>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-lg border border-white/20 bg-black text-zinc-200 shadow-xl transition hover:bg-white/10"
        title="Collapse outline"
      >
        <PanelRightOpen size={15} />
      </button>
    </aside>
  )
}
