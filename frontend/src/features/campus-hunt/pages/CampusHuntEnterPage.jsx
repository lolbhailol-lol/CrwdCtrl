import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CAMPUS_HUNT_PATHS } from '../config';
import { normalizeTeamCode } from '../utils/teamCode';
import { fetchCampusHuntColleges } from '../services/campusHunt.api';
import {
  HuntPageHeader,
  HuntPageShell,
  HuntPrimaryButton,
  MissionProgress,
} from '../components/HuntV2Shell';

export default function CampusHuntEnterPage() {
  const navigate = useNavigate();
  const [colleges, setColleges] = useState([]);
  const [college, setCollege] = useState('');
  const [eventSlug, setEventSlug] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCampusHuntColleges()
      .then((response) => {
        if (cancelled) return;
        const list = (response.data?.colleges || []).filter((row) =>
          (row.events || []).some((event) => event.loginLive === true));
        setColleges(list);
        setCollege(list[0]?.college || '');
        setEventSlug(list[0]?.events?.find((event) => event.loginLive)?.slug || '');
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || 'Could not load colleges');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const events = useMemo(() => (
    colleges.find((row) => row.college === college)?.events || []
  ).filter((event) => event.loginLive === true), [colleges, college]);

  const changeCollege = (value) => {
    setCollege(value);
    const next = (colleges.find((row) => row.college === value)?.events || [])
      .find((event) => event.loginLive === true);
    setEventSlug(next?.slug || '');
  };

  const openOnline = () => {
    const code = normalizeTeamCode(teamCode);
    if (!eventSlug) return setError('Pick your college');
    if (!code) return setError('Enter your team code (for example CC001)');
    navigate(CAMPUS_HUNT_PATHS.teamLogin(eventSlug, code));
  };

  return (
    <HuntPageShell>
      <div className="hunt-v2-page">
        <HuntPageHeader title="Choose Game Mode" backTo="/" />
        <div className="hunt-v2-content">
          <MissionProgress label="Loadout" step={5} />
          <p className="mt-4 text-sm text-[color:var(--hunt-muted)]">Pick the mode that fits your campus connection.</p>

          <section className="hunt-v2-card hunt-v2-card-accent hunt-v2-mode">
            <div className="hunt-v2-mode-head">
              <img src="/campus-hunt/v2/mode-online.svg" alt="" />
              <div><h2>Online Mode</h2><small>Live sync + live leaderboard</small></div>
            </div>
            <p>Best when campus internet is stable.</p>
            <div className="grid gap-3">
              {loading ? <p>Loading colleges…</p> : (
                <>
                  <label className="hunt-v2-field">College
                    <select className="hunt-v2-select" value={college} onChange={(event) => changeCollege(event.target.value)}>
                      {colleges.map((row) => <option key={row.college} value={row.college}>{row.college}</option>)}
                    </select>
                  </label>
                  {events.length > 1 ? (
                    <label className="hunt-v2-field">Event
                      <select className="hunt-v2-select" value={eventSlug} onChange={(event) => setEventSlug(event.target.value)}>
                        {events.map((event) => <option key={event.id || event.slug} value={event.slug}>{event.name}</option>)}
                      </select>
                    </label>
                  ) : null}
                  <label className="hunt-v2-field">Team code
                    <input className="hunt-v2-input font-mono uppercase tracking-[.16em]" value={teamCode} onChange={(event) => setTeamCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))} placeholder="CC001" />
                  </label>
                </>
              )}
            </div>
            {error ? <p className="hunt-v2-error mt-3">{error}</p> : null}
            <HuntPrimaryButton className="mt-4" onClick={openOnline}>Use Online Mode</HuntPrimaryButton>
            <div className="hunt-v2-mode-tags"><span>LIVE SYNC</span><span>LEADERBOARD</span></div>
          </section>

          <section className="hunt-v2-card hunt-v2-mode mt-4">
            <div className="hunt-v2-mode-head">
              <img src="/campus-hunt/v2/mode-offline.svg" alt="" />
              <div><h2>Offline Pack</h2><small>Works through weak network</small></div>
            </div>
            <p>Progress stays on this phone and syncs automatically when internet returns.</p>
            <button type="button" className="hunt-v2-secondary" onClick={() => navigate(CAMPUS_HUNT_PATHS.offline)}>Open Offline Pack</button>
            <div className="hunt-v2-mode-tags"><span>NO SIGNAL</span><span>AUTO SYNC</span></div>
          </section>
        </div>
      </div>
    </HuntPageShell>
  );
}
