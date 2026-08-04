import { useEffect, useState } from 'react';
import { Loader, Users, X } from 'lucide-react';
import { fetchFollowMembers } from '../services/api/follows.api';
import { useDarkMode } from '../context/DarkModeContext';

function MemberAvatar({ name, profilePic }) {
  const initial = String(name || 'M').trim().charAt(0).toUpperCase() || 'M';
  if (profilePic) {
    return (
      <img
        src={profilePic}
        alt=""
        className="size-10 rounded-full object-cover bg-gray-800"
        loading="lazy"
      />
    );
  }
  return (
    <div className="size-10 rounded-full bg-[#0ECCEE]/20 text-[#0ECCEE] flex items-center justify-center text-sm font-semibold">
      {initial}
    </div>
  );
}

export default function CommunityMembersSheet({
  open,
  onClose,
  entityType,
  entityId,
  title = 'Members',
}) {
  const { isDark } = useDarkMode();
  const [members, setMembers] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !entityType || !entityId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setPage(1);
      try {
        const data = await fetchFollowMembers(entityType, entityId, { page: 1, limit: 30 });
        if (cancelled) return;
        setMembers(data.members);
        setFollowerCount(data.followerCount);
        setTotalPages(data.pagination?.totalPages || 1);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load members');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, entityType, entityId]);

  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const data = await fetchFollowMembers(entityType, entityId, { page: next, limit: 30 });
      setMembers((prev) => [...prev, ...(data.members || [])]);
      setFollowerCount(data.followerCount);
      setTotalPages(data.pagination?.totalPages || 1);
      setPage(next);
    } catch (e) {
      setError(e.message || 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <button
        type="button"
        aria-label="Close members"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        className={`relative w-full max-w-md max-h-[78vh] rounded-t-3xl sm:rounded-3xl border flex flex-col overflow-hidden ${
          isDark ? 'bg-[#161718] border-white/10' : 'bg-white border-gray-200'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={`flex items-center justify-between gap-3 px-4 py-3.5 border-b ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</p>
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              {followerCount} follower{followerCount === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader className="animate-spin text-[#0ECCEE]" size={24} />
            </div>
          ) : error ? (
            <p className="text-sm text-red-400 py-8 text-center">{error}</p>
          ) : members.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Users className={`mx-auto ${isDark ? 'text-gray-600' : 'text-gray-300'}`} size={28} />
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                No followers yet. Be the first!
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {members.map((m) => (
                <li
                  key={m.id}
                  className={`flex items-center gap-3 px-2 py-2.5 rounded-xl ${
                    isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                  }`}
                >
                  <MemberAvatar name={m.name} profilePic={m.profilePic} />
                  <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {m.name}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {!loading && page < totalPages ? (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full mt-3 py-3 rounded-xl text-sm font-medium text-[#0ECCEE] disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
