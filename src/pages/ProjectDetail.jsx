import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getVersions, getProjects, createVersion, updateVersion, deleteVersion, deleteProject } from '../api/client';
import VersionCard from '../components/VersionCard';
import Modal from '../components/Modal';
import { capitalizeDisplayName } from '../utils/textFormat';

export default function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [versions, setVersions] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [nameInput, setNameInput] = useState('');

  const fetchVersions = useCallback(() => {
    setLoading(true);
    Promise.all([getVersions(projectId), getProjects()])
      .then(([versions, projects]) => {
        setVersions(Array.isArray(versions) ? versions : []);
        const project = projects.find((p) => String(p.id) === String(projectId));
        setProjectName(project?.name || `Project ${projectId}`);
      })
      .catch((err) => setError(err.message || 'Failed to load versions'))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleCreate = () => {
    if (!nameInput.trim()) return;
    createVersion(projectId, { name: nameInput.trim() }).then(() => {
      setShowCreateModal(false);
      setNameInput('');
      fetchVersions();
    });
  };

  const handleRename = () => {
    if (!nameInput.trim() || !selectedVersion) return;
    updateVersion(selectedVersion.id, { name: nameInput.trim() }).then(() => {
      setShowRenameModal(false);
      setNameInput('');
      setSelectedVersion(null);
      fetchVersions();
    });
  };

  const handleDelete = () => {
    if (!selectedVersion) return;
    deleteVersion(selectedVersion.id).then(() => {
      setShowDeleteModal(false);
      setSelectedVersion(null);
      fetchVersions();
    });
  };

  const handleDeleteProject = () => {
    deleteProject(projectId).then(() => {
      setShowDeleteProjectModal(false);
      navigate('/projects', { replace: true });
    });
  };

  const openRename = (version) => {
    setSelectedVersion(version);
    setNameInput(version.name);
    setShowRenameModal(true);
  };

  const openDelete = (version) => {
    setSelectedVersion(version);
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

  const displayProjectName = capitalizeDisplayName(projectName);

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link to="/projects" className="hover:text-blue-600 transition-colors">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">{displayProjectName}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h1 className="text-2xl font-bold text-gray-900">{displayProjectName}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setNameInput('');
              setShowCreateModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + New Version
          </button>
          <button
            onClick={() => setShowDeleteProjectModal(true)}
            className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Delete Project
          </button>
        </div>
      </div>
      <p className="text-gray-500 mb-6">Select a version to view its builds</p>

      {/* Grid */}
      {versions.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg">No versions yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {versions.map((version) => (
            <div
              key={version.id}
              onClick={() => navigate(`/projects/${projectId}/versions/${version.id}`)}
              className="cursor-pointer"
            >
              <VersionCard
                version={version}
                onRename={() => openRename(version)}
                onDelete={() => openDelete(version)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Version"
        onConfirm={handleCreate}
        confirmText="Create"
      >
        <label className="block text-sm font-medium text-gray-700 mb-1">Version Name</label>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="e.g. v1.0.0"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
      </Modal>

      {/* Rename Modal */}
      <Modal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        title="Rename Version"
        onConfirm={handleRename}
        confirmText="Save"
      >
        <label className="block text-sm font-medium text-gray-700 mb-1">Version Name</label>
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
        title="Delete Version"
        onConfirm={handleDelete}
        confirmText="Delete"
        confirmVariant="danger"
      >
        <p className="text-gray-600">
          Are you sure you want to delete <strong>{selectedVersion?.name}</strong>? All builds and
          test cases will be permanently removed.
        </p>
      </Modal>

      <Modal
        isOpen={showDeleteProjectModal}
        onClose={() => setShowDeleteProjectModal(false)}
        title="Delete Project"
        onConfirm={handleDeleteProject}
        confirmText="Delete"
        confirmVariant="danger"
      >
        <p className="text-gray-600">
          Are you sure you want to delete <strong>{displayProjectName}</strong>? All versions, builds and
          test cases will be permanently removed.
        </p>
      </Modal>
    </div>
  );
}
