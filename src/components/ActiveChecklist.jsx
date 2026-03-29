import React from 'react';
import { capitalizeDisplayName } from '../utils/textFormat';

const NEON_STATUS_STYLES = {
  PENDING: {
    badge: 'bg-[#e8edf4] text-[#4d607e]',
    card: 'border-[#d9e0ec] bg-gradient-to-br from-[#f8fbff] via-[#f6f9fe] to-[#edf3fb]',
    detail: 'text-[#7a8aa7]',
    progress: 'from-[#98a7c3] to-[#7f8fae]',
    metric: 'text-[#6f7f99]',
  },
  'HAS BUGS': {
    badge: 'bg-[#ffe6e6] text-[#d43b2f]',
    card: 'border-[#f4cbcc] bg-gradient-to-br from-[#fff7f7] via-[#fff2f2] to-[#ffeaea]',
    detail: 'text-[#a76363]',
    progress: 'from-[#ff4775] to-[#b81d43]',
    metric: 'text-[#d0264a]',
  },
  'IN PROGRESS': {
    badge: 'bg-[#fff6dc] text-[#b7791f]',
    card: 'border-[#ecdcb2] bg-gradient-to-br from-[#fffdf5] via-[#fff8e9] to-[#ffefcf]',
    detail: 'text-[#a08042]',
    progress: 'from-[#f5b32f] to-[#df8a00]',
    metric: 'text-[#c07a1b]',
  },
  PASSED: {
    badge: 'bg-[#e5f8ee] text-[#1a8f54]',
    card: 'border-[#cdebd8] bg-gradient-to-br from-[#f7fffb] via-[#f0fff7] to-[#e4f9ee]',
    detail: 'text-[#5f9a79]',
    progress: 'from-[#22c55e] to-[#1c9c4f]',
    metric: 'text-[#17914f]',
  },
};

const ENTERPRISE_STATUS_STYLES = {
  PENDING: {
    badge: 'bg-[#eef2f7] text-[#5d6e87]',
    card: 'border-[#d7dfea] bg-white',
    detail: 'text-[#8a98ad]',
    progress: 'from-[#8fa0bd] to-[#7688a8]',
    metric: 'text-[#5d6e87]',
  },
  'HAS BUGS': {
    badge: 'bg-[#fdeced] text-[#b93845]',
    card: 'border-[#edd1d5] bg-white',
    detail: 'text-[#aa747a]',
    progress: 'from-[#ef4b5f] to-[#c32743]',
    metric: 'text-[#bf3348]',
  },
  'IN PROGRESS': {
    badge: 'bg-[#fff7e5] text-[#a67323]',
    card: 'border-[#eadcbc] bg-white',
    detail: 'text-[#9e8557]',
    progress: 'from-[#f0b24c] to-[#ce8a21]',
    metric: 'text-[#a67323]',
  },
  PASSED: {
    badge: 'bg-[#e8f8ef] text-[#267b4f]',
    card: 'border-[#cce8d8] bg-white',
    detail: 'text-[#6b9a83]',
    progress: 'from-[#31b86b] to-[#228b53]',
    metric: 'text-[#267b4f]',
  },
};

const ActiveChecklist = ({ checklist, themeVariant = 'neon' }) => {
  const displayBuildName = capitalizeDisplayName(checklist.buildName);
  const displayProjectName = capitalizeDisplayName(checklist.projectName);
  const displayVersionName = capitalizeDisplayName(checklist.versionName);
  const themeMap = themeVariant === 'enterprise' ? ENTERPRISE_STATUS_STYLES : NEON_STATUS_STYLES;
  const statusTheme = themeMap[checklist.status] || themeMap.PENDING;
  const total = Number(checklist.total || 0);
  const failed = Number(checklist.failed || 0);
  const warning = Number(checklist.warning || 0);
  const notRun = Number(checklist.notRun || 0);
  const executionPercent = Number(checklist.executionPercent || 0);
  const executionLabel = Number.isInteger(executionPercent)
    ? String(executionPercent)
    : executionPercent.toFixed(2).replace(/\.00$/, '');

  let statusDetail = '';
  if (checklist.status === 'HAS BUGS') {
    const issueCount = failed + warning;
    statusDetail = `${issueCount} issue${issueCount === 1 ? '' : 's'}`;
  }
  if (checklist.status === 'PENDING') statusDetail = `${notRun} pending`;
  if (checklist.status === 'PASSED') statusDetail = `${total} passed`;
  if (checklist.status === 'IN PROGRESS') statusDetail = `${Math.max(total - notRun, 0)}/${total} executed`;

  return (
    <div className={`relative overflow-hidden rounded-[18px] border px-5 py-5 shadow-[0_12px_24px_rgba(30,45,80,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(30,45,80,0.12)] ${statusTheme.card}`}>
      <div className="pointer-events-none absolute right-[-52px] top-[-52px] h-28 w-28 rounded-full bg-white/40 blur-2xl" />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`inline-block rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.13em] ${statusTheme.badge}`}>
            {checklist.status}
          </span>
          {statusDetail && (
            <span className={`text-[13px] font-semibold ${statusTheme.detail}`}>{statusDetail}</span>
          )}
        </div>
        <button
          className="rounded-md p-1 text-[#8fa0bb] transition-colors hover:bg-[#edf2f8] hover:text-[#5c6f8c]"
          title="More actions"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7.5A1.5 1.5 0 1010 8a1.5 1.5 0 000 3.5zM10 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
          </svg>
        </button>
      </div>

      <h3 className="mt-6 line-clamp-1 text-[32px] font-extrabold leading-[0.95] tracking-[-0.02em] text-[#0d1d3b]">
        {displayBuildName}
      </h3>

      <p className="mt-3 line-clamp-1 text-sm font-semibold text-[#6d7f99]">
        Project: {displayProjectName} <span className="px-1">·</span> Version: {displayVersionName}
      </p>

      <div className="mt-7">
        <div className="mb-3 flex items-end justify-between gap-3">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#5f708a]">
            Test Execution
          </span>
          <span className={`text-[40px] font-extrabold leading-none tracking-[-0.02em] ${statusTheme.metric}`}>
            {executionLabel}%
          </span>
        </div>
        <div className="h-3.5 w-full rounded-full bg-[#d6dee8]">
          <div
            className={`h-3.5 rounded-full bg-gradient-to-r transition-all duration-300 ${statusTheme.progress}`}
            style={{ width: `${checklist.executionPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default ActiveChecklist;
