import type { FileMap } from './types'

/** One compiled line from a .gitignore file. */
export interface IgnoreRule {
  /** Directory the .gitignore lives in ("" for the repository root, else "dir/"). */
  base: string
  regex: RegExp
  negate: boolean
  directoryOnly: boolean
  source: string
}

function globToRegex(glob: string): string {
  let out = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const before = i === 0 || glob[i - 1] === '/'
        const after = glob[i + 2] === undefined || glob[i + 2] === '/'
        if (before && after) {
          // "**/" matches zero or more directories; a trailing "/**" matches everything inside.
          if (glob[i + 2] === '/') {
            out += '(?:.*/)?'
            i += 2
          } else {
            out += '.*'
            i += 1
          }
          continue
        }
      }
      out += '[^/]*'
    } else if (c === '?') {
      out += '[^/]'
    } else if (c === '[') {
      const close = glob.indexOf(']', i + 2)
      if (close === -1) {
        out += '\\['
      } else {
        let set = glob.slice(i + 1, close)
        if (set.startsWith('!')) set = `^${set.slice(1)}`
        out += `[${set.replace(/\\/g, '\\\\')}]`
        i = close
      }
    } else if (c === '\\' && i + 1 < glob.length) {
      out += glob[++i].replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
    } else {
      out += c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
    }
  }
  return out
}

export function parseIgnoreFile(content: string, base = ''): IgnoreRule[] {
  const rules: IgnoreRule[] = []
  for (const rawLine of content.split('\n')) {
    let line = rawLine.replace(/\r$/, '').replace(/(?<!\\)\s+$/, '')
    if (line === '' || line.startsWith('#')) continue
    let negate = false
    if (line.startsWith('!')) {
      negate = true
      line = line.slice(1)
    } else if (line.startsWith('\\#') || line.startsWith('\\!')) {
      line = line.slice(1)
    }
    let directoryOnly = false
    if (line.endsWith('/')) {
      directoryOnly = true
      line = line.replace(/\/+$/, '')
    }
    if (line === '') continue
    const anchored = line.includes('/')
    line = line.replace(/^\//, '')
    const body = globToRegex(line)
    const regex = new RegExp(anchored ? `^${body}$` : `^(?:.*/)?${body}$`)
    rules.push({ base, regex, negate, directoryOnly, source: rawLine })
  }
  return rules
}

/** All rules from every .gitignore in the working directory, shallowest first. */
export function loadIgnoreRules(workingDirectory: FileMap): IgnoreRule[] {
  const ignoreFiles = [...workingDirectory.keys()]
    .filter((path) => path === '.gitignore' || path.endsWith('/.gitignore'))
    .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
  return ignoreFiles.flatMap((path) =>
    parseIgnoreFile(workingDirectory.get(path) ?? '', path.slice(0, -'.gitignore'.length)),
  )
}

function matches(rules: IgnoreRule[], path: string, isDirectory: boolean): boolean | undefined {
  let result: boolean | undefined
  for (const rule of rules) {
    if (!path.startsWith(rule.base)) continue
    if (rule.directoryOnly && !isDirectory) continue
    if (rule.regex.test(path.slice(rule.base.length))) result = !rule.negate
  }
  return result
}

/**
 * Whether a file path is ignored. As in real git, once a directory is ignored nothing
 * inside it can be re-included by a later `!pattern`.
 */
export function isIgnored(path: string, rules: IgnoreRule[]): boolean {
  if (rules.length === 0) return false
  const parts = path.split('/')
  for (let depth = 1; depth < parts.length; depth++) {
    if (matches(rules, parts.slice(0, depth).join('/'), true)) return true
  }
  return matches(rules, path, false) ?? false
}

export function isPathIgnored(workingDirectory: FileMap, path: string): boolean {
  return isIgnored(path, loadIgnoreRules(workingDirectory))
}
