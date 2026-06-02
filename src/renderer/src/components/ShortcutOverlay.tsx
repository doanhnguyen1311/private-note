import { Command, Keyboard, X } from 'lucide-react'

interface ShortcutOverlayProps {
  open: boolean
  onClose: () => void
}

const shortcutGroups = [
  {
    title: 'Navigate',
    items: [
      ['Ctrl K', 'Command palette'],
      ['Ctrl F', 'Focus global search'],
      ['Ctrl G', 'Open graph tree'],
      ['Ctrl /', 'Keyboard shortcuts'],
      ['Esc', 'Close overlays']
    ]
  },
  {
    title: 'Notes',
    items: [
      ['Ctrl N', 'Create note'],
      ['Ctrl S', 'Save now'],
      ['Ctrl D', 'Duplicate note'],
      ['Delete', 'Move note to trash']
    ]
  },
  {
    title: 'Knowledge Base',
    items: [
      ['Drag note', 'Move note into folder'],
      ['Drop file', 'Import file into folder'],
      ['Right click', 'Open note context menu'],
      ['Enter', 'Open focused outline heading']
    ]
  }
]

export function ShortcutOverlay({ open, onClose }: ShortcutOverlayProps) {
  if (!open) return null

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-6 backdrop-blur-md">
      <section className="animate-scale-in w-[720px] max-w-full overflow-hidden rounded-2xl border border-white/20 bg-zinc-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/15 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/20 text-cyan-50">
              <Keyboard size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Keyboard Shortcuts</h2>
              <p className="text-sm text-zinc-300">Fast workflows for a personal knowledge base.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-zinc-200 transition hover:bg-white/10 hover:text-white"
            title="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid gap-4 p-5 md:grid-cols-3">
          {shortcutGroups.map((group) => (
            <div key={group.title} className="rounded-xl border border-white/15 bg-black/60 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-cyan-50">
                <Command size={15} />
                {group.title}
              </div>
              <div className="space-y-2">
                {group.items.map(([keys, label]) => (
                  <div key={keys} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-zinc-200">{label}</span>
                    <kbd className="shrink-0 rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs text-white">
                      {keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
