import React from 'react';

const STATUS_STYLES = {
  PENDING: 'bg-gray-200 text-gray-700',
  'HAS BUGS': 'bg-red-500 text-white',
  PASSED: 'bg-green-500 text-white',
};

const ActiveChecklist = ({ checklist }) => {
  const statusClass = STATUS_STYLES[checklist.status] || STATUS_STYLES.PENDING;

  return (
    <div className="bg-white rounded-xl shadow p-6">
      {/* Status badge */}
      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase ${statusClass}`}>
        {checklist.status}
      </span>

      {/* Build name */}
      <h3 className="text-xl font-bold text-gray-800 mt-3">
        {checklist.buildName}
      </h3>

      {/* Project + Version subtitle */}
      <p className="text-sm text-gray-500 mt-1">
        Project: {checklist.projectName} &bull; Version: {checklist.versionName}
      </p>

      {/* Test Execution */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Test Execution
          </span>
          <span className="text-sm font-bold text-gray-700">
            {checklist.executionPercent}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${checklist.executionPercent}%` }}
          />
        </div>
      </div>

      {/* Action icons */}
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100">
        <button className="text-gray-400 hover:text-blue-500 transition-colors" title="View">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
        <button className="text-gray-400 hover:text-blue-500 transition-colors" title="Edit">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ActiveChecklist;
