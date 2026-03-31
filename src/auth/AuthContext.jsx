import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getHasAnyAccount, loginAccount, registerAccount } from '../api/client';

const SESSION_STORAGE_KEY = 'qc_auth_session';
const GUEST_ID_STORAGE_KEY = 'qc_guest_id';
const SESSION_TTL_MS = 30 * 60 * 1000;
const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.username || !parsed.loginAt) return null;

    const age = Date.now() - Number(parsed.loginAt);
    if (Number.isNaN(age) || age > SESSION_TTL_MS) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredSession());
  const [hasAnyAccount, setHasAnyAccount] = useState(false);

  useEffect(() => {
    getHasAnyAccount()
      .then((v) => setHasAnyAccount(Boolean(v)))
      .catch(() => setHasAnyAccount(false));
  }, []);

  const register = async (username, password) => {
    const normalizedUsername = String(username || '').trim();
    const normalizedPassword = String(password || '');

    if (!normalizedUsername) {
      return { success: false, message: 'Vui lòng nhập tài khoản' };
    }
    if (normalizedPassword.length < 4) {
      return { success: false, message: 'Mật khẩu phải từ 4 ký tự' };
    }

    try {
      await registerAccount(normalizedUsername, normalizedPassword);
      setHasAnyAccount(true);
      return { success: true };
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Đăng ký thất bại';
      return { success: false, message };
    }
  };

  const login = async (username, password) => {
    const normalizedUsername = String(username || '').trim();

    try {
      const data = await loginAccount(normalizedUsername, password);
      const nextUser = {
        username: data?.user?.username || normalizedUsername,
        loginAt: Date.now(),
      };

      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
      return { success: true };
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Sai tài khoản hoặc mật khẩu';
      return { success: false, message };
    }
  };

  const logout = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setUser(null);
  };

  const enterGuest = () => {
    let guestId = '';
    try {
      guestId = localStorage.getItem(GUEST_ID_STORAGE_KEY) || '';
      if (!guestId) {
        guestId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
        localStorage.setItem(GUEST_ID_STORAGE_KEY, guestId);
      }
    } catch {
      guestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    const guestUser = {
      username: 'Guest',
      loginAt: Date.now(),
      isGuest: true,
      guestId,
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(guestUser));
    setUser(guestUser);
    return { success: true };
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      hasAnyAccount,
      login,
      enterGuest,
      logout,
      register,
    }),
    [user, hasAnyAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
