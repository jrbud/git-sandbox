import { evaluatePredicate, validatePredicate, type Predicate } from '../engine/predicates'
import { commandRegistry } from '../engine/registry'
import { buildWorld, type RepoSnapshot } from './snapshot'
import type {
  CheatsheetEntry,
  Concept,
  ContentCatalog,
  Level,
  Section,
  SectionUnlock,
} from './types'

/** Raised when content files are malformed. Lists every problem found, with file and field. */
export class ContentError extends Error {
  readonly problems: string[]

  constructor(problems: string[]) {
    super(`Invalid game content:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
    this.name = 'ContentError'
    this.problems = problems
  }
}

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isString = (value: unknown): value is string => typeof value === 'string' && value !== ''
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

function requireStrings(obj: Json, fields: string[], where: string, problems: string[]): void {
  for (const field of fields) {
    if (!isString(obj[field])) problems.push(`${where}: "${field}" must be a non-empty string`)
  }
}

function parseSections(raw: unknown, problems: string[]): Section[] {
  if (!isObject(raw) || !Array.isArray(raw.sections)) {
    problems.push('sections.json: must be an object with a "sections" array')
    return []
  }
  const sections: Section[] = []
  raw.sections.forEach((value, i) => {
    const where = `sections.json: sections[${i}]`
    if (!isObject(value)) {
      problems.push(`${where} must be an object`)
      return
    }
    requireStrings(value, ['id', 'title', 'description'], where, problems)
    if (!isStringArray(value.concepts) || value.concepts.length === 0) {
      problems.push(`${where}: "concepts" must be a non-empty array of concept ids`)
    }
    let unlock: SectionUnlock = { type: 'none' }
    const u = value.unlock
    if (isObject(u) && u.type === 'section-complete' && isString(u.sectionId)) {
      if (!sections.some((s) => s.id === u.sectionId)) {
        problems.push(`${where}: unlock.sectionId "${u.sectionId}" must name an earlier section`)
      }
      unlock = { type: 'section-complete', sectionId: u.sectionId }
    } else if (!(isObject(u) && u.type === 'none')) {
      problems.push(
        `${where}: "unlock" must be {"type":"none"} or {"type":"section-complete","sectionId":"..."}`,
      )
    }
    if (sections.some((s) => s.id === value.id))
      problems.push(`${where}: duplicate section id "${value.id}"`)
    sections.push({
      id: String(value.id),
      title: String(value.title),
      description: String(value.description),
      conceptIds: isStringArray(value.concepts) ? value.concepts : [],
      unlock,
    })
  })
  return sections
}

function checkAllowedCommands(value: unknown, where: string, problems: string[]): string[] {
  if (!isStringArray(value) || value.length === 0) {
    problems.push(`${where}: "allowedCommands" must be a non-empty array of strings`)
    return []
  }
  for (const entry of value) {
    const [program, verb] = entry.trim().split(/\s+/)
    if (program !== 'git' || !verb || !commandRegistry.has(verb)) {
      problems.push(
        `${where}: allowedCommands entry "${entry}" must be "git <supported command> ..."`,
      )
    }
  }
  return value
}

function checkCheatsheet(value: unknown, where: string, problems: string[]): CheatsheetEntry[] {
  if (value === undefined) return []
  if (
    !Array.isArray(value) ||
    !value.every(
      (e) => isObject(e) && isString(e.command) && isString(e.description) && isString(e.example),
    )
  ) {
    problems.push(`${where}: "cheatsheet" must be an array of {command, description, example}`)
    return []
  }
  return value as CheatsheetEntry[]
}

function parseLevel(
  raw: unknown,
  file: string,
  index: number,
  sectionId: string,
  conceptId: string,
  problems: string[],
): Level | undefined {
  const where = `${file}: levels[${index}]`
  if (!isObject(raw)) {
    problems.push(`${where} must be an object`)
    return undefined
  }
  const at = isString(raw.id) ? `${file}: level "${raw.id}"` : where
  const before = problems.length
  requireStrings(raw, ['id', 'title', 'objective'], at, problems)
  if (raw.kind !== 'main' && raw.kind !== 'variation')
    problems.push(`${at}: "kind" must be "main" or "variation"`)
  const allowedCommands = checkAllowedCommands(raw.allowedCommands, at, problems)
  const cheatsheet = checkCheatsheet(raw.cheatsheet, at, problems)
  if (raw.kind === 'main') {
    requireStrings(raw, ['briefing'], at, problems)
    if (cheatsheet.length === 0) problems.push(`${at}: main levels need a non-empty "cheatsheet"`)
  } else if (cheatsheet.length > 0) {
    problems.push(`${at}: variation levels must not have a cheatsheet`)
  }
  if (!isStringArray(raw.hints) || raw.hints.length === 0)
    problems.push(`${at}: "hints" must be a non-empty array of strings`)
  if (raw.successMessage !== undefined && !isString(raw.successMessage))
    problems.push(`${at}: "successMessage" must be a string`)
  problems.push(...validatePredicate(raw.successPredicate).map((p) => `${at}: ${p}`))
  if (raw.startingState !== undefined && !isObject(raw.startingState))
    problems.push(`${at}: "startingState" must be an object`)
  if (problems.length > before) return undefined

  let startingState
  try {
    startingState = buildWorld(raw.startingState as RepoSnapshot | undefined)
  } catch (error) {
    problems.push(`${at}: startingState could not be built: ${(error as Error).message}`)
    return undefined
  }
  const successPredicate = raw.successPredicate as Predicate
  if (evaluatePredicate(startingState, successPredicate)) {
    problems.push(`${at}: the objective is already met by the starting state`)
  }
  return {
    id: raw.id as string,
    sectionId,
    conceptId,
    kind: raw.kind as Level['kind'],
    title: raw.title as string,
    briefing: (raw.briefing as string | undefined) ?? '',
    objective: raw.objective as string,
    cheatsheet,
    allowedCommands,
    startingState,
    successPredicate,
    hints: raw.hints as string[],
    successMessage: raw.successMessage as string | undefined,
  }
}

function parseConcept(file: string, raw: unknown, problems: string[]): Concept | undefined {
  const match = /(?:^|\/)levels\/([^/]+)\/([^/]+)\.json$/.exec(file)
  if (!match) {
    problems.push(`${file}: level files must live at levels/<sectionId>/<conceptId>.json`)
    return undefined
  }
  const [, sectionId, conceptId] = match
  const where = `levels/${sectionId}/${conceptId}.json`
  if (!isObject(raw)) {
    problems.push(`${where}: must be an object`)
    return undefined
  }
  if (raw.conceptId !== conceptId)
    problems.push(`${where}: "conceptId" must be "${conceptId}" to match the file name`)
  if (raw.sectionId !== sectionId)
    problems.push(`${where}: "sectionId" must be "${sectionId}" to match the folder`)
  requireStrings(raw, ['title'], where, problems)
  if (!Array.isArray(raw.levels) || raw.levels.length === 0) {
    problems.push(`${where}: "levels" must be a non-empty array`)
    return undefined
  }
  const levels = raw.levels
    .map((level, i) => parseLevel(level, where, i, sectionId, conceptId, problems))
    .filter((level): level is Level => level !== undefined)
  const kinds = raw.levels.map((level) => (isObject(level) ? level.kind : undefined))
  if (kinds[0] !== 'main' || kinds.filter((k) => k === 'main').length !== 1) {
    problems.push(
      `${where}: the first level must be the only "main" level; the rest are variations`,
    )
  }
  return { id: conceptId, sectionId, title: String(raw.title), levels }
}

/**
 * Build the content catalog from sections.json and the per-concept level files (keyed by file
 * path, e.g. "./levels/core-basics/commit.json"). Throws ContentError listing every problem.
 */
export function loadContent(
  sectionsJson: unknown,
  conceptFiles: Record<string, unknown>,
): ContentCatalog {
  const problems: string[] = []
  const sections = parseSections(sectionsJson, problems)
  const concepts = new Map<string, Concept>()
  const levels = new Map<string, Level>()

  for (const [file, raw] of Object.entries(conceptFiles).sort(([a], [b]) => a.localeCompare(b))) {
    const concept = parseConcept(file, raw, problems)
    if (!concept) continue
    const where = `levels/${concept.sectionId}/${concept.id}.json`
    if (concepts.has(concept.id))
      problems.push(`${where}: concept id "${concept.id}" is used twice`)
    concepts.set(concept.id, concept)
    for (const level of concept.levels) {
      if (levels.has(level.id)) problems.push(`${where}: level id "${level.id}" is used twice`)
      levels.set(level.id, level)
    }
  }

  const listed = new Set<string>()
  for (const section of sections) {
    for (const id of section.conceptIds) {
      const concept = concepts.get(id)
      if (!concept)
        problems.push(
          `sections.json: section "${section.id}" lists concept "${id}", but levels/${section.id}/${id}.json does not exist`,
        )
      else if (concept.sectionId !== section.id)
        problems.push(
          `sections.json: concept "${id}" lives in section "${concept.sectionId}", not "${section.id}"`,
        )
      if (listed.has(id)) problems.push(`sections.json: concept "${id}" is listed twice`)
      listed.add(id)
    }
  }
  for (const id of concepts.keys()) {
    if (!listed.has(id))
      problems.push(
        `levels/${concepts.get(id)!.sectionId}/${id}.json: concept "${id}" is not listed in sections.json`,
      )
  }

  if (problems.length > 0) throw new ContentError(problems)
  return { sections, concepts, levels }
}
