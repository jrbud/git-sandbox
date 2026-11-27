/**
 * Deterministic, dependency-free hashing for commit and blob ids.
 * Not cryptographic: it only has to look like a git hash and be stable.
 */

function hash32(input: string, seed: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 0x01000193)
    h ^= h >>> 15
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** 40 hex characters, like a SHA-1. */
export function hashString(input: string): string {
  let out = ''
  for (let seed = 1; seed <= 5; seed++) {
    out += hash32(input, seed).toString(16).padStart(8, '0')
  }
  return out
}

export function shortId(id: string): string {
  return id.slice(0, 7)
}

export function blobId(content: string): string {
  return hashString(`blob\0${content}`)
}
