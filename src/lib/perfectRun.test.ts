import { describe, expect, it } from 'vitest'
import { isPerfectRun } from './perfectRun'

describe('isPerfectRun', () => {
  it('qualifies a flawless run', () => {
    expect(isPerfectRun({ mistakes: 0, pasteUsed: false, resets: 0 })).toBe(true)
  })

  it('tolerates undefined resets/backspaces if mistakes are 0', () => {
    // Backspaces are allowed in a perfect run? 
    // Usually "Perfect" means no errors committed to the final text, OR no errors typed at all?
    // User implementation typically: mistakes = errors. 
    // If I type 'a', backspace, 'b' (correctly), does that count as mistake?
    // In many typers, backspacing a wrong char clears the error.
    // But usually 'mistakes' tracks raw error count. 
    // If mistakes > 0, it fails.
    expect(isPerfectRun({ mistakes: 0 })).toBe(true)
  })

  it('disqualifies on any mistakes', () => {
    expect(isPerfectRun({ mistakes: 1, pasteUsed: false })).toBe(false)
  })

  it('disqualifies on paste usage', () => {
    expect(isPerfectRun({ mistakes: 0, pasteUsed: true })).toBe(false)
  })

  it('disqualifies on resets', () => {
    expect(isPerfectRun({ mistakes: 0, resets: 1 })).toBe(false)
  })

  it('allows backspaces if not counted as mistakes (unless strict mode, but standard Perfect is just 100% acc)', () => {
     // The prompt didn't specify backspaces. "Mistakes === 0" is the rule.
     // If the engine counts corrected errors as 'backspaces' but 'errors' as 0?
     // Typically 'Perfect' = 100% accuracy.
     expect(isPerfectRun({ mistakes: 0, backspaces: 5 })).toBe(true)
  })
})
