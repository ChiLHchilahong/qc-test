import React from 'react';

const VersionCard = ({ version, onRename, onDelete }) => {
  return (
    <div className="bg-white rounded-xl shadow p-6 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl" role="img" aria-label="package">
          📦
        </span>
        <div>
          <h3 className="text-lg font-bold text-gray-800">{version.name}</h3>
          <p className="text-sm text-gray-500">{version.date}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={(e) => { e.stopPropagation(); onRename?.(version); }}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Rename
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(version); }}
          className="px-3 py-1 text-sm text-red-500 hover:text-red-700 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default VersionCard;
