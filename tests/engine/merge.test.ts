import { describe, expect, it } from 'vitest'
import { checkoutCommand } from '../../src/engine/commands/checkout'
import { mergeCommand } from '../../src/engine/commands/merge'
import { headCommitId, headTree } from '../../src/engine/repo'
import type { World } from '../../src/engine/types'
import { commitFiles, fail, run, withCommit, write } from './helpers'

/** main stays put; feature gets one commit on top. */
function featureAhead(): World {
  let world = withCommit({ 'a.txt': 'base\n' })
  world = run(world, checkoutCommand, '-b', 'feature').world
  world = commitFiles(world, { 'b.txt': 'from feature\n' }, 'Add b')
  return run(world, checkoutCommand, 'main').world
}

/** main and feature each get their own commit after the shared base. */
function diverged(mainFiles: Record<string, string>, featureFiles: Record<string, string>): World {
  let world = withCommit({ 'a.txt': 'one\ntwo\nthree\nfour\nfive\n', 'shared.txt': 's\n' })
  world = run(world, checkoutCommand, '-b', 'feature').world
  world = commitFiles(world, featureFiles, 'Feature change')
  world = run(world, checkoutCommand, 'main').world
  return commitFiles(world, mainFiles, 'Main change')
}

// Step 11: fast-forward merges.
describe('git merge (fast-forward)', () => {
  it('moves the branch forward without creating a merge commit', () => {
    const world = featureAhead()
    const mainBefore = headCommitId(world.repo)!
    const featureTip = world.repo.branches.get('feature')!
    const commitsBefore = world.repo.commits.size

    const { world: after, output } = run(world, mergeCommand, 'feature')
    expect(after.repo.branches.get('main')).toBe(featureTip)
    expect(after.repo.commits.size).toBe(commitsBefore)
    expect(after.repo.workingDirectory.get('b.txt')).toBe('from feature\n')
    expect(output).toBe(
      [
        `Updating ${mainBefore.slice(0, 7)}..${featureTip.slice(0, 7)}`,
        'Fast-forward',
        ' b.txt | 1 +',
        ' 1 file changed, 1 insertion(+)',
      ].join('\n'),
    )
  })

  it('says "Already up to date." when there is nothing new', () => {
    const world = featureAhead()
    const onFeature = run(world, checkoutCommand, 'feature').world
    expect(run(onFeature, mergeCommand, 'main').output).toBe('Already up to date.')
  })

  it('creates a merge commit anyway with --no-ff', () => {
    const { world } = run(featureAhead(), mergeCommand, '--no-ff', 'feature')
    expect(world.repo.commits.get(headCommitId(world.repo)!)!.parents).toHaveLength(2)
  })

  it('errors on something that is not a branch or commit', () => {
    expect(fail(featureAhead(), mergeCommand, 'nope').message).toBe(
      'merge: nope - not something we can merge',
    )
  })
})

// Step 12: true three-way merges (no conflicts yet).
describe('git merge (three-way)', () => {
  it('combines changes to different files into a merge commit with two parents', () => {
    const world = diverged({ 'main.txt': 'm\n' }, { 'feature.txt': 'f\n' })
    const ours = headCommitId(world.repo)!
    const theirs = world.repo.branches.get('feature')!

    const { world: after, output } = run(world, mergeCommand, 'feature')
    const merge = after.repo.commits.get(headCommitId(after.repo)!)!
    expect(merge.parents).toEqual([ours, theirs])
    expect(merge.message).toBe("Merge branch 'feature'")
    expect(merge.treeSnapshot.get('main.txt')).toBe('m\n')
    expect(merge.treeSnapshot.get('feature.txt')).toBe('f\n')
    expect(after.repo.workingDirectory).toEqual(merge.treeSnapshot)
    expect(output).toMatch(/^Merge made by the 'ort' strategy\.\n feature\.txt \| 1 \+/)
  })

  it('combines changes to different lines of the same file', () => {
    const world = diverged(
      { 'a.txt': 'ONE\ntwo\nthree\nfour\nfive\n' },
      { 'a.txt': 'one\ntwo\nthree\nfour\nFIVE\n' },
    )
    const after = run(world, mergeCommand, 'feature').world
    expect(headTree(after.repo).get('a.txt')).toBe('ONE\ntwo\nthree\nfour\nFIVE\n')
  })

  it('finds the common ancestor even after earlier merges', () => {
    let world = diverged({ 'main.txt': '1\n' }, { 'feature.txt': '1\n' })
    world = run(world, mergeCommand, 'feature').world
    world = run(world, checkoutCommand, 'feature').world
    world = commitFiles(world, { 'feature.txt': '2\n' }, 'More feature')
    world = run(world, checkoutCommand, 'main').world
    world = commitFiles(world, { 'main.txt': '2\n' }, 'More main')
    const after = run(world, mergeCommand, 'feature').world
    const tree = headTree(after.repo)
    expect(tree.get('main.txt')).toBe('2\n')
    expect(tree.get('feature.txt')).toBe('2\n')
  })

  it('adds "into <branch>" to the message when not on main, and honours -m', () => {
    let world = diverged({ 'main.txt': 'm\n' }, { 'feature.txt': 'f\n' })
    world = run(world, checkoutCommand, '-b', 'release').world
    const into = run(world, mergeCommand, 'feature').world
    expect(into.repo.commits.get(headCommitId(into.repo)!)!.message).toBe(
      "Merge branch 'feature' into release",
    )
    const custom = run(world, mergeCommand, '-m', 'Bring in feature', 'feature').world
    expect(custom.repo.commits.get(headCommitId(custom.repo)!)!.message).toBe('Bring in feature')
  })

  it('refuses --ff-only when the branches have diverged', () => {
    const world = diverged({ 'main.txt': 'm\n' }, { 'feature.txt': 'f\n' })
    expect(fail(world, mergeCommand, '--ff-only', 'feature').message).toBe(
      'fatal: Not possible to fast-forward, aborting.',
    )
  })

  it('stops on a conflict without changing anything (conflicts are a later section)', () => {
    const world = diverged({ 'a.txt': 'MAIN\n' }, { 'a.txt': 'FEATURE\n' })
    const error = fail(world, mergeCommand, 'feature')
    expect(error.message).toBe(
      'CONFLICT (content): Merge conflict in a.txt\nAutomatic merge failed; fix conflicts and then commit the result.',
    )
    expect(error.explanation).toMatch(/Collaboration section/)
  })

  it('refuses to merge over uncommitted changes to a file the merge would change', () => {
    const world = write(diverged({ 'main.txt': 'm\n' }, { 'shared.txt': 'changed\n' }), {
      'shared.txt': 'local\n',
    })
    expect(fail(world, mergeCommand, 'feature').message).toMatch(
      /^error: Your local changes to the following files would be overwritten by merge:\n\tshared\.txt/,
    )
  })
})
