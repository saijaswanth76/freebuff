import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authAPI, setAuthToken, onSessionExpired, getApiErrorMessage } from '../services/api';

const AuthContext = createContext(null);

/**
 * Session snapshot cache.
 *
 * The httpOnly cookie is still the source of truth, but restoring the session
 * used to depend on a single /api/auth/me request during page load: if that
 * request failed (network hiccup, slow cold start, blocked cookie) the user was
 * logged out on every refresh. We now keep the last known user (and the token
 * lives in sessionStorage inside services/api) so a refresh renders the
 * dashboard immediately, then revalidates in the background.
 * Logging out only happens on an explicit 401/403 from the server.
 */
const USER_CACHE_KEY = 'cfds_auth_user';

const readCachedUser = () => {
  try {
    const raw = window.sessionStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeCachedUser = (nextUser) => {
  try {
    if (nextUser) window.sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(nextUser));
    else window.sessionStorage.removeItem(USER_CACHE_KEY);
  } catch {
    /* storage unavailable - the cookie still handles the session */
  }
};

/** Where each role lands after logging in. */
export const HOME_BY_ROLE = {
  ADMIN: '/admin',
  NGO: '/ngo',
  VOLUNTEER: '/volunteer',
  DONOR: '/donor',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readCachedUser);
  const [loading, setLoading] = useState(() => !readCachedUser());
  const [sessionMessage, setSessionMessage] = useState('');

  // Restore + revalidate the session on page load. The cached user keeps the
  // user signed in across a refresh; only 401/403 ends the session.
  useEffect(() => {
    let active = true;
    authAPI
      .me()
      .then((res) => {
        if (!active) return;
        setUser(res.data.user);
        writeCachedUser(res.data.user);
      })
      .catch((error) => {
        if (!active) return;
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
          setAuthToken(null);
          writeCachedUser(null);
          setUser(null);
        }
        // Network / timeout errors are transient: keep the cached session.
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
        writeCachedUser(null);
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
      writeCachedUser(res.data.user);
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
      writeCachedUser(res.data.user);
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
    writeCachedUser(null);
    setUser(null);
    setSessionMessage('');
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authAPI.me();
      writeCachedUser(res.data.user);
      setUser(res.data.user);
      return res.data.user;
    } catch (error) {
      // Only an explicit auth rejection ends the session.
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        setAuthToken(null);
        writeCachedUser(null);
        setUser(null);
      }
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
