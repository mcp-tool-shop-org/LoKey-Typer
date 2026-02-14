
export type ProgressionParams = {
  currentLength: number
  isSuccess: boolean // Did they finish without restarting?
  accuracy: number
  wpm: number
  streak: number // How many clean runs in a row?
  growthMode?: 'slow' | 'normal' | 'fast'
  maxLen?: number
}

export type ProgressionResult = {
  nextLength: number
  nextStreak: number
}

const MIN_LENGTH = 30
const DEFAULT_MAX_LENGTH = 300

export function computeFocusTargetLength(params: ProgressionParams): ProgressionResult {
  let nextStreak = params.streak
  let nextLength = params.currentLength
  
  const maxLen = params.maxLen ?? DEFAULT_MAX_LENGTH
  const growthMode = params.growthMode ?? 'normal'
  
  const rampUpStep = growthMode === 'fast' ? 50 : growthMode === 'slow' ? 10 : 25
  const rampDownStep = 15 // Keep ramp down consistent? Or scale it? Keep consistent to punish failure.

  // If they failed or had terrible accuracy, break streak and ramp down immediately
  if (!params.isSuccess || params.accuracy < 0.9) {
    nextStreak = 0
    nextLength = Math.max(MIN_LENGTH, nextLength - rampDownStep)
    return { nextLength, nextStreak }
  }

  // Good accuracy maintain streak
  if (params.accuracy >= 0.96) {
    nextStreak++
  } else {
    // Middling accuracy (0.90 - 0.96) holds streak or resets it gently, 
    // but for now let's just hold length and reset streak to avoid premature ramp up
    nextStreak = 0
  }

  // Ramp up logic
  // Every 3 clean runs (streak % 3 == 0), bump length
  if (nextStreak > 0 && nextStreak % 3 === 0) {
    nextLength = Math.min(maxLen, nextLength + rampUpStep)
  }
  
  // Also clamp in case maxLen changed downwards
  nextLength = Math.min(maxLen, Math.max(MIN_LENGTH, nextLength))

  return { nextLength, nextStreak }
}
