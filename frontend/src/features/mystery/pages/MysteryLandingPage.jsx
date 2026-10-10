import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMysteryCases, fetchMysteryEvents } from '../services/mystery.api';
import { MYSTERY_PATHS } from '../config';
import MysteryCaseCard from '../components/MysteryCaseCard';

export default function MysteryLandingPage() {
  const [cases, setCases] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [c, e] = await Promise.all([fetchMysteryCases(), fetchMysteryEvents()]);
        setCases((c.data || c || []).filter((x) => x.status === 'published'));
        setEvents(e.data || e || []);
      } catch (err) {
        setError(err.message || 'Could not load cases');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-5 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 p-6">
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, #0ECCEE2e, transparent 60%)' }} />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0ECCEE]">CTRL Mystery</p>
            <h1 className="mt-2 text-3xl font-bold">Crack the case</h1>
            <p className="mt-2 max-w-md text-sm text-white/60">Evidence unlock karo, leads follow karo, aur sahi theory solve karke apni team ko top pe le jao.</p>
            <Link to={MYSTERY_PATHS.enter} className="mt-4 inline-block text-sm text-[#0ECCEE] underline">Already have a team? Enter with team code →</Link>
          </div>
        </div>

        {loading && <p className="mt-8 text-white/40">Loading cases…</p>}
        {error && <p className="mt-8 text-sm text-rose-300">{error}</p>}
        {!loading && !error && cases.length === 0 && (
          <p className="mt-8 rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/40">Abhi koi case published nahi hai.</p>
        )}

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {cases.map((c) => {
            const liveEvent = events.find((ev) => (ev.caseId === c._id || ev.caseId?._id === c._id) && ev.status === 'registration_open');
            return <MysteryCaseCard key={c._id} mysteryCase={c} event={liveEvent} />;
          })}
        </div>
      </div>
    </div>
  );
}