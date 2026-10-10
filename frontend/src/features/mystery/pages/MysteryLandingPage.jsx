import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMysteryCases, fetchMysteryEvents } from '../services/mystery.api';
import { MYSTERY_PATHS } from '../config';

export default function MysteryLandingPage() {
  const [cases, setCases] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [c, e] = await Promise.all([fetchMysteryCases(), fetchMysteryEvents()]);
        setCases(c.data || c || []);
        setEvents(e.data || e || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-5 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0ECCEE]">CTRL Mystery</p>
        <h1 className="mt-2 text-3xl font-bold">Crack the case</h1>
        <p className="mt-2 text-white/60">
          Already have a team? <Link to={MYSTERY_PATHS.enter} className="text-[#0ECCEE] underline">Enter with team code</Link>
        </p>

        {loading && <p className="mt-8 text-white/40">Loading cases…</p>}

        <div className="mt-8 grid gap-4">
          {cases.map((c) => (
            <div key={c._id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-bold">{c.title}</h2>
              <p className="mt-1 text-sm text-white/60">{c.tagline}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={MYSTERY_PATHS.practice(c._id)}
                  className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold"
                >
                  Try solo (practice)
                </Link>
                {events.filter((ev) => ev.caseId === c._id).map((ev) => (
                  <Link
                    key={ev._id}
                    to={MYSTERY_PATHS.register(c._id) + `?eventId=${ev._id}`}
                    className="rounded-xl bg-[#0ECCEE] px-4 py-2 text-sm font-bold text-black"
                  >
                    Register — {ev.college || 'Live event'}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}