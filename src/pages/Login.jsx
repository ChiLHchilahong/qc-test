import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, hasAnyAccount } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState(hasAnyAccount ? 'login' : 'register');
  const [error, setError] = useState('');
  const [failedLoginAttempts, setFailedLoginAttempts] = useState(0);

  const defaultUsername = import.meta.env.VITE_LOGIN_USERNAME || 'admin';
  const defaultPassword = import.meta.env.VITE_LOGIN_PASSWORD || '123456';

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Mật khẩu nhập lại không khớp');
        return;
      }

      const result = await register(username.trim(), password);
      if (!result.success) {
        setError(result.message || 'Đăng ký thất bại');
        return;
      }

      setError('');
      setFailedLoginAttempts(0);
      setMode('login');
      setPassword('');
      setConfirmPassword('');
      return;
    }

    const result = await login(username.trim(), password);

    if (!result.success) {
      setError(result.message || 'Đăng nhập thất bại');
      setFailedLoginAttempts((prev) => prev + 1);
      return;
    }

    setFailedLoginAttempts(0);
    navigate(from, { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef2f7] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#d7dfeb] bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-extrabold text-[#0d1d3b]">Đăng nhập QC Suite</h1>
        <p className="mt-2 text-sm text-[#6c7f99]">Vui lòng đăng nhập để truy cập dashboard.</p>

        <div className="mt-5 grid grid-cols-2 rounded-lg border border-[#cad4e3] p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              setFailedLoginAttempts(0);
            }}
            className={`rounded-md px-3 py-2 text-sm font-bold ${mode === 'login' ? 'bg-[#4f6ef7] text-white' : 'text-[#415677]'}`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
              setFailedLoginAttempts(0);
            }}
            className={`rounded-md px-3 py-2 text-sm font-bold ${mode === 'register' ? 'bg-[#4f6ef7] text-white' : 'text-[#415677]'}`}
          >
            Đăng ký
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-[#2d3f5f]">Tài khoản</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-[#c8d3e3] px-3 py-2 outline-none focus:border-[#4f6ef7]"
              placeholder="Nhập tài khoản"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-[#2d3f5f]">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[#c8d3e3] px-3 py-2 outline-none focus:border-[#4f6ef7]"
              placeholder="Nhập mật khẩu"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-sm font-semibold text-[#2d3f5f]">Nhập lại mật khẩu</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-[#c8d3e3] px-3 py-2 outline-none focus:border-[#4f6ef7]"
                placeholder="Nhập lại mật khẩu"
              />
            </div>
          )}

          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

          {mode === 'login' && failedLoginAttempts >= 3 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
              Bạn đã nhập sai {failedLoginAttempts} lần. Gợi ý đăng nhập mặc định: {defaultUsername} / {defaultPassword}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-[#4f6ef7] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#3f5de7]"
          >
            {mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}
          </button>
        </form>

        <p className="mt-4 text-xs text-[#8c9cb3]">
          {hasAnyAccount
            ? 'Bạn có thể đăng ký thêm tài khoản mới bằng tab Đăng ký.'
            : 'Chưa có tài khoản, hãy tạo tài khoản đầu tiên ở tab Đăng ký.'}
        </p>
      </div>
    </div>
  );
}
