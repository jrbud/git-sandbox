import { useReducer } from 'react'
import type { Predicate } from '../engine/predicates'
import { runCommand, type DispatchError } from '../engine/dispatcher'
import { evaluatePredicate } from '../engine/predicates'
import { cloneWorld } from '../engine/repo'
import type { World } from '../engine/types'

export interface LogEntry {
  id: number
  input: string
  output: string
  error?: DispatchError
}

export interface SessionState {
  config: SessionConfig
  world: World
  log: LogEntry[]
  /** Every command typed this session, oldest first, for up-arrow recall. */
  history: string[]
  completed: boolean
  /** How many hints have been revealed. Survives Reset, so hint use is always recorded. */
  hintsShown: number
  nextId: number
}

export type SessionAction =
  | { type: 'run'; input: string }
  | { type: 'setWorld'; world: World }
  | { type: 'reset' }
  | { type: 'revealHint' }

/** What a session needs. A Level satisfies this; Free Play omits the whitelist and goal. */
export interface SessionConfig {
  startingState: World
  allowedCommands?: readonly string[]
  successPredicate?: Predicate
  hints?: readonly string[]
}

export function createSession(config: SessionConfig): SessionState {
  return {
    config,
    world: cloneWorld(config.startingState),
    log: [],
    history: [],
    completed: false,
    hintsShown: 0,
    nextId: 1,
  }
}

function withWorld(state: SessionState, world: World): SessionState {
  const predicate = state.config.successPredicate
  const completed =
    state.completed || (predicate !== undefined && evaluatePredicate(world, predicate))
  return { ...state, world, completed }
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'run': {
      const input = action.input
      const history = input.trim() === '' ? state.history : [...state.history, input]
      if (input.trim() === 'clear') return { ...state, history, log: [] }
      const result = runCommand(state.world, input, {
        allowedCommands: state.config.allowedCommands,
      })
      const entry: LogEntry = result.ok
        ? { id: state.nextId, input, output: result.output }
        : { id: state.nextId, input, output: '', error: result.error }
      const next = { ...state, history, log: [...state.log, entry], nextId: state.nextId + 1 }
      return result.ok ? withWorld(next, result.world) : next
    }
    case 'setWorld':
      return withWorld(state, action.world)
    case 'reset':
      return { ...state, world: cloneWorld(state.config.startingState), log: [], completed: false }
    case 'revealHint':
      return {
        ...state,
        hintsShown: Math.min(state.hintsShown + 1, state.config.hints?.length ?? 0),
      }
  }
}

export function useLevelSession(config: SessionConfig) {
  return useReducer(sessionReducer, config, createSession)
}
