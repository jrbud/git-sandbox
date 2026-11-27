import { runCommands } from '../../src/engine/dispatcher'
import { writeWorkingFile } from '../../src/engine/files'
import { createWorld } from '../../src/engine/repo'
import type { World } from '../../src/engine/types'
import type { Level } from '../../src/content/types'

function startingWorld(): World {
  const base = writeWorkingFile(
    createWorld({
      globalConfig: new Map([
        ['user.name', 'Player'],
        ['user.email', 'player@example.com'],
      ]),
    }),
    'README.md',
    '# My project\n',
  )
  const result = runCommands(base, ['git init', 'git add README.md', 'git commit -m "Add README"'])
  if (!result.ok) throw new Error(`Sample level setup failed: ${result.error.message}`)
  return result.world
}

/** A hardcoded level used to build and test the play screen before real content exists. */
export function createSampleLevel(): Level {
  return {
    id: 'sample.commit.main',
    sectionId: 'core-basics',
    conceptId: 'commit',
    kind: 'main',
    title: 'Your first commit',
    briefing:
      'A commit is a snapshot of your project at a moment in time. You choose what goes into the snapshot by staging files with git add, then save it with git commit.',
    objective: 'Create a file called notes.txt with any text in it, then commit it.',
    cheatsheet: [
      {
        command: 'echo "text" > file',
        description: 'Write text into a file',
        example: 'echo "hello" > notes.txt',
      },
      { command: 'git status', description: 'See what has changed', example: 'git status' },
      {
        command: 'git add <file>',
        description: 'Stage a file for the next commit',
        example: 'git add notes.txt',
      },
      {
        command: 'git commit -m "<message>"',
        description: 'Save the staged snapshot',
        example: 'git commit -m "Add notes"',
      },
      {
        command: 'git log',
        description: 'See the history of commits',
        example: 'git log --oneline',
      },
    ],
    allowedCommands: ['git status', 'git add', 'git commit', 'git log', 'git diff'],
    startingState: startingWorld(),
    successPredicate: {
      all: [
        { check: 'fileCommitted', path: 'notes.txt' },
        { check: 'commitCount', min: 2 },
      ],
    },
    hints: [
      'First the file has to exist. You can create it in the terminal or with the file editor.',
      'Once notes.txt exists, stage it, then commit it with a message.',
      'Run: echo "my notes" > notes.txt, then git add notes.txt, then git commit -m "Add notes"',
    ],
    successMessage:
      'You staged notes.txt and saved it in a new commit. That commit is now part of your project history, which you can see in the graph.',
  }
}
