import React from 'react';
import { NavLink } from 'react-router-dom';

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
    label: 'Profile',
    path: '/profile',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

const Sidebar = () => {
  return (
    <aside className="w-56 flex-shrink-0 flex flex-col border-r border-[#24324d] bg-[#1f2a42] text-[#d7e0f2]">
      {/* Logo */}
      <div className="px-6 py-8">
        <h1 className="text-[34px] leading-none font-extrabold tracking-tight text-white">
          <span className="text-[#3e7bff]">QC</span> SUITE
        </h1>
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
            C
          </div>
          <span className="text-sm font-semibold text-white">ChiLH</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
