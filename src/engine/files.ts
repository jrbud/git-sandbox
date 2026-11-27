import type { FileMap, World } from './types'

/** "./src//a.txt/" -> "src/a.txt". The repository root is "". */
export function normalizePath(path: string): string {
  let p = path.replace(/\\/g, '/').replace(/\/{2,}/g, '/')
  while (p.startsWith('./')) p = p.slice(2)
  p = p.replace(/^\/+/, '').replace(/\/+$/, '')
  return p === '.' ? '' : p
}

export function sortedPaths(files: FileMap): string[] {
  return [...files.keys()].sort()
}

export function setFile(files: FileMap, path: string, content: string): FileMap {
  const next = new Map(files)
  next.set(normalizePath(path), content)
  return next
}

export function deleteFile(files: FileMap, path: string): FileMap {
  const next = new Map(files)
  next.delete(normalizePath(path))
  return next
}

export function fileMapsEqual(a: FileMap, b: FileMap): boolean {
  if (a.size !== b.size) return false
  for (const [path, content] of a) {
    if (b.get(path) !== content) return false
  }
  return true
}

export function fileMapFromObject(files: Record<string, string>): FileMap {
  return new Map(Object.entries(files).map(([path, content]) => [normalizePath(path), content]))
}

/** Create or overwrite a file in the player's working directory. */
export function writeWorkingFile(world: World, path: string, content: string): World {
  return {
    ...world,
    repo: { ...world.repo, workingDirectory: setFile(world.repo.workingDirectory, path, content) },
  }
}

/** Remove a file from the player's working directory. */
export function removeWorkingFile(world: World, path: string): World {
  return {
    ...world,
    repo: { ...world.repo, workingDirectory: deleteFile(world.repo.workingDirectory, path) },
  }
}

export function readWorkingFile(world: World, path: string): string | undefined {
  return world.repo.workingDirectory.get(normalizePath(path))
}
