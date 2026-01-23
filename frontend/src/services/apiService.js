import { authFetch } from '../utils/authFetch';

export const getProtectedData = async () => {
  const response = await authFetch('/api/protected-route');
  return response.json();
};
