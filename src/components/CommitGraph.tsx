import { useId } from 'react'
import { shortId } from '../engine/hash'
import { currentBranch } from '../engine/repo'
import type { Repo } from '../engine/types'
import { layoutGraph, type GraphNode } from './graphLayout'

const COLUMN_WIDTH = 72
const LANE_HEIGHT = 64
/** Wide enough that a "HEAD -> main" label on the first commit isn't clipped. */
const PADDING_X = 64
const PADDING_TOP = 44
const RADIUS = 9
/** Lanes differ by dash pattern as well as colour, so they can be told apart without colour. */
const LANE_DASHES = ['', '6 4', '2 4', '10 4 2 4', '1 3', '12 6']

const laneDash = (lane: number) => LANE_DASHES[lane % LANE_DASHES.length]
const laneColor = (lane: number) => `var(--color-lane${lane % 6})`

function position(column: number, lane: number) {
  return { x: PADDING_X + column * COLUMN_WIDTH, y: PADDING_TOP + lane * LANE_HEIGHT }
}

function describe(node: GraphNode): string {
  const refs = node.refs.map((r) => (r.kind === 'remote' ? `remote ${r.name}` : `branch ${r.name}`))
  if (node.isHead) refs.unshift('HEAD')
  return `${shortId(node.id)} ${node.message}${refs.length ? ` (${refs.join(', ')})` : ''}${node.isMerge ? ', merge commit' : ''}`
}

export function CommitGraph({ repo }: { repo: Repo }) {
  const titleId = useId()
  const { nodes, edges, laneCount } = layoutGraph(repo)
  const detached = repo.HEAD.type === 'detached'
  const branch = currentBranch(repo)

  if (!repo.initialized) {
    return (
      <section className="panel commit-graph" aria-label="Commit graph">
        <h2 className="panel-title">Commit graph</h2>
        <p className="panel-empty">Not a git repository. Run git init.</p>
      </section>
    )
  }
  if (nodes.length === 0) {
    return (
      <section className="panel commit-graph" aria-label="Commit graph">
        <h2 className="panel-title">Commit graph</h2>
        <p className="panel-empty">No commits yet.</p>
      </section>
    )
  }

  const width = PADDING_X * 2 + (nodes.length - 1) * COLUMN_WIDTH + 40
  const height = PADDING_TOP + (laneCount - 1) * LANE_HEIGHT + 56

  return (
    <section className="panel commit-graph" aria-label="Commit graph">
      <h2 className="panel-title">Commit graph</h2>
      <div className="commit-graph-scroll">
        <svg width={width} height={height} role="img" aria-labelledby={titleId}>
          <title id={titleId}>
            {`Commit graph with ${nodes.length} commit${nodes.length === 1 ? '' : 's'}${detached ? ', HEAD detached' : branch ? `, HEAD on ${branch}` : ''}`}
          </title>
          {edges.map((edge) => {
            const from = position(edge.fromColumn, edge.fromLane)
            const to = position(edge.toColumn, edge.toLane)
            const lane = Math.max(edge.fromLane, edge.toLane)
            const midX = from.x - COLUMN_WIDTH / 2
            const d =
              from.y === to.y
                ? `M ${from.x} ${from.y} L ${to.x} ${to.y}`
                : `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${Math.max(to.x, midX - COLUMN_WIDTH / 2)} ${to.y} L ${to.x} ${to.y}`
            return (
              <path
                key={`${edge.from}-${edge.to}`}
                data-testid="commit-edge"
                d={d}
                fill="none"
                stroke={laneColor(lane)}
                strokeWidth={2.5}
                strokeDasharray={laneDash(lane) || undefined}
                data-lane={lane}
              />
            )
          })}
          {nodes.map((node) => {
            const { x, y } = position(node.column, node.lane)
            return (
              <g
                key={node.id}
                data-testid="commit-node"
                data-commit={node.id}
                data-lane={node.lane}
              >
                {node.isHead && (
                  <circle
                    data-testid="head-marker"
                    cx={x}
                    cy={y}
                    r={RADIUS + 5}
                    fill="none"
                    stroke="var(--color-text)"
                    strokeWidth={2}
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={RADIUS}
                  fill={node.isMerge ? 'var(--color-surface)' : laneColor(node.lane)}
                  stroke={laneColor(node.lane)}
                  strokeWidth={node.isMerge ? 4 : 2}
                />
                <text x={x} y={y + RADIUS + 16} textAnchor="middle" className="graph-sha">
                  {shortId(node.id)}
                </text>
                {(node.isHead || node.refs.length > 0) && (
                  <text x={x} y={y - RADIUS - 10} textAnchor="middle" className="graph-refs">
                    {node.isHead && (
                      <tspan className="graph-head">{detached ? 'HEAD' : 'HEAD ->'} </tspan>
                    )}
                    {node.refs.map((ref, i) => (
                      <tspan
                        key={ref.name}
                        data-testid="graph-ref"
                        className={ref.kind === 'remote' ? 'graph-ref-remote' : 'graph-ref-branch'}
                      >
                        {i > 0 ? ', ' : ''}
                        {ref.name}
                      </tspan>
                    ))}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <ol className="sr-only" aria-label="Commits, newest first">
        {[...nodes].reverse().map((node) => (
          <li key={node.id}>{describe(node)}</li>
        ))}
      </ol>
    </section>
  )
}
