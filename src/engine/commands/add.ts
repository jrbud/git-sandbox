import type { CommandDefinition } from '../command'
import { GitError } from '../errors'
import { normalizePath } from '../files'
import { isIgnored, loadIgnoreRules } from '../ignore'

/** Whether a pathspec ("a.txt", "src", ".", "*.md") selects a path. */
export function pathspecMatches(spec: string, path: string): boolean {
  const s = normalizePath(spec)
  if (s === '') return true
  if (path === s || path.startsWith(`${s}/`)) return true
  if (/[*?[]/.test(s)) {
    const source = s
      .split('')
      .map((c) => (c === '*' ? '.*' : c === '?' ? '.' : c.replace(/[.+^${}()|\]\\/]/g, '\\$&')))
      .join('')
    return new RegExp(`^${source}$`).test(path)
  }
  return false
}

function ignoredError(paths: string[]): GitError {
  return new GitError(
    [
      'The following paths are ignored by one of your .gitignore files:',
      ...paths,
      'hint: Use -f if you really want to add them.',
    ].join('\n'),
    'Your .gitignore tells git to leave these files alone, so git add skips them. Use git add -f only if you really mean to track them.',
  )
}

export const addCommand: CommandDefinition = {
  name: 'add',
  summary: 'Stage file contents for the next commit',
  flags: {
    '-A': { aliases: ['--all'] },
    '-f': { aliases: ['--force'] },
  },
  requiresRepo: true,
  run(world, args) {
    const repo = world.repo
    const force = args.has('-f')
    const specs = args.positionals.length > 0 ? args.positionals : args.has('-A') ? ['.'] : []
    if (specs.length === 0) {
      throw new GitError(
        "Nothing specified, nothing added.\nhint: Maybe you wanted to say 'git add .'?",
        "git add needs to know which files to stage. Name a file, or use 'git add .' for everything.",
        'usage',
      )
    }

    const rules = loadIgnoreRules(repo.workingDirectory)
    const candidates = [
      ...new Set([...repo.workingDirectory.keys(), ...repo.stagingArea.keys()]),
    ].sort()
    const toStage = new Set<string>()
    const ignored: string[] = []

    for (const spec of specs) {
      const matched = candidates.filter((path) => pathspecMatches(spec, path))
      if (matched.length === 0) {
        throw new GitError(
          `fatal: pathspec '${spec}' did not match any files`,
          `There's no file called '${spec}' here. Check the name with git status.`,
        )
      }
      const blocked = matched.filter(
        (path) => !force && !repo.stagingArea.has(path) && isIgnored(path, rules),
      )
      const allowed = matched.filter((path) => !blocked.includes(path))
      // A pathspec that only selects ignored files is an error; broader ones skip them quietly.
      if (allowed.length === 0) ignored.push(...blocked)
      allowed.forEach((path) => toStage.add(path))
    }
    if (ignored.length > 0) throw ignoredError([...new Set(ignored)])

    for (const path of toStage) {
      const content = repo.workingDirectory.get(path)
      if (content === undefined) repo.stagingArea.delete(path)
      else repo.stagingArea.set(path, content)
    }
    return ''
  },
}
