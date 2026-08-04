import { useCallback, useEffect, useState } from 'react';
import { Heart, Loader, Users, Check } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
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

  const applyFollowSuccess = (count) => {
    setFollowing(true);
    setFollowerCount(Number(count) || 0);
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

    try {
      if (wasFollowing) {
        const data = await unfollowEntity(entityType, entityId);
        setFollowing(false);
        setFollowerCount(Number(data.followerCount) || 0);
      } else {
        const data = await followEntity(entityType, entityId);
        applyFollowSuccess(data.followerCount);
      }
    } catch (e) {
      // Revert optimistic state
      setFollowing(wasFollowing);
      setFollowerCount((c) => Math.max(0, c + (wasFollowing ? 1 : -1)));
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

          {busy ? (
            <span className="inline-flex">
              <Loader size={16} className="animate-spin" />
            </span>
          ) : following ? (
            <span className="inline-flex items-center justify-center size-6 rounded-full bg-emerald-500/20">
              <Check size={14} strokeWidth={2.75} className="text-emerald-400" />
            </span>
          ) : (
            <span className="inline-flex">
              <Heart size={16} strokeWidth={2.4} />
            </span>
          )}
          <span className="relative">{following ? followingLabel : followLabel}</span>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => setMembersOpen(true)}
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          className={`shrink-0 inline-flex flex-col items-center justify-center gap-0.5 min-h-12 min-w-17 px-3 rounded-2xl text-[10px] font-medium border transition ${
            isDark
              ? 'border-white/10 bg-white/5 text-gray-400 hover:text-white hover:border-[#0ECCEE]/35'
              : 'border-gray-200 bg-gray-50 text-gray-500 hover:text-gray-900 hover:border-[#0ECCEE]/40'
          }`}
          aria-label="View followers"
        >
          <Users size={14} className="text-[#0ECCEE]" />
          <span className={`tabular-nums text-xs font-bold leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {loading ? '…' : formatCount(followerCount)}
          </span>
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
