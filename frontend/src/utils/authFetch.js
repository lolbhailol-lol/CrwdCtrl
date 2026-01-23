export const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem('token');

  const headers = {
    ...options.headers,
    Authorization: token ? `Bearer ${token}` : undefined,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    // Handle unauthorized access (e.g., redirect to login)
    console.error('Unauthorized: Redirecting to login...');
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  return response;
};
