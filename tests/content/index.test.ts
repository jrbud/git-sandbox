import { describe, expect, it } from 'vitest'
import { MODULE_NAME } from '../../src/content'

describe('content module placeholder', () => {
  it('exists and is importable', () => {
    expect(MODULE_NAME).toBe('content')
  })
})
