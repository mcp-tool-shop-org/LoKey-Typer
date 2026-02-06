import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@app/shell'
import { DailySetPage, ExerciseListPage, GoalsPage, HomePage, ModeHubPage, OnboardingPage, RunPage, SettingsPage } from '@features'
import { loadProfileAsync, loadRuns } from '@lib'

function useNeedsOnboarding() {
  const [state, setState] = useState<'loading' | 'yes' | 'no'>('loading')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const profile = await loadProfileAsync()
        if (cancelled) return

        // Already onboarded
        if (profile.onboardedAt) {
          setState('no')
          return
        }

        // Has existing run history → skip onboarding (returning user)
        const runs = loadRuns()
        setState(runs.length > 0 ? 'no' : 'yes')
      } catch {
        setState('no')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

function HomeOrOnboarding() {
  const needs = useNeedsOnboarding()
  if (needs === 'loading') return null
  if (needs === 'yes') return <Navigate to="/welcome" replace />
  return <HomePage />
}

export default function App() {
  const location = useLocation()

  // Prevent redirect loop: if already on /welcome, render it directly
  if (location.pathname === '/welcome') {
    return (
      <Routes>
        <Route element={<AppShell />}>
          <Route path="welcome" element={<OnboardingPage />} />
        </Route>
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomeOrOnboarding />} />

        <Route path="welcome" element={<OnboardingPage />} />
        <Route path="daily" element={<DailySetPage />} />
        <Route path="goals" element={<GoalsPage />} />

        <Route path="focus" element={<ModeHubPage mode="focus" />} />
        <Route path="focus/exercises" element={<ExerciseListPage mode="focus" />} />
        <Route path="focus/settings" element={<SettingsPage mode="focus" />} />
        <Route path="focus/run/:exerciseId" element={<RunPage mode="focus" />} />

        <Route path="real-life" element={<ModeHubPage mode="real_life" />} />
        <Route path="real-life/exercises" element={<ExerciseListPage mode="real_life" />} />
        <Route path="real-life/settings" element={<SettingsPage mode="real_life" />} />
        <Route path="real-life/run/:exerciseId" element={<RunPage mode="real_life" />} />

        <Route path="competitive" element={<ModeHubPage mode="competitive" />} />
        <Route path="competitive/exercises" element={<ExerciseListPage mode="competitive" />} />
        <Route path="competitive/settings" element={<SettingsPage mode="competitive" />} />
        <Route path="competitive/run/:exerciseId" element={<RunPage mode="competitive" />} />

        <Route path="practice" element={<Navigate to="/focus" replace />} />
        <Route path="arcade" element={<Navigate to="/competitive" replace />} />
      </Route>
    </Routes>
  )
}
