import type { Mode } from '@content'

export type MicroFeedbackInputs = {
  mode: Mode
  wpm: number
  accuracy: number
  errors: number
  backspaces: number
  duration_ms: number
  is_personal_best_wpm: boolean
  is_personal_best_accuracy: boolean
  delta_wpm_vs_best: number
  delta_accuracy_vs_best: number
}

export type MicroFeedback = {
  primary: string
  secondary?: string
}

function fmt1(n: number) {
  return (Math.round(n * 10) / 10).toFixed(1)
}

function calmPrimary(i: MicroFeedbackInputs) {
  if (i.is_personal_best_wpm && i.accuracy >= 0.97) return 'New personal best, and you kept it clean.'
  if (i.accuracy >= 0.99 && i.duration_ms >= 20_000) return 'Excellent control. That was very clean.'
  if (i.accuracy >= 0.98) return 'Strong accuracy. Nice, steady work.'
  if (i.accuracy >= 0.97 && i.errors <= 2) return 'Calm and consistent—great finish.'
  if (i.wpm >= 55 && i.accuracy >= 0.96) return 'Good pace, and you stayed in control.'
  if (i.backspaces <= 5 && i.duration_ms >= 20_000) return 'Minimal corrections. Smooth flow.'
  if (i.errors > 0 && i.accuracy >= 0.95) return 'Nice recovery. You kept moving without spiraling.'
  if (i.accuracy < 0.93) return 'Slow it down slightly and aim for clean entries.'
  return 'Good session. Keep the rhythm steady.'
}

function calmSecondary(i: MicroFeedbackInputs) {
  if (i.backspaces >= 15) return 'Try fewer corrections—finish the word, then fix if needed.'
  if (i.errors >= 8) return 'Aim for the next character only. Accuracy will bring speed.'
  if (i.wpm < 35 && i.duration_ms >= 30_000) return 'You can nudge the pace up once it feels effortless.'
  return ''
}

function competitivePrimary(i: MicroFeedbackInputs) {
  if (i.is_personal_best_wpm && i.accuracy >= 0.95) return 'New PB WPM. Keep it repeatable.'
  if (i.is_personal_best_accuracy && i.duration_ms >= 20_000) return 'New PB accuracy. Clean run.'
  if (i.accuracy >= 0.99) return 'Elite accuracy. Push pace next run.'
  if (i.wpm >= 60 && i.accuracy >= 0.97) return 'Fast and clean. That’s the zone.'
  if (i.wpm >= 60 && i.accuracy < 0.95) return 'Pace is there. Tighten accuracy to convert it.'
  if (i.accuracy < 0.95) return 'Accuracy under 95%. Slow slightly and lock it in.'
  return 'Solid run. Chase clean speed.'
}

function competitiveSecondary(i: MicroFeedbackInputs) {
  if (i.delta_wpm_vs_best >= 1.0 && i.accuracy >= 0.95) {
    return `Up vs best: +${fmt1(i.delta_wpm_vs_best)} WPM.`
  }
  if (i.delta_wpm_vs_best <= -1.0) {
    return `Down vs best: ${fmt1(i.delta_wpm_vs_best)} WPM. Reset and run it again.`
  }
  if (i.backspaces >= 15) return 'Too many backspaces. Commit, then correct.'
  if (i.errors >= 10) return 'Error spike. Ease off 5% and rebuild rhythm.'
  return ''
}

export function buildFeedback(i: MicroFeedbackInputs): MicroFeedback {
  const tone = i.mode === 'competitive' ? 'competitive' : 'calm'

  const primary = tone === 'competitive' ? competitivePrimary(i) : calmPrimary(i)
  const secondaryRaw = tone === 'competitive' ? competitiveSecondary(i) : calmSecondary(i)
  const secondary = secondaryRaw.trim().length > 0 ? secondaryRaw : undefined

  return { primary, secondary }
}
