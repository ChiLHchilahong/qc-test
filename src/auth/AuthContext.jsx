import React, { createContext, useContext, useMemo, useState } from 'react';

const ACCOUNTS_STORAGE_KEY = 'qc_auth_accounts';
const SESSION_STORAGE_KEY = 'qc_auth_session';
const SESSION_TTL_MS = 30 * 60 * 1000;
const AuthContext = createContext(null);

function readStoredAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

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
  const [accounts, setAccounts] = useState(() => readStoredAccounts());

  const persistAccounts = (nextAccounts) => {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(nextAccounts));
    setAccounts(nextAccounts);
  };

  const register = (username, password) => {
    const normalizedUsername = String(username || '').trim();
    const normalizedPassword = String(password || '');

    if (!normalizedUsername) {
      return { success: false, message: 'Vui lòng nhập tài khoản' };
    }
    if (normalizedPassword.length < 4) {
      return { success: false, message: 'Mật khẩu phải từ 4 ký tự' };
    }

    const existed = accounts.some(
      (acc) => acc.username.toLowerCase() === normalizedUsername.toLowerCase()
    );
    if (existed) {
      return { success: false, message: 'Tài khoản đã tồn tại' };
    }

    const nextAccounts = [...accounts, { username: normalizedUsername, password: normalizedPassword }];
    persistAccounts(nextAccounts);
    return { success: true };
  };

  const login = (username, password) => {
    const normalizedUsername = String(username || '').trim();

    // Backward compatibility: if no registered account yet, keep default admin account.
    const candidates = accounts.length > 0
      ? accounts
      : [{ username: import.meta.env.VITE_LOGIN_USERNAME || 'admin', password: import.meta.env.VITE_LOGIN_PASSWORD || '123456' }];

    const matched = candidates.find(
      (acc) => acc.username.toLowerCase() === normalizedUsername.toLowerCase() && acc.password === password
    );

    if (!matched) {
      return { success: false, message: 'Sai tài khoản hoặc mật khẩu' };
    }

    const nextUser = {
      username: matched.username,
      loginAt: Date.now(),
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    return { success: true };
  };

  const logout = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      hasAnyAccount: accounts.length > 0,
      login,
      logout,
      register,
    }),
    [user, accounts]
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
