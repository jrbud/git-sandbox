# Git Quest

A browser-based puzzle game that teaches Git and GitHub, one command at a time.
Each level gives you a starting repository and a goal; you reach it by typing real git
commands into an in-browser terminal while a live commit graph shows what changed.
Git is simulated entirely in the browser, so there is nothing to install and no sign-up.

> 🚧 Work in progress. Live demo link and screenshots coming soon.

## Features (planned for v1)

- Core Basics section: init, add, commit, status, log, diff, branch, checkout/switch,
  merge, clone, remote, push, pull, fetch, `.gitignore` and `git config`
- Live commit-graph and working-directory/staging-area views
- Hints, cheatsheets and a mastery system with variation levels
- Free Play sandbox
- Dark/light themes and full keyboard and screen-reader support

## Development

Requires Node.js 24+.

```sh
npm install
npm run dev        # start the dev server
npm run test       # run the test suite
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run build      # production build
```

## Tech stack

React, TypeScript, Vite, Vitest and React Testing Library. Deployed on Vercel.

## License

[MIT](LICENSE)
