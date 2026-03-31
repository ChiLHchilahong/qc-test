import React from 'react';
import { capitalizeDisplayName } from '../utils/textFormat';

const ProjectCard = ({ project, onRename, onDelete }) => {
  const displayProjectName = capitalizeDisplayName(project.name);

  return (
    <div className="bg-white rounded-xl shadow p-6 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl" role="img" aria-label="folder">
            📁
          </span>
          <div>
            <h3 className="text-lg font-bold text-gray-800">{displayProjectName}</h3>
            <p className="text-sm text-gray-500">Created: {project.createdAt}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
        <button
          onClick={(e) => { e.stopPropagation(); onRename?.(); }}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Rename
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          className="px-3 py-1 text-sm text-red-500 hover:text-red-700 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default ProjectCard;
