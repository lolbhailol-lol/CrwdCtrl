import { useCallback, useEffect, useState } from 'react';
import { Heart, Loader, Users, Check } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../context/DarkModeContext';
import {
  fetchFollowStatus,
  followEntity,
  unfollowEntity,
} from '../services/api/follows.api';
import CommunityMembersSheet from './CommunityMembersSheet';

function formatCount(n) {
  const num = Number(n) || 0;
  if (num >= 1000) return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return String(num);
}

/**
 * Follow bar (separate from Favorites) with follower count → members sheet.
 */
export default function FollowCommunityBar({
  entityType,
  entityId,
  followLabel = 'Follow Community',
  followingLabel = 'Following',
  membersTitle = 'Members',
  onRequireLogin,
}) {
  const { isAuthenticated } = useAuth();
  const { isDark } = useDarkMode();
  const reduceMotion = useReducedMotion();
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [membersOpen, setMembersOpen] = useState(false);
  const [pendingFollow, setPendingFollow] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [justFollowed, setJustFollowed] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!entityType || !entityId) return;
    try {
      const data = await fetchFollowStatus(entityType, entityId);
      setFollowing(Boolean(data.following));
      setFollowerCount(Number(data.followerCount) || 0);
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    setLoading(true);
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!justFollowed) return undefined;
    const t = setTimeout(() => setJustFollowed(false), 900);
    return () => clearTimeout(t);
  }, [justFollowed]);

  const applyFollowSuccess = (count) => {
    setFollowing(true);
    setFollowerCount(Number(count) || 0);
    setJustFollowed(true);
    setBurstKey((k) => k + 1);
  };

  useEffect(() => {
    if (!isAuthenticated || !pendingFollow) return;
    setPendingFollow(false);
    (async () => {
      setBusy(true);
      try {
        const data = await followEntity(entityType, entityId);
        applyFollowSuccess(data.followerCount);
      } catch {
        // ignore — user can tap again
      } finally {
        setBusy(false);
      }
    })();
  }, [isAuthenticated, pendingFollow, entityType, entityId]);

  const handleFollowToggle = async () => {
    if (!isAuthenticated) {
      setPendingFollow(true);
      onRequireLogin?.();
      return;
    }
    if (busy) return;

    const wasFollowing = following;
    // Optimistic UI
    setBusy(true);
    setFollowing(!wasFollowing);
    setFollowerCount((c) => Math.max(0, c + (wasFollowing ? -1 : 1)));
    if (!wasFollowing) {
      setJustFollowed(true);
      setBurstKey((k) => k + 1);
    }

    try {
      if (wasFollowing) {
        const data = await unfollowEntity(entityType, entityId);
        setFollowing(false);
        setFollowerCount(Number(data.followerCount) || 0);
        setJustFollowed(false);
      } else {
        const data = await followEntity(entityType, entityId);
        applyFollowSuccess(data.followerCount);
      }
    } catch (e) {
      // Revert optimistic state
      setFollowing(wasFollowing);
      setFollowerCount((c) => Math.max(0, c + (wasFollowing ? 1 : -1)));
      setJustFollowed(false);
      if (e?.code === 'NO_AUTH_TOKEN' || e?.code === 'AUTH_401') {
        setPendingFollow(true);
        onRequireLogin?.();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2.5">
        <motion.button
          type="button"
          onClick={handleFollowToggle}
          disabled={busy}
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          animate={
            reduceMotion
              ? undefined
              : justFollowed
                ? { scale: [1, 1.04, 1] }
                : { scale: 1 }
          }
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className={`relative flex-1 overflow-hidden inline-flex items-center justify-center gap-2 min-h-12 px-4 rounded-2xl text-sm font-semibold disabled:cursor-wait ${
            following
              ? isDark
                ? 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                : 'border border-emerald-500/25 bg-emerald-50 text-emerald-700'
              : 'border border-transparent text-white'
          }`}
          style={following ? undefined : {
            background: 'linear-gradient(105deg, #EF4444 0%, #EC4899 55%, #F472B6 100%)',
            boxShadow: '0 10px 24px rgba(236, 72, 153, 0.32)',
          }}
          aria-pressed={following}
        >
          {/* Soft sheen on follow CTA */}
          {!following && !reduceMotion ? (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-1/3 bg-linear-to-r from-transparent via-white/25 to-transparent skew-x-12"
              initial={{ left: '-40%' }}
              animate={{ left: ['-40%', '120%'] }}
              transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' }}
            />
          ) : null}

          {/* Heart burst sparks */}
          <AnimatePresence>
            {justFollowed && !reduceMotion ? (
              <span key={burstKey} className="pointer-events-none absolute inset-0 flex items-center justify-center">
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const angle = (i / 6) * Math.PI * 2;
                  return (
                    <motion.span
                      key={i}
                      className="absolute size-1.5 rounded-full bg-pink-300"
                      initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                      animate={{
                        opacity: 0,
                        x: Math.cos(angle) * 28,
                        y: Math.sin(angle) * 28,
                        scale: 0.2,
                      }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                    />
                  );
                })}
              </span>
            ) : null}
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            {busy && !justFollowed ? (
              <motion.span
                key="busy"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="inline-flex"
              >
                <Loader size={16} className="animate-spin" />
              </motion.span>
            ) : following ? (
              <motion.span
                key="following-icon"
                initial={reduceMotion ? false : { scale: 0.4, rotate: -20, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 520, damping: 18 }}
                className="inline-flex items-center justify-center size-6 rounded-full bg-emerald-500/20"
              >
                {justFollowed ? (
                  <Heart size={14} className="fill-current text-emerald-400" strokeWidth={0} />
                ) : (
                  <Check size={14} strokeWidth={2.75} className="text-emerald-400" />
                )}
              </motion.span>
            ) : (
              <motion.span
                key="follow-icon"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="inline-flex"
              >
                <Heart size={16} strokeWidth={2.4} />
              </motion.span>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={following ? 'following' : 'follow'}
              initial={reduceMotion ? false : { y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="relative"
            >
              {following ? followingLabel : followLabel}
            </motion.span>
          </AnimatePresence>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => setMembersOpen(true)}
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          className={`shrink-0 inline-flex flex-col items-center justify-center gap-0.5 min-h-12 min-w-[4.25rem] px-3 rounded-2xl text-[10px] font-medium border transition ${
            isDark
              ? 'border-white/10 bg-white/5 text-gray-400 hover:text-white hover:border-[#0ECCEE]/35'
              : 'border-gray-200 bg-gray-50 text-gray-500 hover:text-gray-900 hover:border-[#0ECCEE]/40'
          }`}
          aria-label="View followers"
        >
          <Users size={14} className="text-[#0ECCEE]" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={loading ? 'loading' : String(followerCount)}
              initial={reduceMotion ? false : { y: 4, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -4, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={`tabular-nums text-xs font-bold leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}
            >
              {loading ? '…' : formatCount(followerCount)}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>

      <CommunityMembersSheet
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        entityType={entityType}
        entityId={entityId}
        title={membersTitle}
      />
    </>
  );
}
