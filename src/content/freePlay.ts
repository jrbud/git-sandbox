import { buildWorld } from './snapshot'

export const PLAYGROUND_URL = 'https://example.com/playground/demo.git'

/** Free Play starts in an empty folder, next to a small practice remote for clone/push/pull. */
export function createFreePlayWorld() {
  return buildWorld({
    servers: [PLAYGROUND_URL],
    setup: [
      {
        workspace: 'teammate',
        commands: [
          'git init',
          'echo "# Demo project" > README.md',
          'echo "console.log(\'hello\')" > app.js',
          'git add .',
          'git commit -m "Start the demo project"',
          `git remote add origin ${PLAYGROUND_URL}`,
          'git push -u origin main',
        ],
      },
    ],
  })
}
