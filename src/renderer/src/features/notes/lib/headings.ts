export interface TocHeading {
  id: string
  title: string
  level: number
  line: number
  index: number
  parentId: string | null
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/<[^>]+>/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'heading'
  )
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseHeadings(markdown: string): TocHeading[] {
  const headings: TocHeading[] = []
  const slugCounts = new Map<string, number>()
  const parentStack: TocHeading[] = []
  let inFence = false

  markdown.split(/\r?\n/).forEach((line, lineIndex) => {
    if (/^\s*```/.test(line) || /^\s*~~~/.test(line)) {
      inFence = !inFence
      return
    }

    if (inFence) return

    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) return

    const level = match[1].length
    const title = stripInlineMarkdown(match[2])
    if (!title) return

    const baseSlug = slugify(title)
    const count = slugCounts.get(baseSlug) ?? 0
    slugCounts.set(baseSlug, count + 1)
    const id = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`

    while (parentStack.length && parentStack[parentStack.length - 1].level >= level) {
      parentStack.pop()
    }

    const heading: TocHeading = {
      id,
      title,
      level,
      line: lineIndex + 1,
      index: headings.length,
      parentId: parentStack[parentStack.length - 1]?.id ?? null
    }

    headings.push(heading)
    parentStack.push(heading)
  })

  return headings
}

export function headingHasChildren(heading: TocHeading, headings: TocHeading[]): boolean {
  return headings.some((candidate) => candidate.parentId === heading.id)
}

export function visibleHeadings(headings: TocHeading[], collapsedIds: Set<string>, query: string): TocHeading[] {
  const normalizedQuery = query.trim().toLowerCase()
  const matchingIds = new Set<string>()

  if (normalizedQuery) {
    headings.forEach((heading) => {
      if (heading.title.toLowerCase().includes(normalizedQuery)) {
        matchingIds.add(heading.id)
        let parentId = heading.parentId
        while (parentId) {
          matchingIds.add(parentId)
          parentId = headings.find((candidate) => candidate.id === parentId)?.parentId ?? null
        }
      }
    })
  }

  return headings.filter((heading) => {
    if (normalizedQuery && !matchingIds.has(heading.id)) return false

    let parentId = heading.parentId
    while (parentId) {
      if (!normalizedQuery && collapsedIds.has(parentId)) return false
      parentId = headings.find((candidate) => candidate.id === parentId)?.parentId ?? null
    }

    return true
  })
}
