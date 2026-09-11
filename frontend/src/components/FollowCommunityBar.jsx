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
  followLabel = 'Follow',
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
      <div className="flex items-center justify-start gap-2">
        <motion.button
          type="button"
          onClick={handleFollowToggle}
          disabled={busy}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          className={`inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl text-[13px] font-semibold disabled:cursor-wait transition-colors ${
            following
              ? isDark
                ? 'border border-[#0ECCEE]/30 bg-[#0ECCEE]/10 text-[#0ECCEE]'
                : 'border border-[#0ECCEE]/35 bg-[#0ECCEE]/10 text-[#0891b2]'
              : 'border border-transparent bg-[#0ECCEE] text-black hover:brightness-110'
          }`}
          aria-pressed={following}
        >
          {busy ? (
            <Loader size={14} className="animate-spin" />
          ) : following ? (
            <Check size={14} strokeWidth={2.75} />
          ) : (
            <Heart size={14} strokeWidth={2.4} />
          )}
          <span>{following ? followingLabel : followLabel}</span>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => setMembersOpen(true)}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          className={`inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl text-[12px] font-medium border transition-colors ${
            isDark
              ? 'border-white/10 bg-[#1D1E20] text-gray-400 hover:text-white hover:border-[#0ECCEE]/40'
              : 'border-gray-200 bg-gray-50 text-gray-500 hover:text-gray-900 hover:border-[#0ECCEE]/40'
          }`}
          aria-label="View followers"
        >
          <Users size={13} className="text-[#0ECCEE]" />
          <span className={`tabular-nums text-[13px] font-semibold leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>
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
