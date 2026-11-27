import { describe, expect, it } from 'vitest'
import { GitError } from '../../src/engine/errors'
import { parseCommand, tokenize } from '../../src/engine/parser'

function parseError(input: string): GitError {
  try {
    parseCommand(input)
  } catch (error) {
    if (error instanceof GitError) return error
    throw error
  }
  throw new Error(`Expected "${input}" to fail to parse`)
}

// Step 17: the command-string parser.
describe('parseCommand', () => {
  it.each([
    ['git status', 'status', []],
    ['git init', 'init', []],
    ['  git   add   a.txt  b.txt ', 'add', ['a.txt', 'b.txt']],
    ['git commit -m "First commit"', 'commit', ['-m', 'First commit']],
    ["git commit -m 'It''s here'", 'commit', ['-m', 'Its here']],
    ['git commit -m "Say \\"hi\\""', 'commit', ['-m', 'Say "hi"']],
    ['git config user.name "Sam Lee"', 'config', ['user.name', 'Sam Lee']],
    ['git checkout -b feature/login', 'checkout', ['-b', 'feature/login']],
    ['git log --oneline -n 3', 'log', ['--oneline', '-n', '3']],
    ['git commit -m ""', 'commit', ['-m', '']],
    ['git add my\\ file.txt', 'add', ['my file.txt']],
  ])('parses %s', (input, verb, args) => {
    expect(parseCommand(input)).toEqual({ program: 'git', verb, args, raw: input })
  })

  it('rejects an unterminated quote', () => {
    const error = parseError('git commit -m "oops')
    expect(error.kind).toBe('parse')
    expect(error.message).toBe('bash: unexpected EOF while looking for matching `"\'')
  })

  it('rejects commands that are not git', () => {
    const error = parseError('ls -la')
    expect(error.kind).toBe('parse')
    expect(error.message).toBe('ls: command not found')
    expect(error.explanation).toMatch(/git/)
  })

  it('rejects "git" on its own and empty input', () => {
    expect(parseError('git').message).toBe('usage: git <command> [<args>]')
    expect(parseError('   ').kind).toBe('parse')
  })
})

describe('tokenize', () => {
  it('keeps quoted spaces and joins adjacent quoted parts', () => {
    expect(tokenize(`a "b c" d'e f'g`)).toEqual(['a', 'b c', 'de fg'])
  })
})
