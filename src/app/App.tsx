import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@app/shell'
import { DailySetPage, ExerciseListPage, HomePage, ModeHubPage, RunPage, SettingsPage } from '@features'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />

        <Route path="daily" element={<DailySetPage />} />

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
