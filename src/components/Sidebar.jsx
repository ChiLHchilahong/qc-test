import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { globalSearch } from '../api/client';

const navItems = [
  {
    label: 'Dashboard',
    path: '/',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zM3 14h7v7H3v-7z" />
      </svg>
    ),
  },
  {
    label: 'Projects',
    path: '/projects',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Test Plans',
    path: '/test-plans',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V9m-5-4h3m0 0v3m0-3L10 14"
        />
      </svg>
    ),
  },
  {
    label: 'Bugs',
    path: '/bugs',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
  },
  {
    label: 'Profile',
    path: '/profile',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    label: 'Activity',
    path: '/activity',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
];

const TYPE_LABELS = { bug: 'Bug', testcase: 'Test Case', build: 'Build', project: 'Project', testplan: 'Test Plan' };
const TYPE_COLORS = { bug: 'bg-red-100 text-red-700', testcase: 'bg-blue-100 text-blue-700', build: 'bg-purple-100 text-purple-700', project: 'bg-emerald-100 text-emerald-700', testplan: 'bg-indigo-100 text-indigo-700' };

function getResultPath(r) {
  if (r.type === 'bug') return `/bugs/${r.id}`;
  if (r.type === 'testplan') return `/test-plans/${r.id}`;
  if (r.type === 'project') return `/projects/${r.id}`;
  if (r.type === 'build') return r.projectId && r.versionId ? `/projects/${r.projectId}/versions/${r.versionId}/builds/${r.id}` : '/projects';
  return '/';
}

const Sidebar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const searchRef = useRef(null);
  const timerRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); setShowDrop(false); return; }
    setSearching(true);
    try {
      const data = await globalSearch(q);
      setResults(Array.isArray(data) ? data : []);
      setShowDrop(true);
    } catch (_) {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleResultClick = (r) => {
    setQuery('');
    setResults([]);
    setShowDrop(false);
    navigate(getResultPath(r));
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDrop(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col border-r border-[#24324d] bg-[#1f2a42] text-[#d7e0f2]">
      {/* Logo */}
      <div className="px-6 py-8">
        <h1 className="text-[34px] leading-none font-extrabold tracking-tight text-white">
          <span className="text-[#3e7bff]">QC</span> SUITE
        </h1>
      </div>

      {/* Search */}
      <div className="px-3 pb-3 relative" ref={searchRef}>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            onFocus={() => results.length > 0 && setShowDrop(true)}
            placeholder="Search..."
            className="w-full rounded-lg border border-[#344766] bg-[#253047] px-3 py-2 text-sm text-[#d3dbea] placeholder-[#718096] focus:border-[#3e7bff] focus:outline-none"
          />
          {searching && (
            <div className="absolute right-2 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
          )}
        </div>
        {showDrop && results.length > 0 && (
          <div className="absolute left-3 right-3 z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
            {results.map((r, i) => (
              <button
                key={`${r.type}-${r.id}-${i}`}
                onClick={() => handleResultClick(r)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-gray-50"
              >
                <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${TYPE_COLORS[r.type] || 'bg-gray-100 text-gray-600'}`}>
                  {TYPE_LABELS[r.type] || r.type}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-800">{r.label}</div>
                  {r.context && <div className="text-xs text-gray-400">{r.context}</div>}
                </div>
                {r.meta && <span className="shrink-0 text-xs text-gray-400">{r.meta}</span>}
              </button>
            ))}
          </div>
        )}
        {showDrop && query.length >= 2 && !searching && results.length === 0 && (
          <div className="absolute left-3 right-3 z-50 mt-1 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-400 shadow-xl">
            No results found.
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="mt-3 flex-1 space-y-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-4 py-3 text-[15px] font-semibold transition-colors ${
                isActive
                  ? 'bg-[#34425d] text-white'
                  : 'text-[#d3dbea] hover:bg-[#2c3853] hover:text-white'
              }`
            }
          >
            <span className="text-inherit">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[#2b3854] px-4 py-4">
        <div className="flex items-center gap-3 rounded-lg bg-[#222f4a] px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5f6fff] text-sm font-bold text-white">
            {(user?.username?.[0] || 'U').toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-white">{user?.username || 'User'}</span>
        </div>
        <button
          onClick={handleLogout}
          className="mt-3 w-full rounded-lg border border-[#3a4a68] px-3 py-2 text-sm font-semibold text-[#d3dbea] transition-colors hover:bg-[#2a3650] hover:text-white"
        >
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
