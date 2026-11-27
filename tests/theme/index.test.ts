import { describe, expect, it } from 'vitest'
import { MODULE_NAME } from '../../src/theme'

describe('theme module placeholder', () => {
  it('exists and is importable', () => {
    expect(MODULE_NAME).toBe('theme')
  })
})
