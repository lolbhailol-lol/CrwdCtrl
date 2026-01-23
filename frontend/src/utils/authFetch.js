export const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  console.log('Token being sent:', token); // Debugging

  const headers = {
    ...options.headers,
    Authorization: token ? `Bearer ${token}` : undefined,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, { ...options, headers });
  console.log('Response status:', response.status); // Debugging

  if (response.status === 401) {
    console.error('Unauthorized: Redirecting to login...');
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  return response;
};
