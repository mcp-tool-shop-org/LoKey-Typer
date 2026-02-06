import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveProfileAsync, type UserProfile } from '@lib'

type Goal = UserProfile['goal']

const GOALS: { value: Goal; label: string; description: string }[] = [
  { value: 'calm', label: 'Calm practice', description: 'Low noise, steady improvement.' },
  { value: 'speed', label: 'Speed building', description: 'Push WPM with focused drills.' },
  { value: 'work_writing', label: 'Work writing', description: 'Emails, chats, real-life text.' },
  { value: 'competition', label: 'Competition', description: 'Sprints, PBs, leaderboards.' },
]

export function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState<Goal>('')

  const finish = async (finalGoal: Goal) => {
    const profile: UserProfile = {
      name: name.trim(),
      pronouns: '',
      goal: finalGoal,
      tonePreference: 'supportive',
      onboardedAt: new Date().toISOString(),
    }
    await saveProfileAsync(profile)
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 py-12">
      {step === 1 ? (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Welcome to LoKey Typer</h1>
            <p className="mt-2 text-sm text-zinc-400">
              A calm place to practice typing. Everything stays local on your device.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-200" htmlFor="onboard-name">
              What should we call you?
            </label>
            <input
              id="onboard-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
              maxLength={40}
              autoFocus
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-200/30"
              onKeyDown={(e) => {
                if (e.key === 'Enter') setStep(2)
              }}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-md bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-white"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => finish('')}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
            >
              Just start
            </button>
          </div>
        </div>
      ) : step === 2 ? (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
              {name.trim() ? `Hey ${name.trim()}.` : 'One more thing.'}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">What brings you here?</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {GOALS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => {
                  setGoal(g.value)
                  setStep(3)
                }}
                className={[
                  'rounded-xl border p-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
                  goal === g.value
                    ? 'border-zinc-500 bg-zinc-900'
                    : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900',
                ].join(' ')}
              >
                <div className="text-sm font-semibold text-zinc-50">{g.label}</div>
                <div className="mt-1 text-xs text-zinc-400">{g.description}</div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Back
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">You're set.</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {goal === 'calm' && "We'll start you in Focus mode. Minimal noise, steady pace."}
              {goal === 'speed' && "We'll start with Focus drills to build a clean foundation."}
              {goal === 'work_writing' && "Real-Life mode has emails, chats, and everyday text ready."}
              {goal === 'competition' && "Competitive mode has timed sprints and a local leaderboard."}
              {!goal && "Pick any mode from the home screen. Everything adapts to you."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => finish(goal)}
            className="rounded-md bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-white"
          >
            Let's go
          </button>
        </div>
      )}
    </div>
  )
}
