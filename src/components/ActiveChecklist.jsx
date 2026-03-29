import React from 'react';
import { capitalizeDisplayName } from '../utils/textFormat';

const STATUS_STYLES = {
  PENDING: 'bg-[#e8edf4] text-[#4d607e]',
  'HAS BUGS': 'bg-[#ffe6e3] text-[#d43b2f]',
  'IN PROGRESS': 'bg-[#fff6dc] text-[#b7791f]',
  PASSED: 'bg-[#e5f8ee] text-[#1a8f54]',
};

const ActiveChecklist = ({ checklist }) => {
  const displayBuildName = capitalizeDisplayName(checklist.buildName);
  const displayProjectName = capitalizeDisplayName(checklist.projectName);
  const displayVersionName = capitalizeDisplayName(checklist.versionName);
  const statusClass = STATUS_STYLES[checklist.status] || STATUS_STYLES.PENDING;
  const total = Number(checklist.total || 0);
  const failed = Number(checklist.failed || 0);
  const warning = Number(checklist.warning || 0);
  const notRun = Number(checklist.notRun || 0);

  let statusDetail = '';
  if (checklist.status === 'HAS BUGS') {
    const issueCount = failed + warning;
    statusDetail = `${issueCount} issue${issueCount === 1 ? '' : 's'}`;
  }
  if (checklist.status === 'PENDING') statusDetail = `${notRun} pending`;
  if (checklist.status === 'PASSED') statusDetail = `${total} passed`;
  if (checklist.status === 'IN PROGRESS') statusDetail = `${Math.max(total - notRun, 0)}/${total} executed`;

  return (
    <div className="rounded-[18px] border border-[#d8e0ec] bg-[#f8fafc] px-5 py-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] ${statusClass}`}>
            {checklist.status}
          </span>
          {statusDetail && (
            <span className="text-xs font-semibold text-[#7a8ba5]">{statusDetail}</span>
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

      <h3 className="mt-7 line-clamp-1 text-[35px] font-extrabold leading-none tracking-[-0.01em] text-[#0d1d3b]">
        {displayBuildName}
      </h3>

      <p className="mt-3 line-clamp-1 text-sm font-semibold text-[#6d7f99]">
        Project: {displayProjectName} <span className="px-1">·</span> Version: {displayVersionName}
      </p>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#5f708a]">
            Test Execution
          </span>
          <span className="text-[40px] font-extrabold leading-none text-[#324766]">
            {checklist.executionPercent}%
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-[#d6dee8]">
          <div
            className="h-2.5 rounded-full bg-[#4f6ef7] transition-all duration-300"
            style={{ width: `${checklist.executionPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default ActiveChecklist;
