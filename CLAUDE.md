# Git Quest — Project Spec for Claude Code

Nov 26, 2026 · @Jeremy

Git Quest is a browser-based, puzzle-style game that teaches Git and GitHub concepts through short levels, each built around one command or idea. It targets general beginners, simulates git entirely in-browser (no real repos on a server), and is architected from day one to scale from core basics into collaboration and advanced sections.&#32;

## 1. Overview & Goals

**What it is.** A browser-based, puzzle-style learning game called *Git Quest*. Each level is a small, self-contained puzzle: the player is given a starting repository state and a goal, and must reach that goal using a constrained set of git commands typed into an in-browser terminal-like input.

**Primary goal.** Teach the practical mental model of git and GitHub — not just command syntax, but *what is actually happening* to the commit graph, the working directory, the staging area, and remotes when a command runs.

**Design priorities, in order:**

1. Correctness of the git mental model (the simulation must behave the way real git behaves for the commands it supports).
2. Clarity of feedback (the player should always be able to see *why* a command did what it did).
3. Low friction to start (no sign-up, no install, playable immediately in a browser).
4. Long-term scalability of content (new levels and whole new sections should be easy to add without touching the engine).

**Explicit non-goals for v1:**

- Not a replacement for real git practice — it's a conceptual on-ramp before using real git.
- Not shelling out to real git or a real backend repository (see Section 5).
- Not multiplayer or account-based in the MVP (no login, no server-side save by default — see Section 9 for what persistence looks like).
- Not trying to cover every git subcommand or flag — scope is curated per section (see Section 4).

## 2. Target Audience & Learning Objectives

**Audience.** General beginners — anyone new to git/GitHub, with no assumed course or classroom context. Assume the player knows how to use a computer and a terminal-ish text input, but has never run `git init` before.

**By the end of the Core Basics section, the player should be able to:**

- Explain what a commit is and why the commit graph looks the way it does.
- Use `git init`, `git add`, `git commit`, `git status`, `git log`, `git diff` confidently.
- Create and switch branches (`git branch`, `git checkout`/`git switch`) and understand what HEAD means.
- Merge one branch into another and understand fast-forward vs. a merge commit.
- Clone a remote, and `push`/`pull`/`fetch` to and from it.
- Write a `.gitignore` and explain what it does.
- Set their identity with `git config` (user.name / user.email) and explain why commits record an author.

**By the end of the Collaboration section, the player should additionally be able to:**

- Explain and resolve a merge conflict by hand.
- Fork a repo and open a pull request.
- Describe a typical code-review flow (branch → PR → review → merge).

**By the end of the Advanced section, the player should additionally be able to:**

- Explain the difference between `reset` and `revert`, and when to use each.
- Use interactive rebase, cherry-pick, stash, and tags.

Each level should map to exactly one objective above, so coverage gaps are easy to spot as content grows.

## 3. Core Concept & Game Loop

**Per-level loop:**

1. **Briefing.** A short panel states the concept in plain language ("A commit is a snapshot...") and the level's objective ("Make 2 commits, then create a branch called `feature`").
2. **Starting state.** The level loads a predefined repo state: working directory files, staging area contents, commit graph, branches, and (if relevant) a simulated remote.
3. **Play.** The player types git commands into a terminal-style input. Only the commands/flags whitelisted for that level are accepted; anything else is explained ("not available in this level") rather than silently failing.
4. **Live visualization.** A commit graph view and a working-directory/staging-area view update after every command, so the player sees cause and effect immediately (see Section 7).
5. **Objective check.** After each command, the engine checks the objective predicate against the simulated repo state. On success: a short explanation of *why* it worked, then "Next Level."
6. **Hints.** A hint system reveals increasingly specific nudges (concept reminder → which command family → the exact command) if the player is stuck, without being required reading.

**Progression.** Levels are grouped into Sections (Section 4); Sections are grouped into the overall game. A level unlocks the next; a completed Section unlocks the next Section. Completing a level should take most players 1–5 minutes.

**Tone.** Approachable and encouraging, not punitive — there is no "game over"; a wrong command just doesn't satisfy the objective, and the player can keep trying or ask for a hint.

## 4. Content Architecture: Sections, Levels & Scalability

This is the most important constraint for Claude Code: **build the MVP with only Core Basics content, but build the engine so that adding Collaboration and Advanced later is a content change, not a code change.**

**Section hierarchy:**

- **Section** → a themed group of levels (e.g. "Core Basics", "Collaboration", "Advanced").
- **Level** → one puzzle within a section, defined entirely by a data file (see Section 6), not hardcoded logic.

**Planned sections (only Section A is in MVP scope — see Section 9):**

| Section | Concepts covered |
| --- | --- |
| A. Core Basics | init, add, commit, status, log, diff, branch, checkout/switch, merge (fast-forward + 3-way), clone, remote, push, pull, fetch, .gitignore |
| B. Collaboration | fork, pull requests, merge conflicts, code review flow, upstream/origin |
| C. Advanced | reset vs. revert, interactive rebase, cherry-pick, stash, tags, bisect |

**Scalability requirements for Claude Code:**

- A new level = a new entry in a level-data file (or new JSON file), with no engine code changes, as long as it only uses already-supported git commands.
- A new git command = one addition to the command-handler registry (Section 5) plus updated whitelist options — isolated from level content.
- A new Section = a new folder/namespace of level files plus one entry in a sections manifest (id, title, description, icon, ordered level list, unlock requirement). The level-select UI should render sections and locks from this manifest, not from hardcoded UI.
- Keep the "support plan" (Section 2's objectives) in sync with the level manifest so coverage gaps surface automatically (e.g., a lint script or test that checks every learning objective maps to ≥ 1 level).

## 5. Git Simulation Engine Design

Git is **simulated entirely client-side in JavaScript/TypeScript** — there is no real `.git` directory and no server-side git process. This keeps the game a static, hostable-anywhere web app with no backend dependency for the MVP.

**Core data model (suggested):**

```
Repo {
  commits: Map<commitId, Commit>      // Commit { id, parents: [commitId], message, treeSnapshot, timestamp }
  branches: Map<branchName, commitId> // ref name -> commit it points to
  HEAD: { type: "branch" | "detached", ref: string } // branch name or commitId
  workingDirectory: Map<filePath, fileContent>
  stagingArea: Map<filePath, fileContent>
  remotes: Map<remoteName, RemoteRepo>  // RemoteRepo is a second Repo-shaped object
}
```

**Command handlers.** Each supported git command is a pure-ish function `(repo, args) => { newRepo, output, error? }` registered in a command registry keyed by command name (e.g. `commit`, `branch`, `merge`). This registry is the single place new commands get added (ties into Section 4's scalability requirement). Each handler should:

- Validate args against that level's allowed flags.
- Mutate a cloned repo state (never the original, to keep undo/redo and history simple).
- Return terminal-style output text matching real git's output closely enough to be recognizable, but simplified for readability.
- Throw a structured, level-appropriate error for invalid usage (e.g. committing with nothing staged) rather than a raw exception.

**Merge logic** needs real behavior: fast-forward when possible, a true 3-way merge (common ancestor via graph walk) otherwise, and conflict detection that actually inspects simulated file contents for Section B.

**Determinism.** Given a level's starting state and a fixed sequence of commands, the resulting repo state must be reproducible — needed for grading the objective predicate and for automated tests of each level.

## 6. Level Data Schema

Every level (main or variation) is a data object, not level-specific code. Suggested shape:

```
Level {
  id: string                     // e.g. "core.commit.main", "core.commit.var2"
  sectionId: string              // "core-basics" | "collaboration" | "advanced"
  conceptId: string              // e.g. "commit" -- ties a main level + its variations together
  kind: "main" | "variation"
  title: string
  briefing: string                // plain-language concept explanation (main levels only)
  objective: string               // player-facing goal text
  cheatsheet: CheatsheetEntry[]    // [{ command, description, example }] -- only for "main" levels
  allowedCommands: string[]       // whitelist, e.g. ["git init", "git add", "git commit", "git status", "git log"]
  startingState: RepoSnapshot     // initial Repo shape from Section 5
  successPredicate: Predicate     // declarative check against final Repo state (see below)
  hints: string[]                 // ordered, increasingly specific; available on main levels always, on variations hidden-by-default
}

Predicate (declarative, not code, so content stays data-only):
{ "all": [
    { "check": "branchExists", "name": "feature" },
    { "check": "commitCount", "onBranch": "main", "min": 2 },
    { "check": "headPointsTo", "ref": "feature" }
] }
```

Manifest files (per Section 4's scalability requirement):

- `sections.json` -- ordered list of sections with id, title, description, unlock rule.
- `levels/<sectionId>/<conceptId>.json` -- one file per concept, containing its main level plus all variation levels.
- A `conceptObjectives.json` mapping each Section 2 learning objective to the concept id(s) that teach it, so a test can assert full coverage.

Mastery model: a concept is "mastered" once all of its variation levels are completed. Each variation completion records whether any hint was shown; a concept mastered with zero hints across all its variations is flagged **Mastered**, otherwise **Mastered (with assistance)**. Completing only the main level never grants mastery -- it only unlocks the next concept in the main progression.

## 7. UI/UX Requirements

Visual theme: dark terminal aesthetic as the default (monospace fonts, dark background, muted accent colors), with a light/dark toggle built in from the start. The commit-graph visualization stays a clean, minimal node-and-line diagram (not illustrated/playful). All indicators (branch color, success/failure state) must be distinguishable without relying on color alone (shape/icon/label backup), per the full-accessibility requirement.

Main screens:

1. Level-select: a path/map layout, levels shown as nodes along a winding path, grouped visually by concept, with locked nodes greyed out. Overall section progress bar at the top; per-concept mastery indicators (Mastered / Mastered with assistance / In progress / Not started) shown alongside each concept's node cluster.
2. Level/play screen: an objective banner; a toggleable cheatsheet panel (always reachable mid-level via a button/icon, not just shown once); the terminal input/output area; the commit-graph visualization; a working-directory/staging-area view; a Reset Level button; a hint button (hidden-by-default on variations, always visible on main levels); and, on variations, no cheatsheet panel at all.
3. Free Play (sandbox) screen: an open repo with the full command set unlocked, no objective, no grading, just a place to experiment. Reachable from the main menu, separate from the level progression.

Terminal behavior: feels like a real terminal, type a command, press Enter, it runs immediately and prints output. Up-arrow recalls previous commands in that level's session. Tab triggers autocomplete/suggestions limited to that level's allowed commands and relevant flags. A command outside the level's whitelist prints a realistic-looking git error plus one plain-language sentence explaining why it's unavailable here.

Mistake recovery: a visible Reset Level control restores the level's starting state exactly. Command history (via up-arrow) lets the player retype/edit a previous command rather than retyping from scratch; there is no separate undo-last-command feature beyond re-running git commands to fix the state (e.g. git reset), which is itself part of what later levels teach.

Errors: every rejected or failed command shows both the realistic git-style error text and a short plain-language explanation beneath it.

Sound: light sound effects only (e.g. a short success chime on objective completion, a subtle blip on error), no background music. Include a mute toggle.

## 8. Tech Stack & Project Structure

Repo: https://github.com/jrbud/git-sandbox (already created).

Stack: React + TypeScript, built with Vite. No backend for MVP. Progress/save data in browser localStorage, with the data layer written behind an interface so a real account/sync backend can replace it later without touching UI code. Deployment target: Vercel (static frontend now; serverless functions can be added later in the same repo for GitHub OAuth, without restructuring).

Testing: Vitest + React Testing Library for unit and component tests. GitHub Actions CI runs the test suite (and lint/typecheck) on every push, starting from Phase 0.

License: public repo, MIT license.

Suggested project structure:

```
/src
  /engine        // Repo data model, command handlers, predicate evaluator (Section 5) -- framework-agnostic, pure TS
  /content       // sections.json, levels/<sectionId>/<conceptId>.json, conceptObjectives.json (Section 6)
  /components    // Terminal, CommitGraph, Cheatsheet, LevelSelectMap, HintPanel, etc.
  /state         // save/load (localStorage now), progress + mastery tracking
  /theme         // light/dark tokens
  /pages (or /routes)
/tests           // mirrors /src, engine logic especially
.github/workflows // CI
```

Things intentionally left to implementer's judgment, not worth pinning down further here: package manager (npm/pnpm), specific state-management approach in React (Context, Zustand, or similar), exact color token values (must satisfy the colorblind-safe and contrast requirements from Section 7), font/icon choices, and the exact copy for the end-of-Core-Basics celebration screen.

## 9. MVP Scope

The MVP is the Core Basics section, fully playable end to end, portfolio-ready (polished enough to show recruiters, per earlier discussion), deployed live on Vercel.

Included in MVP:

- The simulated git engine covering: init, add, commit, status, log, diff, branch, checkout/switch, merge (fast-forward + 3-way, no conflicts yet -- conflicts are Collaboration-section scope), clone, remote, push, pull, fetch, .gitignore, and git config (user.name/user.email).
- One main level per concept, each with a cheatsheet, briefing, and always-visible hints.
- A default of 3 variation levels per concept (proposed default, per Section 6's mastery model), hints hidden-by-default on variations.
- Level-select path/map screen with overall progress bar + per-concept mastery indicators.
- Free Play (sandbox) mode.
- Dark/light theme toggle, full accessibility pass (screen reader support, colorblind-safe indicators, keyboard navigation).
- localStorage-based save/progress, written behind a swappable interface.
- Public repo, MIT license, polished README, live Vercel deployment link.
- No accounts, no GitHub sign-in (not even a stub button), no Collaboration/Advanced content, no real-repo capstone.

MVP is "done" when: a new player can go from the first concept through every Core Basics concept, complete the main progression, optionally chase mastery via variations, and the whole thing works on desktop with full accessibility support, backed by a passing CI test suite.

## 10. Roadmap: Future Phases Beyond MVP

These are intentionally not built now, but the MVP's architecture (Sections 4-6) should not block them:

**Phase: Collaboration section.** Fork, pull requests, merge conflicts (real conflict markers in simulated files, with a resolution UI), code review flow, origin vs. upstream. Reuses the same engine/level-data architecture; mainly new command handlers (for conflict state) and new level content.

**Phase: Advanced section.** reset vs. revert, interactive rebase, cherry-pick, stash, tags, bisect.

**Phase: Accounts.** "Sign in with GitHub" (OAuth via a Vercel serverless function), server-side sync of progress/mastery data, migrating existing localStorage data into an account on first sign-in.

**Phase: Real-repo capstone.** After Accounts exists: on sign-in, as part of onboarding into this phase, the player creates a real GitHub repo via the API (minimal `repo` scope). The game then gives real-world tasks ("clone this, make a commit, push it") carried out with actual git in the player's own terminal, verified by polling the GitHub API for the expected repo state. This is the bridge from simulated practice to real git usage, and should only be attempted once Accounts is solid.

Naming/branding, visual polish beyond the MVP palette, and any additional gamification (XP, badges, leaderboards) beyond the progress bar + mastery indicators are also deferred unless called out above.

## 11. Phased Implementation Plan for Claude Code

### Working agreement for this plan

- Phases run bottom-up by layer: engine first (fully tested), then UI, then content, then polish.
- Each numbered step below is a single, small, intentional unit of work with its own automated test(s). Do not bundle multiple steps' work into one commit.
- Commit to git at phase boundaries only (once every step in a phase passes), not after every individual step.
- Never add Claude as a co-author or credit Claude in commits or pull requests: no `Co-Authored-By: Claude` trailers in commit messages and no "Generated with Claude Code" lines in PR descriptions.
- Work for each phase goes on its own branch with a pull request into `main`; the user reviews and merges.
- Verification is automated tests only for this plan (Vitest + React Testing Library) -- no manual/visual checklists.
- Before starting each step, briefly check it against this document. If a step's tests fail after a reasonable attempt, or this document turns out to be ambiguous, inconsistent, or wrong for that step, STOP, clearly flag exactly what's wrong or unclear, and wait rather than guessing and continuing.
- Test tooling: Vitest for unit/engine tests, React Testing Library for component tests, both wired into the Phase 0 CI pipeline.

### Phase 0: Project Scaffolding & Tooling

1. Initialize a Vite + React + TypeScript project inside the existing `git-sandbox` repo. Test: `npm run build` succeeds on a stock starter page.
2. Add ESLint + Prettier configs. Test: `npm run lint` passes on the starter code.
3. Add Vitest + React Testing Library. Test: a trivial smoke test (e.g. renders "Hello") passes via `npm run test`.
4. Add the base folder structure from Section 8 (`/src/engine`, `/src/content`, `/src/components`, `/src/state`, `/src/theme`, `/tests`). Test: a placeholder file/test exists in each folder and the test suite still passes.
5. Add GitHub Actions CI running lint, typecheck, and test on push/PR. Test: CI run is green on this branch.
6. Add README skeleton, MIT LICENSE file. Test: none (static content) -- confirm both files render correctly on GitHub.

### Phase 1: Core Git Simulation Engine (framework-agnostic TypeScript)

1. Define the core TypeScript types: `Commit`, `Repo`, branch map, `HEAD`, `RemoteRepo` (Section 5's data model). Test: types compile; a hand-built sample `Repo` object type-checks.
2. Implement an empty-repo factory and the `git init` handler. Test: `init` on an empty state produces a repo with no commits, `main` branch unset, empty working directory.
3. Implement the simulated working directory and staging area as data structures (file path -> content maps). Test: direct manipulation helpers add/update/remove files correctly.
4. Implement the `git add` handler. Test: staging a tracked/untracked file moves the right content into the staging area; staging a nonexistent file errors.
5. Implement the `git commit` handler. Test: committing creates a commit with correct parent(s), advances the current branch pointer, clears the staging area; committing with nothing staged errors.
6. Implement the `git status` handler. Test: correctly reports staged/unstaged/untracked files for several hand-built states.
7. Implement the `git log` handler. Test: walks parents from HEAD and returns commits in correct order for a linear history and for a history with a merge commit.
8. Implement the `git diff` handler. Test: correctly diffs working directory vs. staging area, and staging area vs. last commit, for added/modified/deleted files.
9. Implement the `git branch` handler (create/list/delete). Test: creating a branch points it at current HEAD's commit; deleting the current branch errors; listing reflects all branches.
10. Implement the `git checkout`/`git switch` handler. Test: switching branches moves HEAD and updates the working directory to match that branch's tree; checking out a nonexistent branch errors.
11. Implement fast-forward merge logic. Test: merging a branch that is strictly ahead fast-forwards without a merge commit.
12. Implement true 3-way merge logic (common-ancestor graph walk, no conflicts yet). Test: merging two diverged branches with non-overlapping changes produces a correct merge commit with two parents.
13. Implement the `git config` handler (simulated user.name/user.email). Test: config values persist and are attached to subsequent commits' author field.
14. Implement `.gitignore` pattern matching against the working directory file list. Test: ignored files are excluded from `git status`'s untracked list and cannot be `git add`-ed without `-f`.
15. Implement simulated remotes: `git remote add` and `git clone` (deep-copies a Repo object as a new RemoteRepo-backed local repo). Test: cloning produces an independent repo whose history matches the source at clone time.
16. Implement `git push`, `git pull`, `git fetch` against a simulated remote. Test: push updates the remote's branch ref; pull/fetch bring remote commits into the local repo; pushing a non-fast-forward change errors as real git would.
17. Implement the command-string parser (tokenizes a typed `git <verb> [args/flags]` string). Test: correctly parses a representative set of valid commands and rejects malformed ones with a clear parse error.
18. Implement the command registry/dispatcher routing a parsed command to its handler. Test: dispatch reaches the correct handler for every command implemented in steps 2-16; an unregistered command returns a clear "not a git command" error.
19. Implement per-level `allowedCommands` whitelist enforcement in the dispatcher. Test: a syntactically valid but non-whitelisted command is rejected with the realistic-error + plain-language-explanation pair from Section 7, while a fully unsupported command is rejected differently.
20. Implement the declarative predicate evaluator (Section 6's `Predicate` format) against a Repo snapshot. Test: each predicate check type (`branchExists`, `commitCount`, `headPointsTo`, etc.) correctly evaluates true/false against hand-built repo states, including a compound `all` predicate.

### Phase 2: UI Components

1. Build the Terminal component: input field, output log, press-Enter-to-run execution. Test: typing a command and pressing Enter calls the dispatcher and renders its output.
2. Add command history (up-arrow recall) to the Terminal. Test: pressing up-arrow cycles through previously entered commands in order.
3. Add Tab-completion limited to the active level's `allowedCommands`. Test: Tab completes/suggests only whitelisted commands and relevant flags, not arbitrary git commands.
4. Build the CommitGraph visualization component rendering a Repo's commits/branches/HEAD as a clean node-and-line diagram. Test: renders the correct number of nodes/edges and correct HEAD marker for a sample repo state, including non-color indicators for branch identity.
5. Build the WorkingDirectory/StagingArea view component. Test: renders correct file lists for a sample repo state across tracked/staged/untracked.
6. Build the toggleable Cheatsheet panel component. Test: opens/closes on toggle; renders only on levels whose data includes a cheatsheet.
7. Build the HintPanel component with ordered, escalating hint reveal. Test: each reveal shows the next hint in sequence; records whether a hint was shown (for Section 6's mastery model) on variation levels.
8. Build the ObjectiveBanner component. Test: renders the active level's objective text.
9. Build the Reset Level control. Test: clicking it restores the level's exact starting repo state.
10. Compose the above into a full Level/Play screen wired to one hardcoded sample level. Test: an end-to-end test runs a known command sequence through the Terminal and asserts the screen transitions to a "Level Complete" state when the predicate is satisfied.
11. Build the light/dark theme system (tokens + toggle) and apply it across all components built so far. Test: toggling theme updates rendered theme tokens; both themes meet contrast requirements.
12. Accessibility pass on all components built so far: screen reader labels, full keyboard navigation, colorblind-safe indicators. Test: automated accessibility assertions (e.g. axe-core via a Vitest/RTL integration) pass with no critical violations.

### Phase 3: Content Infrastructure & Progression

1. Implement the save/progress state layer behind a swappable interface, backed by localStorage. Test: progress written is correctly read back after a simulated reload; the interface can be swapped for an in-memory fake in tests.
2. Implement mastery tracking per concept (variation completion + hint-used flag -> Mastered vs. Mastered with assistance). Test: completing all variations for a concept with no hints yields "Mastered"; completing with any hint used yields "Mastered (with assistance)".
3. Implement loading of `sections.json` and the per-concept level manifest files (Section 6). Test: a sample manifest loads into the expected in-memory structure; a malformed manifest fails loudly with a clear error.
4. Build the Level-select path/map screen, rendering nodes from the manifest plus current progress state (locked/unlocked, mastery indicators, overall progress bar reflecting main levels only). Test: locked concepts render as locked until their prerequisite is complete; mastery indicators match stored mastery state.
5. Build the Free Play (sandbox) screen: full command set unlocked, no objective, no grading. Test: all engine commands are available regardless of any level's whitelist, and no predicate/grading logic runs.
6. Wire the full navigation flow: level-select -> play screen -> completion -> back to level-select, including Free Play's separate entry point. Test: an end-to-end test walks this full loop for at least one concept's main level plus one variation.

### Phase 4: Core Basics Content Authoring

1. Author `conceptObjectives.json`, mapping every Section 2 Core Basics learning objective to the concept id(s) that teach it.
2. For each Core Basics concept from Section 9 (init, add, commit, status, log, diff, branch, checkout/switch, merge, clone, remote, push, pull, fetch, .gitignore, git config): author its main level (briefing, cheatsheet, objective, starting state, predicate, hints). Test per concept: the predicate is satisfiable by at least one known valid command sequence run against the engine, and unsatisfied by the starting state alone.
3. For each concept: author 3 variation levels (no cheatsheet, hints hidden-by-default). Test per concept: same satisfiability check as above for each variation, plus confirmation that variations reuse only that concept's `allowedCommands`.
4. Write a coverage test asserting every objective in `conceptObjectives.json` maps to at least one authored level, failing CI if a gap exists.

### Phase 5: Polish & Launch Readiness

1. Add light sound effects (success chime, error blip) and a mute toggle. Test: triggering success/error states fires the correct sound hook; mute toggle suppresses playback.
2. Build the end-of-Core-Basics celebration screen, shown once all main levels are complete. Test: renders only when the main progression is fully complete.
3. Polish the README (project write-up, screenshots, live demo link) for portfolio use. Test: none (content review).
4. Run a full accessibility audit across the complete app. Test: automated accessibility checks pass app-wide with no critical violations.
5. Deploy to Vercel and confirm the deployed build matches the tested build. Test: CI green on main, deployed URL loads and the full level-select -> play -> completion loop works against the production build.
