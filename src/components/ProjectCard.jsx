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
    </div>
  );
};

export default ProjectCard;
