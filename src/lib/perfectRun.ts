export type RunMetrics = {
  mistakes: number
  backspaces?: number
  resets?: number
  pasteUsed?: boolean
}

export function isPerfectRun(metrics: RunMetrics): boolean {
  if (metrics.mistakes > 0) return false
  if (metrics.pasteUsed) return false
  if ((metrics.resets ?? 0) > 0) return false
  return true
}
