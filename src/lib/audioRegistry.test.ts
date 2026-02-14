import { describe, expect, it } from 'vitest'
import { SAMPLE_URLS, type TypewriterSound } from './audio'

describe('Audio Registry', () => {
  it('has valid mappings for all sound categories', () => {
    // Ensure the registry object is well-formed
    expect(SAMPLE_URLS).toBeDefined()
    const keys = Object.keys(SAMPLE_URLS)
    expect(keys.length).toBeGreaterThan(0)
  })

  it('contains no empty paths', () => {
    for (const [key, urls] of Object.entries(SAMPLE_URLS)) {
      expect(urls.length).toBeGreaterThan(0)
      urls.forEach((url, idx) => {
        expect(url).toBeTruthy()
        expect(url.trim().length).toBeGreaterThan(0)
        // Check for extension (sanity check)
        expect(url).toMatch(/\.wav$/)
      })
    }
  })

  it('has consistent known keys', () => {
    const expectedKeys: TypewriterSound[] = ['key', 'spacebar', 'backspace', 'return_bell', 'error', 'success']
    const actualKeys = Object.keys(SAMPLE_URLS)
    
    // Check that we strictly implement the known keys (no more, no less, unless we intentionally update both)
    // This protects against "orphaned" keys in the standard registry
    expect(actualKeys.sort()).toEqual(expectedKeys.sort())
  })
})
