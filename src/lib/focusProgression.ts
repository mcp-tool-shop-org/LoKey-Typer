
export type ProgressionParams = {
  currentLength: number
  isSuccess: boolean // Did they finish without restarting?
  accuracy: number
  wpm: number
  streak: number // How many clean runs in a row?
}

export type ProgressionResult = {
  nextLength: number
  nextStreak: number
}

const MIN_LENGTH = 30
const MAX_LENGTH = 300
const RAMP_UP_STEP = 25
const RAMP_DOWN_STEP = 15

export function computeFocusTargetLength(params: ProgressionParams): ProgressionResult {
  let nextStreak = params.streak
  let nextLength = params.currentLength

  // If they failed or had terrible accuracy, break streak and ramp down immediately
  if (!params.isSuccess || params.accuracy < 0.9) {
    nextStreak = 0
    nextLength = Math.max(MIN_LENGTH, nextLength - RAMP_DOWN_STEP)
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
    nextLength = Math.min(MAX_LENGTH, nextLength + RAMP_UP_STEP)
  }

  return { nextLength, nextStreak }
}
