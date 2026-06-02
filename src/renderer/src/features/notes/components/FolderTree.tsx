import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FilePlus, Folder, FolderPlus, Plus, Trash2 } from 'lucide-react'
import { buildFolderTree, type FolderNode } from '../lib/folderTree'

interface FolderTreeProps {
  folders: string[]
  selectedFolder: string | null
  onSelect: (folder: string | null) => void
  onCreateFolder: (parentFolder: string | null, name: string) => void
  onCreateNote: (folder: string) => void
  onDeleteFolder: (folder: string) => void
  onDropNote: (folder: string, noteId: string) => void
  onDropFiles: (folder: string, files: FileList) => void
}

export function FolderTree({
  folders,
  selectedFolder,
  onSelect,
  onCreateFolder,
  onCreateNote,
  onDeleteFolder,
  onDropNote,
  onDropFiles
}: FolderTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [creatingParent, setCreatingParent] = useState<string | null | undefined>(undefined)
  const [draft, setDraft] = useState('')
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const tree = useMemo(() => buildFolderTree(folders), [folders])

  const toggle = (path: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const submitFolder = () => {
    const name = draft.trim()
    if (!name) {
      cancelFolder()
      return
    }
    onCreateFolder(creatingParent ?? null, name)
    setDraft('')
    setCreatingParent(undefined)
  }

  const cancelFolder = () => {
    setDraft('')
    setCreatingParent(undefined)
  }

  return (
    <div className="space-y-1">
      <div className="mb-2 flex items-center justify-between px-2">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-300">Folders</p>
        <div className="flex items-center gap-1">
          {selectedFolder ? (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="rounded px-1.5 py-1 text-xs text-cyan-200 hover:bg-white/10 hover:text-cyan-100"
            >
              Clear
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setCreatingParent(null)
              setDraft('')
            }}
            className="grid h-7 w-7 place-items-center rounded-md text-zinc-200 transition hover:bg-white/10 hover:text-white"
            title="Create root folder"
          >
            <FolderPlus size={15} />
          </button>
        </div>
      </div>

      {tree.length === 0 ? (
        <button
          type="button"
          onClick={() => {
            setCreatingParent(null)
            setDraft('')
          }}
          className="mx-2 flex h-9 w-[calc(100%-1rem)] items-center justify-center gap-2 rounded-lg border border-dashed border-white/25 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
        >
          <Plus size={14} />
          New folder
        </button>
      ) : null}

      {creatingParent !== undefined && creatingParent === null ? (
        <FolderCreateInput
          depth={0}
          value={draft}
          placeholder="New root folder"
          onChange={setDraft}
          onSubmit={submitFolder}
          onCancel={cancelFolder}
        />
      ) : null}

      {tree.map((node) => (
        <FolderRow
          key={node.path}
          node={node}
          depth={0}
          selectedFolder={selectedFolder}
          collapsed={collapsed}
          onToggle={toggle}
          onSelect={onSelect}
          onCreateFolder={(parentFolder) => {
            setCreatingParent(parentFolder)
            setDraft('')
          }}
          onCreateNote={onCreateNote}
          onDeleteFolder={onDeleteFolder}
          onDropNote={onDropNote}
          onDropFiles={onDropFiles}
          creatingParent={creatingParent}
          draft={draft}
          onDraftChange={setDraft}
          onSubmitFolder={submitFolder}
          onCancelFolder={cancelFolder}
          dropTarget={dropTarget}
          onDropTargetChange={setDropTarget}
        />
      ))}
    </div>
  )
}

interface FolderCreateInputProps {
  depth: number
  value: string
  placeholder: string
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}

function FolderCreateInput({ depth, value, placeholder, onChange, onSubmit, onCancel }: FolderCreateInputProps) {
  return (
    <div className="flex h-8 items-center gap-1 rounded-md pr-1" style={{ paddingLeft: 30 + depth * 14 }}>
      <input
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit()
          if (event.key === 'Escape') onCancel()
        }}
        onBlur={(event) => {
          const nextTarget = event.relatedTarget as HTMLElement | null
          if (nextTarget?.dataset.folderCreateAction) return
          if (value.trim()) onSubmit()
          else onCancel()
        }}
        placeholder={placeholder}
        className="h-7 min-w-0 flex-1 rounded-md border border-cyan-200/50 bg-black px-2 text-sm text-white outline-none placeholder:text-zinc-400"
      />
      <button
        type="button"
        data-folder-create-action="submit"
        onClick={onSubmit}
        className="h-7 rounded-md bg-cyan-300 px-2 text-xs font-medium text-black hover:bg-cyan-200"
      >
        Add
      </button>
    </div>
  )
}

interface FolderRowProps {
  node: FolderNode
  depth: number
  selectedFolder: string | null
  collapsed: Set<string>
  onToggle: (path: string) => void
  onSelect: (folder: string) => void
  onCreateFolder: (parentFolder: string) => void
  onCreateNote: (folder: string) => void
  onDeleteFolder: (folder: string) => void
  onDropNote: (folder: string, noteId: string) => void
  onDropFiles: (folder: string, files: FileList) => void
  creatingParent: string | null | undefined
  draft: string
  onDraftChange: (value: string) => void
  onSubmitFolder: () => void
  onCancelFolder: () => void
  dropTarget: string | null
  onDropTargetChange: (path: string | null) => void
}

function FolderRow({
  node,
  depth,
  selectedFolder,
  collapsed,
  onToggle,
  onSelect,
  onCreateFolder,
  onCreateNote,
  onDeleteFolder,
  onDropNote,
  onDropFiles,
  creatingParent,
  draft,
  onDraftChange,
  onSubmitFolder,
  onCancelFolder,
  dropTarget,
  onDropTargetChange
}: FolderRowProps) {
  const hasChildren = node.children.length > 0
  const isCollapsed = collapsed.has(node.path)
  const isSelected = selectedFolder === node.path
  const isDropTarget = dropTarget === node.path

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          onDropTargetChange(node.path)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            onDropTargetChange(null)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          onDropTargetChange(null)
          const noteId = event.dataTransfer.getData('application/private-notes-note-id')
          if (noteId) {
            onDropNote(node.path, noteId)
            return
          }
          if (event.dataTransfer.files.length > 0) {
            onDropFiles(node.path, event.dataTransfer.files)
          }
        }}
        className={`group flex h-8 items-center rounded-md pr-1 text-sm transition ${
          isDropTarget
            ? 'bg-cyan-300/25 text-white ring-1 ring-cyan-200 shadow-[0_0_24px_rgba(103,232,249,0.12)]'
            : isSelected
            ? 'bg-cyan-300/20 text-white ring-1 ring-cyan-300/30'
            : 'text-zinc-200 hover:bg-white/10 hover:text-white'
        }`}
        style={{ paddingLeft: 4 + depth * 14 }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.path)}
          className={`grid h-7 w-6 shrink-0 place-items-center rounded text-zinc-300 ${
            hasChildren ? 'opacity-100 hover:bg-white/10' : 'opacity-0'
          }`}
          title={isCollapsed ? 'Expand folder' : 'Collapse folder'}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.path)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          title={node.path}
        >
          <Folder size={14} className="shrink-0 text-cyan-100" />
          <span className="truncate">{node.name}</span>
          {isDropTarget ? <span className="ml-auto text-[10px] text-cyan-50">Drop here</span> : null}
        </button>
        <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onCreateNote(node.path)}
            className="grid h-7 w-7 place-items-center rounded text-zinc-200 hover:bg-white/10 hover:text-white"
            title="Create note in folder"
          >
            <FilePlus size={13} />
          </button>
          <button
            type="button"
            onClick={() => onCreateFolder(node.path)}
            className="grid h-7 w-7 place-items-center rounded text-zinc-200 hover:bg-white/10 hover:text-white"
            title="Create child folder"
          >
            <FolderPlus size={13} />
          </button>
          <button
            type="button"
            onClick={() => onDeleteFolder(node.path)}
            className="grid h-7 w-7 place-items-center rounded text-zinc-200 hover:bg-red-500/20 hover:text-red-100"
            title="Delete folder"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {creatingParent === node.path ? (
        <FolderCreateInput
          depth={depth + 1}
          value={draft}
          placeholder={`New folder in ${node.name}`}
          onChange={onDraftChange}
          onSubmit={onSubmitFolder}
          onCancel={onCancelFolder}
        />
      ) : null}

      {!isCollapsed
        ? node.children.map((child) => (
            <FolderRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFolder={selectedFolder}
              collapsed={collapsed}
              onToggle={onToggle}
              onSelect={onSelect}
              onCreateFolder={onCreateFolder}
              onCreateNote={onCreateNote}
              onDeleteFolder={onDeleteFolder}
              onDropNote={onDropNote}
              onDropFiles={onDropFiles}
              creatingParent={creatingParent}
              draft={draft}
              onDraftChange={onDraftChange}
              onSubmitFolder={onSubmitFolder}
              onCancelFolder={onCancelFolder}
              dropTarget={dropTarget}
              onDropTargetChange={onDropTargetChange}
            />
          ))
        : null}
    </div>
  )
}
