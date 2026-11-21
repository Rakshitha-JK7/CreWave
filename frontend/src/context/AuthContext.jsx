import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('carewave_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('carewave_auth_token') || null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const logout = useCallback(() => {
    setToken(null);
    setCurrentUser(null);
    setAuthError(null);
    try {
      localStorage.removeItem('carewave_auth_token');
      localStorage.removeItem('carewave_user');
      delete api.defaults.headers.common['Authorization'];
    } catch (e) {
      console.error('Error clearing local storage on logout:', e);
    }
  }, []);

  // Initialize and verify session on mount
  useEffect(() => {
    const verifySession = async () => {
      const savedToken = localStorage.getItem('carewave_auth_token');
      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      try {
        api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
        const res = await api.get('/auth/me');
        if (res.data && res.data.success) {
          const user = res.data.data;
          setCurrentUser(user);
          localStorage.setItem('carewave_user', JSON.stringify(user));
        } else {
          // Token invalid
          logout();
        }
      } catch (err) {
        console.warn('Session verification failed or server offline:', err.message);
        if (err.response?.status === 401 || err.response?.status === 403) {
          // Authoritative database rejection: credentials or token no longer exist
          logout();
        } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
          // Truly offline: preserve stored credentials so rural workers can continue offline
          const storedUser = localStorage.getItem('carewave_user');
          if (storedUser) {
            try {
              setCurrentUser(JSON.parse(storedUser));
            } catch {
              logout();
            }
          } else {
            logout();
          }
        } else {
          logout();
        }
      } finally {
        setIsLoading(false);
      }
    };

    verifySession();
  }, [logout]);

  const login = useCallback(async ({ email, username, password }) => {
    setAuthError(null);
    try {
      const payload = {
        username: username || email,
        email: email || (username && username.includes('@') ? username : undefined),
        password,
      };

      const res = await api.post('/auth/login', payload);
      const data = res.data;

      if (!data.success || !data.data?.token) {
        throw new Error(data.message || 'Login failed.');
      }

      const receivedToken = data.data.token;
      const user = data.data.user;

      setToken(receivedToken);
      setCurrentUser(user);

      localStorage.setItem('carewave_auth_token', receivedToken);
      localStorage.setItem('carewave_user', JSON.stringify(user));
      api.defaults.headers.common['Authorization'] = `Bearer ${receivedToken}`;

      return { success: true, user };
    } catch (err) {
      const code = err.response?.data?.code || '';
      const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Authentication failed.';
      setAuthError({ code, message });
      throw { code, message };
    }
  }, []);

  const register = useCallback(async (userData) => {
    setAuthError(null);
    try {
      const res = await api.post('/auth/register', userData);
      const data = res.data;

      if (!data.success) {
        throw new Error(data.message || 'Registration failed.');
      }

      const user = data.data?.user || data.data;
      const receivedToken = data.data?.token;

      // If active account with token (e.g. patient), establish session immediately
      if (receivedToken && user?.status === 'active') {
        setToken(receivedToken);
        setCurrentUser(user);
        localStorage.setItem('carewave_auth_token', receivedToken);
        localStorage.setItem('carewave_user', JSON.stringify(user));
        api.defaults.headers.common['Authorization'] = `Bearer ${receivedToken}`;
      }

      return {
        success: true,
        user,
        status: user?.status || 'pending',
        message: data.message || 'Registration successful.',
      };
    } catch (err) {
      const code = err.response?.data?.code || '';
      const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Registration failed.';
      setAuthError({ code, message });
      throw { code, message };
    }
  }, []);

  const updateCurrentUser = useCallback((updates) => {
    setCurrentUser((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem('carewave_user', JSON.stringify(next));
      } catch (e) {
        console.error('Error updating cached user:', e);
      }
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        role: currentUser?.role || null,
        status: currentUser?.status || null,
        isAuthenticated: !!token && !!currentUser,
        isLoading,
        authError,
        login,
        register,
        logout,
        updateCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;

