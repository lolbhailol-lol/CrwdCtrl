import { useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import Search from '../components/Search'
import WaterfallLiveBoard from '../components/WaterfallLiveBoard'
import QuickMarkIn from '../components/QuickMarkIn'
import CommunityUpdateCard from '../components/CommunityUpdateCard'
import LoadingScreen from '../components/LoadingScreen'
import Button from '../components/Button'
import { APP_NAME, APP_TAGLINE } from '../utils/constants'
import { useTrekData } from '../context/TrekDataContext'
import { fetchTreksForDate } from '../services/trekService'
import { buildPlanDays, todayIst } from '../utils/planDates'

export default function Home() {
  const [query, setQuery] = useState('')
  const [markOpen, setMarkOpen] = useState(false)
  const [markSlug, setMarkSlug] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => todayIst())
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [boardTreks, setBoardTreks] = useState([])
  const [dayKey, setDayKey] = useState(0)
  const [boardLoading, setBoardLoading] = useState(false)

  const planDays = useMemo(() => buildPlanDays(), [])
  const navigate = useNavigate()
  const lastBoardDate = useRef(null)
  const { ready, loading, source, tick, nowTick, refresh, getLatestCommunityUpdates } =
    useTrekData()

  useEffect(() => {
    if (!ready) return
    let alive = true
    const dateChanged = lastBoardDate.current !== selectedDate
    lastBoardDate.current = selectedDate

    async function loadDay() {
      // Blank/“Updating…” only when switching days — silent polls keep the list visible
      if (dateChanged) setBoardLoading(true)
      const result = await fetchTreksForDate(selectedDate)
      if (!alive) return
      setBoardTreks(result.treks || [])
      setDayKey((n) => n + 1)
      setBoardLoading(false)
    }
    loadDay()
    return () => {
      alive = false
    }
  }, [ready, selectedDate, tick])

  const selectedDateRef = useRef(selectedDate)
  selectedDateRef.current = selectedDate

  // Soft poll while tab visible — pick up other users' mark-ins / scout edits
  useEffect(() => {
    if (!ready) return
    const POLL_MS = 50_000

    const poll = () => {
      if (document.visibilityState !== 'visible') return
      refresh({ force: true, date: selectedDateRef.current, silent: true })
    }

    const id = window.setInterval(poll, POLL_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') poll()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [ready, refresh])

  const community = useMemo(() => {
    if (!ready) return []
    return getLatestCommunityUpdates(5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tick, source, nowTick])

  const handleSearch = (value) => {
    const q = (value ?? query).trim()
    navigate(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore')
  }

  const openMarkIn = (slug = '') => {
    setMarkSlug(slug || '')
    setMarkOpen(true)
  }

  if (!ready) {
    return <LoadingScreen label={loading ? 'Connecting to live trek API…' : 'Loading…'} />
  }

  return (
    <div className="pb-[calc(8.5rem+env(safe-area-inset-bottom))] md:pb-10">
      <section className="container-wide section-pad pt-6 pb-4 sm:pt-12 sm:pb-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-brand">{APP_NAME}</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink sm:mt-2 sm:text-4xl">
            {APP_TAGLINE}
          </h1>
          <p className="mx-auto mt-2 hidden max-w-md text-sm text-muted sm:block sm:text-base">
            Pick a day, see the trails, mark yourself in. Help others know the crowd.
          </p>
          <div className="mx-auto mt-4 max-w-lg sm:mt-5">
            <Search value={query} onChange={setQuery} onSubmit={handleSearch} />
          </div>
          {source === 'api' ? (
            <p className="mt-3 hidden text-[11px] text-muted sm:block">Live data</p>
          ) : source && source !== 'idle' ? (
            <p className="mt-3 text-[11px] text-[#ffcd98]">Demo data · times not live</p>
          ) : null}
        </div>
      </section>

      <WaterfallLiveBoard
        treks={boardTreks}
        planDays={planDays}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        onMarkIn={openMarkIn}
        dayKey={dayKey}
        boardLoading={boardLoading}
      />

      <section className="container-wide section-pad mt-10 hidden md:block">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Recent updates</h2>
            <p className="text-sm text-muted">Notes from the trail</p>
          </div>
          <Button to="/explore" variant="outline" size="sm">
            Explore trails
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {community.length ? (
            community.map((update) => (
              <CommunityUpdateCard
                key={`${update.trekSlug}-${update.id}`}
                update={update}
                showTrek
              />
            ))
          ) : (
            <p className="text-sm text-muted sm:col-span-2">
              No updates yet — mark in on the board above.
            </p>
          )}
        </div>
      </section>

      <QuickMarkIn
        open={markOpen}
        onClose={() => setMarkOpen(false)}
        treks={boardTreks}
        initialSlug={markSlug}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        planDays={planDays}
        onSuccess={async (date) => {
          if (date) setSelectedDate(date)
          await refresh({ force: true, date: date || selectedDate })
          const result = await fetchTreksForDate(date || selectedDate)
          setBoardTreks(result.treks || [])
          setDayKey((n) => n + 1)
        }}
      />
    </div>
  )
}
