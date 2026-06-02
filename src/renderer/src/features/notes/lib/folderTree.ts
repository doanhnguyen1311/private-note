export interface FolderNode {
  name: string
  path: string
  children: FolderNode[]
}

export function buildFolderTree(paths: string[]): FolderNode[] {
  const root: FolderNode[] = []
  const nodeByPath = new Map<string, FolderNode>()

  paths.forEach((path) => {
    const parts = path.split('/').map((part) => part.trim()).filter(Boolean)
    let parent: FolderNode | null = null
    let currentPath = ''

    parts.forEach((part) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part
      let node = nodeByPath.get(currentPath)
      if (!node) {
        node = { name: part, path: currentPath, children: [] }
        nodeByPath.set(currentPath, node)
        if (parent) {
          parent.children.push(node)
        } else {
          root.push(node)
        }
      }
      parent = node
    })
  })

  const sortNodes = (nodes: FolderNode[]): FolderNode[] =>
    nodes
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((node) => ({ ...node, children: sortNodes(node.children) }))

  return sortNodes(root)
}
