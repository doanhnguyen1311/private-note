interface TagPillProps {
  label: string
  active?: boolean
  onClick?: () => void
  onRemove?: () => void
}

export function TagPill({ label, active = false, onClick, onRemove }: TagPillProps) {
  return (
    <span
      className={`inline-flex h-7 max-w-full items-center gap-1 rounded-md border px-2 text-xs ${
        active
          ? 'border-cyan-200 bg-cyan-300/20 text-white'
          : 'border-white/25 bg-white/10 text-zinc-100'
      }`}
    >
      <button type="button" onClick={onClick} className="truncate outline-none" title={label}>
        {label}
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded px-1 text-zinc-300 transition hover:bg-white/20 hover:text-white"
          title={`Remove ${label}`}
        >
          x
        </button>
      ) : null}
    </span>
  )
}
