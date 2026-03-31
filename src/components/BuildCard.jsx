import React from 'react';
import { capitalizeDisplayName } from '../utils/textFormat';

const getPassRateColor = (rate) => {
  if (rate === 0) return 'text-yellow-500';
  if (rate === 100) return 'text-green-500';
  return 'text-orange-500';
};

const BuildCard = ({ build, onCopy, onRename, onDelete }) => {
  const displayBuildName = capitalizeDisplayName(build.name);
  const passRate = build.totalCases > 0
    ? Math.round((build.passedCases / build.totalCases) * 100)
    : 0;

  const statusText = build.notRunCases != null
    ? `Not Run: ${build.notRunCases}`
    : '';

  return (
    <div className="rounded-[16px] border border-[#d8e0ec] bg-[#f8fafc] p-4 transition-shadow hover:shadow-sm sm:p-6 max-[393px]:p-3.5">
      {/* Icon + Pass Rate */}
      <div className="mb-4 flex items-start justify-between gap-3 sm:mb-6">
        <span className="text-xl opacity-70" role="img" aria-label="build">
          🔧
        </span>
        <div className="min-w-[72px] text-right sm:min-w-[88px]">
          <span className={`block text-[28px] font-extrabold leading-none sm:text-[34px] max-[393px]:text-[24px] ${getPassRateColor(passRate)}`}>
            {passRate}%
          </span>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9aa8be]">Pass Rate</p>
        </div>
      </div>

      {/* Build info */}
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9aa8be]">Build</p>
      <h3 className="mt-1 line-clamp-2 break-words text-[28px] font-extrabold leading-[0.95] tracking-[-0.02em] text-[#0d1d3b] sm:line-clamp-1 sm:text-[44px] sm:leading-none max-[393px]:text-[24px]">{displayBuildName}</h3>

      <div className="mt-4 flex items-baseline gap-2">
        <p className="text-[20px] font-bold leading-none text-[#0d1d3b] sm:text-[28px] max-[393px]:text-[18px]">{build.totalCases}</p>
        <p className="text-[15px] font-semibold leading-none text-[#556987] sm:text-lg max-[393px]:text-[14px]">test cases</p>
      </div>
      {statusText && (
        <p className="mt-2 text-xs text-[#8b9ab0]">{statusText}</p>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[#e2e8f0] pt-4">
        <button
          onClick={(e) => { e.stopPropagation(); onCopy?.(); }}
          className="rounded-md border border-[#9fb5ff] px-3 py-1 text-xs text-[#2f5bff] transition-colors hover:bg-[#eaf0ff] sm:text-sm"
        >
          Copy
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRename?.(); }}
          className="rounded-md border border-[#bfc9d8] px-3 py-1 text-xs text-[#435774] transition-colors hover:bg-[#edf2f8] sm:text-sm"
        >
          Rename
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          className="px-3 py-1 text-xs text-[#ff335f] transition-colors hover:text-[#dc1847] sm:text-sm"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default BuildCard;
