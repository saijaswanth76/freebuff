import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authAPI, setAuthToken, onSessionExpired, getApiErrorMessage } from '../services/api';

const AuthContext = createContext(null);

/** Where each role lands after logging in. */
export const HOME_BY_ROLE = {
  ADMIN: '/admin',
  NGO: '/ngo',
  VOLUNTEER: '/volunteer',
  DONOR: '/donor',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState('');

  // Restore the session from the httpOnly cookie on page load.
  useEffect(() => {
    let active = true;
    authAPI
      .me()
      .then((res) => {
        if (active) setUser(res.data.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Backend says the session is gone (expired/invalid token, logout elsewhere).
  useEffect(
    () =>
      onSessionExpired(() => {
        setAuthToken(null);
        setUser((prev) => {
          if (prev) setSessionMessage('Your session has expired. Please log in again.');
          return null;
        });
      }),
    []
  );

  const login = useCallback(async (credentials) => {
    try {
      const res = await authAPI.login(credentials);
      setAuthToken(res.data.token);
      setUser(res.data.user);
      setSessionMessage('');
      return res.data.user;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Login failed'));
    }
  }, []);

  const register = useCallback(async (payload) => {
    try {
      const res = await authAPI.register(payload);
      setAuthToken(res.data.token);
      setUser(res.data.user);
      setSessionMessage('');
      return res.data.user;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Registration failed'));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      // Ignore network errors on logout - the local session is cleared anyway.
      console.warn('logout failed', error?.message);
    }
    setAuthToken(null);
    setUser(null);
    setSessionMessage('');
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authAPI.me();
      setUser(res.data.user);
      return res.data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser, sessionMessage, clearSessionMessage: () => setSessionMessage('') }),
    [user, loading, login, register, logout, refreshUser, sessionMessage]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
