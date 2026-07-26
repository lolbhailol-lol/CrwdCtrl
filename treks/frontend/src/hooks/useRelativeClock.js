import { useEffect, useState } from 'react'

/**
 * Bumps every `intervalMs` so relative-time labels re-render without a data refetch.
 */
export default function useRelativeClock(intervalMs = 60_000) {
  const [nowTick, setNowTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTick((n) => n + 1)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return nowTick
}
