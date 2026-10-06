import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CAMPUS_HUNT_PATHS } from '../config';
import useHuntAuth from '../hooks/useHuntAuth';
import { readHuntSession } from '../utils/huntSession';
import { fetchEventBySlug } from '../services/campusHunt.api';
import {
  HuntPageShell,
  HuntPrimaryButton,
  HuntSectionLabel,
  MissionProgress,
} from '../components/HuntV2Shell';

function eventDateLabel(value) {
  if (!value) return '24 Oct';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '24 Oct';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(date);
}

export default function CampusHuntLandingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isHuntAuthenticated } = useHuntAuth();
  const saved = readHuntSession();
  const [event, setEvent] = useState(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const sameEvent = saved?.slug && slug && saved.slug === slug;
  const continuePlay = CAMPUS_HUNT_PATHS.play(slug);

  useEffect(() => {
    let cancelled = false;
    fetchEventBySlug(slug)
      .then((response) => {
        if (!cancelled) setEvent(response.data?.event || null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [slug]);

  const dateLabel = useMemo(() => eventDateLabel(event?.date), [event?.date]);
  const eventName = event?.name || 'CTRL Hunt';
  const college = event?.college || 'MIT-WPU';
  const teamSize = Number(event?.teamSize) || 4;

  const share = async () => {
    const payload = { title: eventName, text: `Join ${eventName}`, url: window.location.href };
    if (navigator.share) {
      await navigator.share(payload).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(window.location.href).catch(() => {});
  };

  return (
    <HuntPageShell>
      <div className="hunt-v2-page">
        <section className="hunt-v2-hero">
          <img src="/campus-hunt/v2/hunt-hero.png" alt="Students solving the campus hunt together" />
          <div className="hunt-v2-hero-actions">
            <button type="button" onClick={() => navigate(-1)} aria-label="Go back">‹</button>
            <button type="button" onClick={() => void share()}>Share</button>
          </div>
          <span className="hunt-v2-open-chip">REGISTRATION OPEN</span>
        </section>

        <div className="hunt-v2-detail">
          <MissionProgress label="Mission brief" step={2} />
          <div className="hunt-v2-tags"><span>CAMPUS HUNT</span><span>INTERCOLLEGE</span></div>
          <h1 className="hunt-v2-title">{eventName}</h1>
          <p className="hunt-v2-subtitle">Race. Solve. Scan. Win.</p>
          <p className="hunt-v2-status">Registration open • game access from your team link</p>
          <HuntSectionLabel>Mission brief</HuntSectionLabel>

          <div className="hunt-v2-stats">
            {[
              [dateLabel, 'Date'],
              ['10:00 AM', 'Start'],
              [`${teamSize} players`, 'Team'],
              ['Live', 'Score'],
            ].map(([value, label]) => (
              <div key={label} className="hunt-v2-card hunt-v2-stat"><strong>{value}</strong><small>{label}</small></div>
            ))}
          </div>

          <img src="/campus-hunt/v2/route-accent.svg" alt="" className="hunt-v2-route" />

          <section className="hunt-v2-card hunt-v2-card-accent hunt-v2-info-card">
            <div className="hunt-v2-info-title"><img src="/campus-hunt/v2/meet-here.svg" alt="" /><span>Meet here</span></div>
            <p>{college} • Main Campus Lawn</p>
            <small>Report by 9:30 AM</small>
          </section>

          <h2 className="text-lg font-extrabold">How it works</h2>
          <HuntSectionLabel>Mission path</HuntSectionLabel>
          <div className="hunt-v2-steps">
            {[
              ['01', 'Check in', 'Meet your team and verify college IDs.'],
              ['02', 'Solve & move', 'Follow clues and reach each checkpoint.'],
              ['03', 'Finish fast', 'Complete the hunt and lock your score.'],
            ].map(([number, title, copy]) => (
              <div key={number} className="hunt-v2-card hunt-v2-step">
                <b>{number}</b><div><strong>{title}</strong><small>{copy}</small></div>
              </div>
            ))}
          </div>

          <section className="hunt-v2-card hunt-v2-card-accent hunt-v2-expect">
            <div className="hunt-v2-expect-head">
              <img src="/campus-hunt/v2/route-icon.svg" alt="" />
              <div><strong>What to expect</strong><small>A quick feel for how CTRL Hunt plays.</small></div>
            </div>
            <div className="hunt-v2-expect-grid">
              {[
                ['/campus-hunt/v2/campus-map.svg', 'Campus-wide', 'play area'],
                ['/campus-hunt/v2/puzzle.svg', 'Riddles + Tasks', 'challenges'],
                ['/campus-hunt/v2/phone.svg', 'Online / Offline', 'play mode'],
              ].map(([icon, title, copy]) => (
                <div key={title} className="hunt-v2-card hunt-v2-expect-item"><img src={icon} alt="" /><strong>{title}</strong><small>{copy}</small></div>
              ))}
            </div>
          </section>

          <section className="hunt-v2-card hunt-v2-info-card">
            <strong>Before you play</strong>
            <small>Valid college ID • charged phone • one team captain</small>
          </section>
          <button type="button" className="hunt-v2-secondary" onClick={() => setRulesOpen((open) => !open)}>
            {rulesOpen ? 'Hide Rules & Eligibility' : 'View Rules & Eligibility'}
          </button>
          {rulesOpen ? (
            <section className="hunt-v2-card hunt-v2-info-card text-sm text-[color:var(--hunt-muted)]">
              <strong className="text-[color:var(--hunt-ink)]">Quick eligibility</strong>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Carry a valid college ID.</li>
                <li>Use one charged leader phone per team.</li>
                <li>Follow checkpoint and organizer safety instructions.</li>
              </ul>
            </section>
          ) : null}
        </div>

        <div className="hunt-v2-sticky">
          <div className="hunt-v2-sticky-inner">
            <div className="hunt-v2-price"><strong>{sameEvent ? saved?.teamCode : 'Team'}</strong><small>{sameEvent ? 'saved on phone' : 'leader access'}</small></div>
            <HuntPrimaryButton onClick={() => navigate(isHuntAuthenticated && sameEvent ? continuePlay : CAMPUS_HUNT_PATHS.profileLogin)}>
              {isHuntAuthenticated && sameEvent ? 'Continue Hunt' : 'Enter Team'}
            </HuntPrimaryButton>
          </div>
        </div>
      </div>
    </HuntPageShell>
  );
}
