import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Download,
  Gamepad2,
  GraduationCap,
  MapPin,
  Moon,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Trophy,
  Sun,
  Users,
  Wallet,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '../../context/AuthContext';
import { useDarkMode } from '../../context/DarkModeContext';
import { useNotifications } from '../../context/NotificationsContext';
import Dashboard from '../../pages/home/Dashboard';
import AppLogo from '../../components/AppLogo';
import CategorySearchRow from '../../components/CategorySearchRow';
import HomeCategoryBar from '../../components/HomeCategoryBar';
import MobileHeroSearchField from '../../components/MobileHeroSearchField';
import MobileStickyHeader from '../../components/MobileStickyHeader';
import { useInAppBack } from '../../hooks/useInAppBack';
import { openPaymentCheckout } from '../../utils/usePaymentCheckout';
import { verifyPaymentWithRetry } from '../../utils/paymentNavigation';
import { navigateToSearchResult } from '../../utils/searchNavigation';
import { fetchCampusHuntColleges } from '../campus-hunt/services/campusHunt.api';
import { API_BASE_URL } from '../../services/api/client';
import {
  claimGameInvite,
  createGamePaymentOrder,
  getCachedRankings,
  getCollegeProfile,
  getGame,
  getGamePass,
  getRankings,
  createMyGameDispute,
  listColleges,
  listGames,
  reportGame,
  requestMyGameRefund,
  reserveGame,
  submitHostGame,
} from './api';
import './collegePlatform.css';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const MIT_WPU_CAMPUS_HUNT = {
  id: 'mit-wpu-campus-hunt-coming-soon',
  title: 'Campus Hunt: MIT-WPU',
  coverImage: '/campus-hunt/v2/mit-wpu-hunt.svg',
  venue: 'MIT-WPU',
  city: 'Pune',
  teamSize: 4,
  capacity: 40,
};

function formatDate(value, options = {}) {
  if (!value) return 'Date to be announced';
  return new Intl.DateTimeFormat('en-IN', {
    weekday: options.short ? undefined : 'short',
    day: 'numeric',
    month: 'short',
    year: options.year === false ? undefined : 'numeric',
    hour: options.time === false ? undefined : 'numeric',
    minute: options.time === false ? undefined : '2-digit',
  }).format(new Date(value));
}

function Page({ children, className = '' }) {
  const { isDark } = useDarkMode();
  return <main className={`college-page ${isDark ? 'college-page--dark' : ''} ${className}`}>{children}</main>;
}

function BrandHeader({ title, back = false, icon: Icon }) {
  const navigate = useNavigate();
  return (
    <header className="college-header">
      {back ? (
        <button type="button" className="college-icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft size={20} />
        </button>
      ) : null}
      <h1>{title}</h1>
      <span className="college-brand">Ctrl.</span>
      {Icon ? <Icon className="college-header-icon" size={28} /> : null}
    </header>
  );
}

function EmptyState({ title, text, action }) {
  return (
    <div className="college-empty">
      <Trophy size={32} />
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}

function GameCard({ game }) {
  const completed = game.status === 'completed';
  const leaderboardPath = game.engine?.eventId
    ? `/campus-hunt/leaderboard?college=${encodeURIComponent(game.hostCollege?.shortName || game.hostCollege?.name || '')}&event=${encodeURIComponent(game.engine.eventId)}`
    : `/rankings?game=${encodeURIComponent(game.id)}`;
  const detailPath = game.directoryFallback ? leaderboardPath : `/games/${game.slug || game.id}`;
  return (
    <article className="college-game-card">
      <Link to={detailPath} className="college-game-card__main">
        <div className="college-card-media">
          {game.coverImage ? <img src={game.coverImage} alt="" /> : <div className="college-media-placeholder"><Trophy size={42} /></div>}
          <span className={`college-status-chip${completed ? ' college-status-chip--completed' : ''}`}>{completed && <Check size={12} />}{completed ? 'Mission complete' : game.spotsLeft > 0 ? 'Registration open' : 'Full'}</span>
          <span className="college-game-card__teams"><Users size={13} />{game.capacity || 0} teams</span>
          <div className="college-game-card__media-shade" />
        </div>
        <div className="college-card-body">
          <h3>{game.title}</h3>
          <p className="college-game-card__venue"><MapPin size={14} />{game.hostCollege?.shortName || game.hostCollege?.name || game.venue}{game.city ? ` · ${game.city}` : ''}</p>
          <div className="college-game-card__facts">
            <span><CalendarDays size={14} />{formatDate(game.startsAt, { time: false })}</span>
            <span><Users size={14} />Team of {game.teamSize}</span>
            {!completed && <strong>{money(game.feePerTeam)} / team</strong>}
          </div>
        </div>
      </Link>
      {completed && <Link className="college-game-card__leaderboard" to={leaderboardPath}><Trophy size={16} />View leaderboard<ChevronRight size={16} /></Link>}
    </article>
  );
}

function ComingSoonGameCard({ game }) {
  return (
    <article className="college-game-card college-game-card--coming-soon">
      <div className="college-game-card__main">
        <div className="college-card-media">
          <img src={game.coverImage} alt="" />
          <span className="college-status-chip college-status-chip--soon"><Sparkles size={12} />Coming soon</span>
          <span className="college-game-card__teams"><Users size={13} />{game.capacity} teams</span>
          <div className="college-game-card__media-shade" />
        </div>
        <div className="college-card-body">
          <h3>{game.title}</h3>
          <p className="college-game-card__venue"><MapPin size={14} />{game.venue} · {game.city}</p>
          <div className="college-game-card__facts">
            <span><CalendarDays size={14} />Date coming soon</span>
            <span><Users size={14} />Team of {game.teamSize}</span>
            <strong>Entry fee TBA</strong>
          </div>
        </div>
      </div>
      <div className="college-game-card__interest"><Sparkles size={16} />Pre-register your team name · opening soon</div>
    </article>
  );
}

function HomeFestCard({ fest }) {
  const id = fest.slug || fest._id || fest.id;
  const image = fest.coverImage || fest.coverImages?.[0]?.url || fest.coverImages?.[0];
  return (
    <Link to={`/view-details/${id}`} className="college-fest-card">
      <div className="college-fest-image">{image ? <img src={image} alt="" /> : <GraduationCap size={34} />}</div>
      <strong>{fest.festName || fest.title}</strong>
      <span>{fest.collegeName || fest.venue || 'College fest'}</span>
    </Link>
  );
}

function HomeCompetitionCard({ competition }) {
  return (
    <Link to={`/competitions-view-details/${competition._id || competition.id}`} className="college-fest-card">
      <div className="college-fest-image">{competition.coverImage ? <img src={competition.coverImage} alt="" /> : <Trophy size={34} />}</div>
      <strong>{competition.name}</strong>
      <span>{competition.festName || competition.competitionType || 'College competition'}</span>
    </Link>
  );
}

export function CollegeHomePage() {
  return <Dashboard />;
}

export function GamesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const goBack = useInAppBack();
  const { isDark } = useDarkMode();
  const { unreadCount } = useNotifications();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [mode, setMode] = useState('');
  const [heroBurstKey, setHeroBurstKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await listGames({ q: query, mode });
        if (!cancelled) setGames(data.games || []);
      } catch {
        try {
          const directory = await fetchCampusHuntColleges();
          const normalizedQuery = query.trim().toLowerCase();
          const completedHunts = (directory.data?.colleges || []).flatMap((college) => (
            (college.events || [])
              .filter((event) => event.leaderboardLive && event.date && new Date(event.date) < new Date())
              .map((event) => ({
                id: event.id,
                slug: event.slug,
                title: `${college.college} ${event.name}`,
                tagline: 'A clue hunt. A campus. Your crew.',
                coverImage: '/campus-hunt/v2/hunt-hero.png',
                venue: college.college,
                city: '',
                hostCollege: { name: college.college, shortName: college.college },
                participationMode: 'on_campus',
                startsAt: event.date,
                teamSize: event.slug === 'coep-campus-hunt' ? 8 : 4,
                capacity: event.teamCapacity,
                spotsLeft: 0,
                feePerTeam: 0,
                status: 'completed',
                directoryFallback: true,
                engine: { type: 'campus_hunt', eventId: event.id, eventSlug: event.slug },
              }))
          )).filter((game) => (
            mode !== 'intercollege'
            && (!normalizedQuery || `${game.title} ${game.venue}`.toLowerCase().includes(normalizedQuery))
          ));
          if (!cancelled) setGames(completedHunts);
        } catch {
          if (!cancelled) setGames([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query, mode]);

  const gamesSearchQuickPicks = useMemo(() => games.slice(0, 10).map((game) => ({
    id: game.id,
    slug: game.slug,
    title: game.title,
    subtitle: game.hostCollege?.shortName || game.hostCollege?.name || game.venue,
    description: game.tagline || game.description,
    image: game.coverImage,
    resultType: 'game',
  })), [games]);

  const gamesKeywordCatalog = useMemo(() => Array.from(new Set(games.flatMap((game) => [
    game.title,
    game.city,
    game.venue,
    game.hostCollege?.name,
    game.hostCollege?.shortName,
  ]).filter(Boolean))).slice(0, 48), [games]);

  const handleGamesSearchNavigate = useCallback(
    (result) => navigateToSearchResult(navigate, result),
    [navigate],
  );

  const showMitWpuPreview = mode !== 'intercollege'
    && (!query.trim() || 'campus hunt mit-wpu pune'.includes(query.trim().toLowerCase()));
  const upcomingGames = useMemo(() => games.filter((game) => game.status !== 'completed'), [games]);
  const completedGames = useMemo(() => games.filter((game) => game.status === 'completed'), [games]);
  const upcomingCount = upcomingGames.length + (showMitWpuPreview ? 1 : 0);

  return (
    <div className="crwdctrl-page games-page min-h-screen">
      <MobileStickyHeader
        isDark={isDark}
        shellClassName="games-page-header"
        brandingRow={
          <>
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={goBack}
                className={`p-2 rounded-xl bg-transparent transition-colors shrink-0 ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-black/5'}`}
                aria-label="Back to home"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <AppLogo className="cursor-pointer" onClick={() => navigate('/')} />
            </div>
            <div className="mobile-header-actions">
              <button
                type="button"
                onClick={() => navigate('/')}
                className={`p-2 rounded-xl bg-transparent transition-colors ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-black/5'}`}
                aria-label="Location"
              >
                <MapPin className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/notifications')}
                className={`relative p-2 rounded-xl bg-transparent transition-colors ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-black/5'}`}
                aria-label="Notifications"
              >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
              </button>
            </div>
          </>
        }
        searchRow={
          <CategorySearchRow isDark={isDark}>
            <MobileHeroSearchField
              isDark={isDark}
              placeholder="search games, colleges"
              quickPickItems={gamesSearchQuickPicks}
              keywordCatalog={gamesKeywordCatalog}
              onResultNavigate={handleGamesSearchNavigate}
            />
          </CategorySearchRow>
        }
        categoryBar={<HomeCategoryBar isDark={isDark} activeCategory="games" noPadding />}
      />

      <Page>
        <div className="hidden lg:block"><BrandHeader title="CrwdCtrl Games" /></div>
        <section className="college-filter-panel college-games-hero">
          <div className="college-games-hero__headline">
            <div><span>CrwdCtrl / Games</span><h1>Play <em>offline.</em></h1></div>
            <button
              type="button"
              className="college-games-hero__mark"
              aria-label="Animate game bubbles"
              onClick={() => setHeroBurstKey((value) => value + 1)}
            >
              <b>01</b>
              <Gamepad2 size={30} />
              {heroBurstKey > 0 && (
                <span key={heroBurstKey} className="college-games-hero__bubbles" aria-hidden="true">
                  {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
                </span>
              )}
            </button>
          </div>
          <label className="college-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games or colleges" /></label>
          <div className="college-chips">
            {[['', 'All games'], ['on_campus', 'On campus'], ['intercollege', 'Intercollege']].map(([value, label]) => (
              <button type="button" key={label} className={mode === value ? 'is-active' : ''} onClick={() => setMode(value)}>{label}</button>
            ))}
          </div>
        </section>
        <section className="college-content">
          <div className="college-games-section-title">
            <div><h2>Upcoming</h2></div>
            <b>{upcomingCount}</b>
          </div>
          {loading ? <div className="college-skeleton college-skeleton--card" /> : upcomingCount || completedGames.length ? (
            <>
              {upcomingCount > 0 && <div className="college-game-stack">{showMitWpuPreview ? <ComingSoonGameCard game={MIT_WPU_CAMPUS_HUNT} /> : null}{upcomingGames.map((game) => <GameCard key={game.id} game={game} />)}</div>}
              {upcomingCount === 0 && (
                <div className="college-next-drop"><Sparkles size={20} /><strong>New games coming soon</strong></div>
              )}
              {completedGames.length > 0 && (
                <section className="college-completed-games">
                  <div className="college-games-section-title college-games-section-title--completed">
                    <div><h2>Completed</h2></div>
                    <Trophy size={20} />
                  </div>
                  <div className="college-game-stack">{completedGames.map((game) => <GameCard key={game.id} game={game} />)}</div>
                </section>
              )}
            </>
          ) : <EmptyState title="No games found" text="Try another filter or check back when a real Campus Hunt opens." />}
          <div className="college-idea-card college-host-game-card">
            <span className="college-host-game-card__icon"><Sparkles size={22} /></span>
            <div><strong>Got a game?</strong></div>
            <Link to="/host-a-game">Host it<ChevronRight size={16} /></Link>
          </div>
        </section>
      </Page>
    </div>
  );
}

export function GameDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { getGame(id).then((data) => setGame(data.game)).catch((err) => setError(err.message)); }, [id]);
  if (error) return <Page><BrandHeader title="Game" back /><EmptyState title="Game unavailable" text={error} /></Page>;
  if (!game) return <Page><div className="college-skeleton college-skeleton--hero" /></Page>;
  const completed = game.status === 'completed';
  const leaderboardPath = game.engine?.eventId
    ? `/campus-hunt/leaderboard?college=${encodeURIComponent(game.hostCollege?.shortName || game.hostCollege?.name || '')}&event=${encodeURIComponent(game.engine.eventId)}`
    : `/rankings?game=${encodeURIComponent(game.id)}`;
  return (
    <Page>
      <div className="college-detail-hero">
        {game.coverImage ? <img src={game.coverImage} alt="" /> : <div className="college-media-placeholder"><Trophy size={54} /></div>}
        <button className="college-hero-action college-hero-back" onClick={() => navigate(-1)}><ArrowLeft /></button>
        <button className="college-hero-action college-hero-share" onClick={() => navigator.share?.({ title: game.title, url: window.location.href })}><Share2 /></button>
      </div>
      <section className="college-detail-body">
        <div className="college-chips"><span className="is-active">CrwdCtrl Games</span><span>{game.participationMode === 'intercollege' ? 'Intercollege' : 'On campus'}</span></div>
        <h1>{game.title}</h1>
        <p>{game.tagline}</p>
        <p className="college-accent-text">{completed ? 'Game completed · Final leaderboard available' : game.spotsLeft > 0 ? 'Registration open' : 'Registration full'}{!completed && game.registrationClosesAt ? ` · Closes ${formatDate(game.registrationClosesAt)}` : ''}</p>
        <div className="college-detail-list">
          <div><CalendarDays /><span><strong>{formatDate(game.startsAt)}</strong><small>{game.endsAt ? `Until ${formatDate(game.endsAt)}` : 'Check-in time will appear on your pass'}</small></span></div>
          <div><MapPin /><span><strong>{game.venue || game.city}</strong><small>{game.meetingPoint || 'Meeting point will appear on your pass'}</small></span></div>
          <div><Users /><span><strong>{game.teamSize} students · 1 college · 1 team</strong><small>{game.participationMode === 'intercollege' ? 'Open to approved college teams' : 'For the host campus'}</small></span></div>
          <div><Wallet /><span><strong>{money(game.feePerTeam)} per team</strong><small>One captain pays for the team</small></span></div>
        </div>
        <h2>About the game</h2><p>{game.description || 'A real-world campus experience built for college teams.'}</p>
        {game.steps?.length ? <><h2>How it works</h2><div className="college-step-list">{game.steps.map((step, index) => <div key={step}><b>{String(index + 1).padStart(2, '0')}</b><span>{step}</span></div>)}</div></> : null}
        {game.rules?.length ? <><h2>Keep it fair. Keep it fun.</h2><ul className="college-rules">{game.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul></> : null}
      </section>
      <div className="college-sticky-action">
        <span><small>{completed ? 'Event status' : 'Per team'}</small><strong>{completed ? 'Completed' : money(game.feePerTeam)}</strong></span>
        <Link className="college-primary-button" to={completed ? leaderboardPath : `/games/${game.id}/register`}>{completed ? 'View Leaderboard' : 'Register Team'}</Link>
      </div>
    </Page>
  );
}

export function TeamRegistrationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [game, setGame] = useState(null);
  const [colleges, setColleges] = useState([]);
  const [form, setForm] = useState({ collegeId: '', teamName: '', captainPhone: '', members: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getGame(id), listColleges()]).then(([gameData, collegeData]) => {
      const nextGame = gameData.game;
      setGame(nextGame);
      setColleges(collegeData.colleges || []);
      setForm((current) => ({ ...current, members: Array.from({ length: Math.max(1, nextGame.teamSize - 1) }, (_, index) => current.members[index] || { name: '', email: '' }) }));
    }).catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    const orderId = new URLSearchParams(location.search).get('order_id');
    if (!orderId) return;
    setBusy(true);
    verifyPaymentWithRetry(API_BASE_URL, orderId, { kind: 'fest', search: location.search }).then((result) => {
      const registrationId = result.data?.recovery?.registrationId;
      if (result.verified && result.data?.registrationStatus === 'manual_review') navigate('/booking', { replace: true });
      else if (result.verified && registrationId) navigate(`/game-pass/${registrationId}`, { replace: true });
      else setError(result.data?.message || 'Payment is still confirming. Check Bookings before paying again.');
    }).finally(() => setBusy(false));
  }, [location.search, navigate]);

  const updateMember = (index, field, value) => setForm((current) => ({ ...current, members: current.members.map((member, memberIndex) => memberIndex === index ? { ...member, [field]: value } : member) }));

  const submit = async (event) => {
    event.preventDefault();
    if (!isAuthenticated) { navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`); return; }
    setBusy(true); setError('');
    try {
      const reservation = await reserveGame(game.id, { ...form, captainName: user?.name });
      if (reservation.free) { navigate(`/game-pass/${reservation.registration.id}`); return; }
      const order = await createGamePaymentOrder(game.id, reservation.registration.id);
      const checkout = await openPaymentCheckout({
        ...order,
        returnPath: location.pathname,
        entityType: 'game_registration',
        customerName: user?.name,
        customerEmail: user?.email,
        customerPhone: form.captainPhone,
        displayName: `${game.title} team registration`,
      });
      if (checkout?.redirectDeferred) return;
      const verified = await verifyPaymentWithRetry(API_BASE_URL, order.orderId, { kind: 'fest', paymentId: checkout?.paymentDetails?.paymentId });
      const registrationId = verified.data?.recovery?.registrationId || reservation.registration.id;
      if (!verified.verified) throw new Error(verified.data?.message || 'Payment is still confirming. Do not pay again.');
      if (verified.data?.registrationStatus === 'manual_review') { navigate('/booking'); return; }
      navigate(`/game-pass/${registrationId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <BrandHeader title="Team Registration" back />
      <form className="college-form college-content" onSubmit={submit}>
        <div className="college-progress-card"><div><span>Team details</span><span>Step 1/2</span></div><i><b /></i><strong>{game?.title || 'Game'}</strong><small>{game ? `${formatDate(game.startsAt)} · Team of ${game.teamSize}` : ''}</small></div>
        <h2>Represent your college</h2>
        <label>College *<select value={form.collegeId} onChange={(event) => setForm({ ...form, collegeId: event.target.value })} required><option value="">Select approved college</option>{colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}</select></label>
        <p className="college-verify-note"><BadgeCheck size={17} /> Captain must use the selected college email domain.</p>
        <label>Team name *<input value={form.teamName} onChange={(event) => setForm({ ...form, teamName: event.target.value })} required /></label>
        <h2>Captain details</h2>
        <label>Full name<input value={user?.name || ''} disabled /></label>
        <label>E-mail ID<input value={user?.email || ''} disabled /></label>
        <label>Contact No. *<input value={form.captainPhone} onChange={(event) => setForm({ ...form, captainPhone: event.target.value })} required /></label>
        <h2>Your teammates</h2>
        <p className="college-muted">They can verify after payment, but the team cannot check in until everyone is verified.</p>
        {form.members.map((member, index) => <div className="college-member-card" key={index}><strong>Teammate {index + 1}</strong><input placeholder="Full name" value={member.name} onChange={(event) => updateMember(index, 'name', event.target.value)} required /><input type="email" placeholder="College email" value={member.email} onChange={(event) => updateMember(index, 'email', event.target.value)} required /></div>)}
        <div className="college-fee-card"><span>Team entry</span><strong>{money(game?.feePerTeam)}</strong><b>Total payable</b><b>{money(game?.feePerTeam)}</b></div>
        {error ? <p className="college-error">{error}</p> : null}
        <button className="college-primary-button" disabled={busy}>{busy ? 'Please wait…' : game?.feePerTeam > 0 ? `Proceed to Pay · ${money(game.feePerTeam)}` : 'Confirm Team'}</button>
      </form>
    </Page>
  );
}

export function GamePassPage() {
  const { id } = useParams();
  const [registration, setRegistration] = useState(null);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [support, setSupport] = useState({ announcements: [], refundRequests: [], disputes: [], huntAccess: null });
  const loadPass = useCallback(() => { getGamePass(id).then((data) => { setRegistration(data.registration); setSupport({ announcements: data.announcements || [], refundRequests: data.refundRequests || [], disputes: data.disputes || [], huntAccess: data.huntAccess || null }); }).catch((err) => setError(err.message)); }, [id]);
  useEffect(() => { loadPass(); }, [loadPass]);
  useEffect(() => { if (registration?.qrToken) QRCode.toDataURL(registration.qrToken, { width: 220, margin: 1 }).then(setQr); }, [registration]);
  if (error) return <Page><BrandHeader title="Game Pass" back /><EmptyState title="Pass unavailable" text={error} /></Page>;
  if (!registration) return <Page><BrandHeader title="Game Pass" back /><div className="college-skeleton college-skeleton--card" /></Page>;
  const game = registration.game;
  return (
    <Page>
      <BrandHeader title="Game Pass" back />
      <section className="college-content college-pass-page">
        <div className="college-confirmation"><span><Check /></span><h1>You’re in, {registration.teamName}!</h1><p>Your team is registered. See you on campus.</p></div>
        <article className="college-pass-card">
          {game.coverImage ? <img className="college-pass-cover" src={game.coverImage} alt="" /> : null}
          <div className="college-pass-content"><div className="college-pass-brand"><span>Ctrl.</span><b>{registration.status.replace('_', ' ')}</b></div><h2>{game.title}</h2>
            <p><CalendarDays /> {formatDate(game.startsAt)}</p><p><MapPin /> {game.venue || game.city}</p><hr />
            <h3>{registration.teamName}</h3><p>{registration.college.name}</p><p>Captain: {registration.captainName} · {registration.members.length + 1} students</p><small>Pass ID: {registration.passId}</small>
            {qr ? <img className="college-pass-qr" src={qr} alt="Team check-in QR" /> : null}<strong className="college-pass-show">Show this pass at check-in</strong><small>One pass for the whole team</small>
            <div className="college-pass-payment"><span>Payment complete</span><b>{money(registration.amountPaid)}</b></div>
          </div>
        </article>
        {!registration.allMembersVerified ? <div className="college-warning"><ShieldCheck /><div><strong>Teammate verification pending</strong><p>Every teammate must claim their invite before check-in.</p></div></div> : null}
        {support.huntAccess ? <div className="college-info-card"><strong>Campus Hunt access</strong><p>Team code: <b>{support.huntAccess.teamCode}</b><br />Password: <b>{support.huntAccess.password}</b></p><small>Use online play when the network is stable. Install the offline pack once before game day for weak or unavailable network.</small>{support.huntAccess.onlinePath ? <Link className="college-primary-button" to={support.huntAccess.onlinePath}>Play online</Link> : null}{support.huntAccess.offlineInstallPath ? <Link className="college-secondary-button" to={support.huntAccess.offlineInstallPath}>Install offline pack</Link> : <div className="college-offline-note">Offline pack appears here after the organizer locks the final roster.</div>}</div> : null}
        {support.announcements.length ? <div className="college-info-card"><strong>Host announcements</strong>{support.announcements.map((item) => <p key={item._id}><b>{item.title}</b><br />{item.message}</p>)}</div> : null}
        {support.refundRequests.map((item) => <div className="college-info-card" key={item._id}><strong>Refund · {item.status}</strong><p>{item.reason}</p></div>)}
        {support.disputes.map((item) => <div className="college-info-card" key={item._id}><strong>Result dispute · {item.status}</strong><p>{item.reason}{item.resolution ? ` · ${item.resolution}` : ''}</p></div>)}
        <button className="college-primary-button" onClick={() => window.print()}><Download size={18} /> Download Game Pass</button>
        {game.engine?.eventSlug ? <Link className="college-secondary-button" to={`/campus-hunt/${game.engine.eventSlug}`}>Prepare for {game.title}</Link> : null}
        {!support.refundRequests.some((item) => ['pending', 'approved', 'processing', 'refunded'].includes(item.status)) && !['cancelled'].includes(registration.status) ? <button className="college-secondary-button" onClick={async () => { const reason = window.prompt('Why are you requesting a full registration refund?'); if (!reason) return; try { await requestMyGameRefund(registration.id, reason); await loadPass(); } catch (err) { setError(err.message); } }}>Request full refund</button> : null}
        {game.status === 'completed' && !support.disputes.some((item) => item.status === 'open') ? <button className="college-secondary-button" onClick={async () => { const reason = window.prompt('Describe the result issue'); if (!reason) return; try { await createMyGameDispute(registration.id, reason); await loadPass(); } catch (err) { setError(err.message); } }}>Dispute result within 48 hours</button> : null}
        <button className="college-secondary-button" onClick={async () => { const type = window.prompt('Issue type: host, content, safety, payment, cancellation', 'host'); const message = window.prompt('Describe the issue'); if (!type || !message) return; try { await reportGame(game.id, type, message); } catch (err) { setError(err.message); } }}>Report an issue</button>
      </section>
    </Page>
  );
}

export function RankingsPage() {
  const [data, setData] = useState(() => getCachedRankings() || { colleges: [], teams: [] });
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const refresh = () => getRankings().then((next) => { setData(next); setOffline(false); }).catch(() => setOffline(true));
    refresh();
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    return () => { window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh); };
  }, []);
  return (
    <Page>
      <BrandHeader title="Rankings" icon={Trophy} />
      <section className="college-content college-rankings">
        <h1>Show up. Move up.</h1><p>Every game is a chance to represent your college.</p>
        {offline ? <div className="college-offline-note">Offline · Showing the last saved standings. Rankings update after reconnecting.</div> : null}
        <p className="college-muted">Best three teams per college count in each finalized game.</p>
        <h2>College standings</h2>
        {data.colleges?.map((row) => <div className="college-standing-row" key={row.collegeId}><span>{row.rank}</span><div><strong>{row.collegeName}</strong><small>{row.teams} teams · {row.wins} wins</small></div><b>{row.points}<small> pts</small></b></div>)}
        {!data.colleges?.length ? <EmptyState title="No finalized standings" text="Rankings appear after organizers finalize the first real game." /> : null}
        <h2>Team standings</h2>
        {data.teams?.map((row) => <div className="college-standing-row" key={`${row.collegeId}-${row.teamName}`}><span>{row.rank}</span><div><strong>{row.teamName}</strong><small>{row.collegeName} · {row.games} games</small></div><b>{row.points}<small> pts</small></b></div>)}
        <div className="college-info-card"><strong>How points work</strong><p>Placements award 100, 80, 60, then descend by 10 to a 10-point floor. College totals use their best three teams per game.</p></div>
      </section>
    </Page>
  );
}

export function CrwdCtrlIdPage() {
  const { user, logout } = useAuth();
  const { isDark, toggleDarkMode } = useDarkMode();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  useEffect(() => { getCollegeProfile().then((data) => setProfile(data.profile)).catch(() => setProfile(null)); }, []);
  if (!user) return <Page><BrandHeader title="CrwdCtrl ID" /><EmptyState title="Sign in to continue" text="Your college identity, teams and passes live here." action={<Link className="college-primary-button" to="/login?redirect=/profile">Sign in</Link>} /></Page>;
  const shown = profile || { name: user.name, email: user.email, profilePic: user.profilePic, college: user.college ? { name: user.college } : null, crwdCtrlId: `CC-ST-${String(user._id || user.id || '').slice(-6).toUpperCase()}`, gamesPlayed: 0, teamPoints: 0 };
  const actions = [
    ['Edit profile', '/edit-profile'],
    ['My passes & registrations', '/booking'],
    ['Favourites', '/favorites'],
    ['College rankings', '/rankings'],
    ['Notifications', '/notifications'],
    ['Help Center', '/help-center'],
  ];
  return (
    <Page>
      <BrandHeader title="CrwdCtrl ID" icon={BadgeCheck} />
      <section className="college-content college-id-page">
        <article className="college-id-card"><div className="college-id-person">{shown.profilePic ? <img src={shown.profilePic} alt="" /> : <span>{shown.name?.[0]}</span>}<div><h2>{shown.name}</h2><p>Student · {shown.email}</p><small>ID: {shown.crwdCtrlId}</small></div></div><hr /><h3>{shown.college?.name || 'Add your college'}</h3>{shown.collegeVerifiedAt ? <p className="college-verify-note"><BadgeCheck /> College email verified</p> : <p className="college-muted">Verify through an approved college email when registering for a game.</p>}</article>
        <h2>Your campus life</h2><div className="college-stat-grid"><div><b>{shown.gamesPlayed || 0}</b><span>Games played</span></div><div><b>{shown.teamPoints || 0}</b><span>Team points</span></div><div><b>{profile?.activeRegistration ? 1 : 0}</b><span>Active teams</span></div></div>
        {profile?.activeRegistration ? <div className="college-team-summary"><Users /><div><h3>{profile.activeRegistration.teamName}</h3><p>Your active CrwdCtrl team</p></div><Link to={`/game-pass/${profile.activeRegistration.id}`}>View pass</Link></div> : null}
        <div className="college-profile-actions">{actions.map(([label, path]) => <Link to={path} key={path}><span>{label}</span><ChevronRight /></Link>)}</div>
        <button type="button" className="college-theme-switch" onClick={toggleDarkMode} aria-pressed={isDark}>
          <span>{isDark ? <Moon /> : <Sun />}<span>Appearance</span></span>
          <b>{isDark ? 'Dark' : 'Light'}</b>
        </button>
        <button className="college-secondary-button" onClick={async () => { await logout(); navigate('/'); }}>Log Out</button>
      </section>
    </Page>
  );
}

export function HostGamePage() {
  const { user } = useAuth();
  const collegeName = typeof user?.college === 'string' ? user.college : user?.college?.name || '';
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    collegeName,
    clubName: '',
    contactRole: '',
    city: '',
    gameName: '',
    gameIdea: '',
    expectedTeams: '',
    preferredDate: '',
  });
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const updateField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');
    try {
      const response = await submitHostGame({
        ...form,
        expectedTeams: form.expectedTeams ? Number(form.expectedTeams) : null,
      });
      setStatus(`Request sent · ${response.requestId}`);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page className="college-host-page">
      <BrandHeader title="Host a Game" back />
      <form className="college-form college-content college-host-form" onSubmit={submit}>
        <div className="college-host-form__intro">
          <span>Campus proposal</span>
          <h1>Host a game at your college.</h1>
        </div>
        <div className="college-host-form__grid">
          <label>Your name *<input value={form.name} onChange={updateField('name')} required /></label>
          <label>Email *<input type="email" value={form.email} onChange={updateField('email')} required /></label>
          <label>Phone<input type="tel" value={form.phone} onChange={updateField('phone')} /></label>
          <label>City *<input value={form.city} onChange={updateField('city')} required /></label>
          <label>College name *<input value={form.collegeName} onChange={updateField('collegeName')} required /></label>
          <label>Club / student body *<input value={form.clubName} onChange={updateField('clubName')} required /></label>
          <label>Your role<input placeholder="President, coordinator…" value={form.contactRole} onChange={updateField('contactRole')} /></label>
          <label>Expected teams<input type="number" min="1" inputMode="numeric" value={form.expectedTeams} onChange={updateField('expectedTeams')} /></label>
          <label className="college-host-form__wide">Game name *<input value={form.gameName} onChange={updateField('gameName')} required /></label>
          <label className="college-host-form__wide">Game idea *<textarea value={form.gameIdea} onChange={updateField('gameIdea')} required rows={4} /></label>
          <label className="college-host-form__wide">Preferred date<input type="date" value={form.preferredDate} onChange={updateField('preferredDate')} /></label>
        </div>
        {status ? <p className="college-verify-note">{status}</p> : null}
        <button className="college-primary-button" disabled={submitting}>{submitting ? 'Sending…' : 'Send request'}</button>
      </form>
    </Page>
  );
}

export function GameInvitePage() {
  const { token } = useParams();
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState('');
  const claim = async () => { if (!isAuthenticated) { window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`; return; } setStatus('Verifying…'); try { const data = await claimGameInvite(token); setStatus(`Verified for ${data.registration.teamName}. Your captain can now use the team pass.`); } catch (err) { setStatus(err.message); } };
  return <Page><BrandHeader title="Team Invite" /><section className="college-content"><div className="college-confirmation"><span><Users /></span><h1>Join your college team</h1><p>Sign in using the exact college email invited by your captain.</p></div><button className="college-primary-button" onClick={claim}>Verify and join</button>{status ? <p className="college-verify-note">{status}</p> : null}</section></Page>;
}
