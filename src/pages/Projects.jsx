import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjects, createProject, updateProject, deleteProject } from '../api/client';
import ProjectCard from '../components/ProjectCard';
import Modal from '../components/Modal';

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [nameInput, setNameInput] = useState('');

  const fetchProjects = useCallback(() => {
    setLoading(true);
    getProjects()
      .then((res) => setProjects(res))
      .catch((err) => setError(err.message || 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = () => {
    if (!nameInput.trim()) return;
    createProject({ name: nameInput.trim() }).then(() => {
      setShowCreateModal(false);
      setNameInput('');
      fetchProjects();
    });
  };

  const handleRename = () => {
    if (!nameInput.trim() || !selectedProject) return;
    updateProject(selectedProject.id, { name: nameInput.trim() }).then(() => {
      setShowRenameModal(false);
      setNameInput('');
      setSelectedProject(null);
      fetchProjects();
    });
  };

  const handleDelete = () => {
    if (!selectedProject) return;
    deleteProject(selectedProject.id).then(() => {
      setShowDeleteModal(false);
      setSelectedProject(null);
      fetchProjects();
    });
  };

  const openRename = (project) => {
    setSelectedProject(project);
    setNameInput(project.name);
    setShowRenameModal(true);
  };

  const openDelete = (project) => {
    setSelectedProject(project);
    setShowDeleteModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Project Portfolio</h1>
        <button
          onClick={() => {
            setNameInput('');
            setShowCreateModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + New Project
        </button>
      </div>

      {/* Grid */}
      {projects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg">No projects yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="cursor-pointer"
            >
              <ProjectCard
                project={project}
                onRename={(e) => {
                  e.stopPropagation();
                  openRename(project);
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  openDelete(project);
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Project"
        onConfirm={handleCreate}
        confirmText="Create"
      >
        <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Enter project name"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
      </Modal>

      {/* Rename Modal */}
      <Modal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        title="Rename Project"
        onConfirm={handleRename}
        confirmText="Save"
      >
        <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Enter new name"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleRename()}
        />
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Project"
        onConfirm={handleDelete}
        confirmText="Delete"
        confirmVariant="danger"
      >
        <p className="text-gray-600">
          Are you sure you want to delete <strong>{selectedProject?.name}</strong>? This action
          cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
