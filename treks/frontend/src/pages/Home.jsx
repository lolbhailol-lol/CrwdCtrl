import { useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import Search from '../components/Search'
import WaterfallLiveBoard from '../components/WaterfallLiveBoard'
import QuickMarkIn from '../components/QuickMarkIn'
import ShareUpdateSheet from '../components/ShareUpdateSheet'
import CommunityUpdateCard from '../components/CommunityUpdateCard'
import LoadingScreen from '../components/LoadingScreen'
import Button from '../components/Button'
import { APP_NAME, APP_TAGLINE } from '../utils/constants'
import { useTrekData } from '../context/TrekDataContext'
import { fetchTreksForDate, getCachedBoard } from '../services/trekService'
import { buildPlanDays } from '../utils/planDates'

export default function Home() {
  const [query, setQuery] = useState('')
  const [markOpen, setMarkOpen] = useState(false)
  const [markSlug, setMarkSlug] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [boardTreks, setBoardTreks] = useState([])
  const [dayKey, setDayKey] = useState(0)
  const [boardLoading, setBoardLoading] = useState(false)

  const planDays = useMemo(() => buildPlanDays(), [])
  const navigate = useNavigate()
  const lastBoardDate = useRef(null)
  const {
    ready,
    loading,
    source,
    tick,
    nowTick,
    refresh,
    reportSource,
    planDate: selectedDate,
    setPlanDate: setSelectedDate,
    getLatestCommunityUpdates,
  } = useTrekData()

  const selectedDateRef = useRef(selectedDate)
  selectedDateRef.current = selectedDate

  useEffect(() => {
    if (!ready) return
    let alive = true
    const requestedDate = selectedDate
    const dateChanged = lastBoardDate.current !== requestedDate
    lastBoardDate.current = requestedDate

    async function loadDay() {
      // Show the last known rows for this day instead of a blank flash
      const cached = getCachedBoard(requestedDate)
      if (dateChanged) {
        if (cached) setBoardTreks(cached)
        else setBoardLoading(true)
      }
      const result = await fetchTreksForDate(requestedDate)
      // Day may have changed while the request was in flight
      if (!alive || selectedDateRef.current !== requestedDate) return
      reportSource(result.source, result.error || null)
      setBoardTreks(result.treks || [])
      setDayKey((n) => n + 1)
      setBoardLoading(false)
    }
    loadDay()
    return () => {
      alive = false
    }
  }, [ready, selectedDate, tick])

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
    <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10">
      <section className="container-wide section-pad pt-4 pb-3 sm:pt-12 sm:pb-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-medium uppercase tracking-wide text-brand sm:text-xs">
            {APP_NAME}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:mt-2 sm:text-4xl">
            {APP_TAGLINE}
          </h1>
          <p className="mx-auto mt-2 hidden max-w-md text-sm text-muted sm:block sm:text-base">
            Pick a day, see the trails, mark yourself in. Help others know the crowd.
          </p>
          <div className="mx-auto mt-3 max-w-lg sm:mt-5">
            <Search value={query} onChange={setQuery} onSubmit={handleSearch} />
          </div>
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
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={() => setShareOpen(true)}>
              Share an update
            </Button>
            <Button to="/explore" variant="outline" size="sm">
              Explore trails
            </Button>
          </div>
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
        planDays={planDays}
        onSuccess={async (date) => {
          const target = date || selectedDate
          if (date && date !== selectedDate) setSelectedDate(date)
          await refresh({ force: true })
          const result = await fetchTreksForDate(target)
          if (selectedDateRef.current !== target) return
          setBoardTreks(result.treks || [])
          setDayKey((n) => n + 1)
        }}
      />

      <ShareUpdateSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        treks={boardTreks}
        onPosted={() => refresh({ force: true, silent: true })}
      />
    </div>
  )
}
