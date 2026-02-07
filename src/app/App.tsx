import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@app/shell'
import { DailySetPage, HomePage, ModePage, RunPage } from '@features'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />

        <Route path="daily" element={<DailySetPage />} />

        <Route path="focus" element={<ModePage mode="focus" />} />
        <Route path="focus/run/:exerciseId" element={<RunPage mode="focus" />} />

        <Route path="real-life" element={<ModePage mode="real_life" />} />
        <Route path="real-life/run/:exerciseId" element={<RunPage mode="real_life" />} />

        <Route path="competitive" element={<ModePage mode="competitive" />} />
        <Route path="competitive/run/:exerciseId" element={<RunPage mode="competitive" />} />

        <Route path="practice" element={<Navigate to="/focus" replace />} />
        <Route path="arcade" element={<Navigate to="/competitive" replace />} />
      </Route>
    </Routes>
  )
}
