import React from 'react';

const LogoutPage = () => {
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return <button onClick={handleLogout}>Logout</button>;
};

export default LogoutPage;
