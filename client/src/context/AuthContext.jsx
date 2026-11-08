import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('ll_user');
    if (stored) {
      setUser(JSON.parse(stored));
      // Re-validate token against server
      getMe()
        .then((u) => { setUser(u); localStorage.setItem('ll_user', JSON.stringify(u)); })
        .catch(() => { setUser(null); localStorage.removeItem('ll_token'); localStorage.removeItem('ll_user'); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const storeAuth = (data) => {
    localStorage.setItem('ll_token', data.token);
    localStorage.setItem('ll_user',  JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('ll_token');
    localStorage.removeItem('ll_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, storeAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
