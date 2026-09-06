import { publicFetchJSON, resolveUrl } from './client.js';
import { userFetchJSONStrict } from './auth.api.js';
import { resolveAuthToken, getBearerAuthHeaders } from '../../utils/authToken.js';

function followsPath(entityType, entityId, suffix = '') {
  const type = encodeURIComponent(entityType);
  const id = encodeURIComponent(entityId);
  return `/follows/${type}/${id}${suffix}`;
}

/** Public/optional-auth status: { following, followerCount } */
export async function fetchFollowStatus(entityType, entityId) {
  const token = resolveAuthToken();
  if (token) {
    try {
      const data = await userFetchJSONStrict(followsPath(entityType, entityId, '/status'), {
        cacheBust: false,
      });
      return {
        following: Boolean(data?.following),
        followerCount: Number(data?.followerCount) || 0,
      };
    } catch {
      // Fall through to public status
    }
  }
  const data = await publicFetchJSON(followsPath(entityType, entityId, '/status'));
  return {
    following: Boolean(data?.following),
    followerCount: Number(data?.followerCount) || 0,
  };
}

export async function followEntity(entityType, entityId) {
  const token = resolveAuthToken();
  if (!token) {
    const err = new Error('Authentication required');
    err.code = 'NO_AUTH_TOKEN';
    throw err;
  }

  const response = await fetch(resolveUrl(followsPath(entityType, entityId)), {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...getBearerAuthHeaders(token),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    const err = new Error(data?.message || 'Authentication failed. Please log in again.');
    err.code = 'AUTH_401';
    throw err;
  }
  if (!response.ok) {
    throw new Error(data?.message || `Failed to follow (${response.status})`);
  }
  return {
    following: true,
    followerCount: Number(data?.followerCount) || 0,
  };
}

export async function unfollowEntity(entityType, entityId) {
  const token = resolveAuthToken();
  if (!token) {
    const err = new Error('Authentication required');
    err.code = 'NO_AUTH_TOKEN';
    throw err;
  }

  const response = await fetch(resolveUrl(followsPath(entityType, entityId)), {
    method: 'DELETE',
    credentials: 'include',
    headers: getBearerAuthHeaders(token),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.message || `Failed to unfollow (${response.status})`);
    err.status = response.status;
    throw err;
  }
  return {
    following: false,
    followerCount: Number(data?.followerCount) || 0,
  };
}

export async function fetchFollowMembers(entityType, entityId, { page = 1, limit = 30 } = {}) {
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const data = await publicFetchJSON(
    `${followsPath(entityType, entityId, '/members')}?${qs.toString()}`,
  );
  return {
    members: data?.members || [],
    followerCount: Number(data?.followerCount) || 0,
    pagination: data?.pagination || { page: 1, limit, total: 0, totalPages: 1 },
  };
}
