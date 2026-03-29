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
    <div className="rounded-[16px] border border-[#d8e0ec] bg-[#f8fafc] p-6 transition-shadow hover:shadow-sm">
      {/* Icon + Pass Rate */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <span className="text-xl opacity-70" role="img" aria-label="build">
          🔧
        </span>
        <div className="min-w-[88px] text-right">
          <span className={`block text-[44px] font-extrabold leading-none ${getPassRateColor(passRate)}`}>
            {passRate}%
          </span>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9aa8be]">Pass Rate</p>
        </div>
      </div>

      {/* Build info */}
      <h3 className="mb-1 text-[38px] font-extrabold leading-none tracking-[-0.01em] text-[#0d1d3b]">{build.name}</h3>
      <p className="mb-1 text-[32px] font-semibold leading-none text-[#0d1d3b]">{build.totalCases}</p>
      <p className="text-[34px] font-medium leading-none text-[#556987]">test cases</p>
      {statusText && (
        <p className="mt-2 text-xs text-[#8b9ab0]">{statusText}</p>
      )}

      {/* Actions */}
      <div className="mt-6 flex items-center gap-2 border-t border-[#e2e8f0] pt-4">
        <button
          onClick={(e) => { e.stopPropagation(); onCopy?.(); }}
          className="rounded-md border border-[#9fb5ff] px-3 py-1 text-sm text-[#2f5bff] transition-colors hover:bg-[#eaf0ff]"
        >
          Copy
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRename?.(); }}
          className="rounded-md border border-[#bfc9d8] px-3 py-1 text-sm text-[#435774] transition-colors hover:bg-[#edf2f8]"
        >
          Rename
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          className="px-3 py-1 text-sm text-[#ff335f] transition-colors hover:text-[#dc1847]"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default BuildCard;
