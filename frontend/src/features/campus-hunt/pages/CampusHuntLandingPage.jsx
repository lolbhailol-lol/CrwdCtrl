import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { CAMPUS_HUNT_PATHS } from '../config';
import { readHuntSession } from '../utils/huntSession';

/**
 * Event landing — players use their shared team URL.
 * If already logged in, offer continue to play.
 */
export default function CampusHuntLandingPage() {
  const { slug } = useParams();
  const { isAuthenticated } = useAuth();
  const saved = readHuntSession();
  const sameEvent = saved?.slug && slug && saved.slug === slug;
  const continuePlay = CAMPUS_HUNT_PATHS.play(slug);
  const teamLink = sameEvent
    ? (saved.teamLoginPath || CAMPUS_HUNT_PATHS.teamLogin(slug, saved.teamCode))
    : null;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0c0d] px-5 text-center text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 45% at 50% -5%, #0ECCEE33, transparent 55%), linear-gradient(180deg, #121416 0%, #0b0c0d 70%)',
        }}
      />
      <div className="relative max-w-md space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0ECCEE]">
          Campus Hunt
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          {isAuthenticated && sameEvent ? 'You\'re still logged in' : 'Open your team link'}
        </h1>
        {isAuthenticated && sameEvent ? (
          <>
            <p className="text-sm text-white/60">
              Team{' '}
              <span className="font-mono text-white/85">{saved.teamCode}</span>
              {' '}— jump back into the hunt.
            </p>
            <Link
              to={continuePlay}
              className="inline-flex rounded-xl bg-[#0ECCEE] px-5 py-3 text-sm font-bold text-black"
            >
              Continue hunt →
            </Link>
            {teamLink && (
              <p className="text-xs text-white/40">
                Wrong person on this phone?{' '}
                <Link to={teamLink} className="underline text-white/60">
                  Switch on team login
                </Link>
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-white/60">
            Your organizer shared a link like{' '}
            <span className="font-mono text-white/80">…/team/CC001</span>.
            Open that — enter the password and tap your name. Stay logged in after that.
          </p>
        )}
      </div>
    </div>
  );
}
