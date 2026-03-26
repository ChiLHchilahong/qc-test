import React from 'react';

const getPassRateColor = (rate) => {
  if (rate === 0) return 'text-yellow-500';
  if (rate === 100) return 'text-green-500';
  return 'text-orange-500';
};

const BuildCard = ({ build, onCopy, onRename, onDelete }) => {
  const passRate = build.totalCases > 0
    ? Math.round((build.passedCases / build.totalCases) * 100)
    : 0;

  const statusText = build.notRunCases != null
    ? `Not Run: ${build.notRunCases}`
    : '';

  return (
    <div className="bg-white rounded-xl shadow p-6 hover:shadow-md transition-shadow cursor-pointer">
      {/* Icon + Pass Rate */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl" role="img" aria-label="build">
          🔧
        </span>
        <div className="text-right">
          <span className={`text-3xl font-bold ${getPassRateColor(passRate)}`}>
            {passRate}%
          </span>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Pass Rate</p>
        </div>
      </div>

      {/* Build info */}
      <h3 className="text-lg font-bold text-gray-800 mb-1">{build.name}</h3>
      <p className="text-sm text-gray-500 mb-1">{build.totalCases} test cases</p>
      {statusText && (
        <p className="text-xs text-gray-400">{statusText}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-gray-100 mt-4">
        <button
          onClick={(e) => { e.stopPropagation(); onCopy?.(build); }}
          className="px-3 py-1 text-sm border border-blue-300 rounded-md text-blue-600 hover:bg-blue-50 transition-colors"
        >
          Copy
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRename?.(build); }}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Rename
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(build); }}
          className="px-3 py-1 text-sm text-red-500 hover:text-red-700 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default BuildCard;
