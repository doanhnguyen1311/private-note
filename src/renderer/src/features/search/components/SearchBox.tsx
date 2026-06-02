import { Search } from 'lucide-react'
import { useNotesStore } from '../../../store/useNotesStore'

interface SearchBoxProps {
  id: string
}

export function SearchBox({ id }: SearchBoxProps) {
  const searchQuery = useNotesStore((state) => state.searchQuery)
  const setSearchQuery = useNotesStore((state) => state.setSearchQuery)

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-300" />
      <input
        id={id}
        type="text"
        value={searchQuery}
        onChange={(event) => void setSearchQuery(event.target.value)}
        placeholder="Search notes, tags, content"
        className="h-10 w-full rounded-lg border border-white/25 bg-zinc-950 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-zinc-400 focus:border-cyan-200 focus:bg-black focus:ring-2 focus:ring-cyan-300/25"
      />
    </div>
  )
}
