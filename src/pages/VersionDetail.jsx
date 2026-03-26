import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getBuilds,
  getProjects,
  getVersions,
  createBuild,
  copyBuild,
  updateBuild,
  deleteBuild,
} from '../api/client';
import BuildCard from '../components/BuildCard';
import Modal from '../components/Modal';

export default function VersionDetail() {
  const { projectId, versionId } = useParams();
  const navigate = useNavigate();

  const [builds, setBuilds] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [versionName, setVersionName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBuild, setSelectedBuild] = useState(null);
  const [nameInput, setNameInput] = useState('');

  const fetchBuilds = useCallback(() => {
    setLoading(true);
    Promise.all([getBuilds(versionId), getProjects(), getVersions(projectId)])
      .then(([builds, projects, versions]) => {
        setBuilds(Array.isArray(builds) ? builds : []);
        const project = projects.find((p) => String(p.id) === String(projectId));
        setProjectName(project?.name || `Project ${projectId}`);
        const version = versions.find((v) => String(v.id) === String(versionId));
        setVersionName(version?.name || `Version ${versionId}`);
      })
      .catch((err) => setError(err.message || 'Failed to load builds'))
      .finally(() => setLoading(false));
  }, [versionId, projectId]);

  useEffect(() => {
    fetchBuilds();
  }, [fetchBuilds]);

  const handleCreate = () => {
    if (!nameInput.trim()) return;
    createBuild(versionId, { name: nameInput.trim() }).then(() => {
      setShowCreateModal(false);
      setNameInput('');
      fetchBuilds();
    });
  };

  const handleCopy = (build) => {
    copyBuild(build.id).then(() => fetchBuilds());
  };

  const handleRename = () => {
    if (!nameInput.trim() || !selectedBuild) return;
    updateBuild(selectedBuild.id, { name: nameInput.trim() }).then(() => {
      setShowRenameModal(false);
      setNameInput('');
      setSelectedBuild(null);
      fetchBuilds();
    });
  };

  const handleDelete = () => {
    if (!selectedBuild) return;
    deleteBuild(selectedBuild.id).then(() => {
      setShowDeleteModal(false);
      setSelectedBuild(null);
      fetchBuilds();
    });
  };

  const openRename = (build) => {
    setSelectedBuild(build);
    setNameInput(build.name);
    setShowRenameModal(true);
  };

  const openDelete = (build) => {
    setSelectedBuild(build);
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
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link to="/projects" className="hover:text-blue-600 transition-colors">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/projects/${projectId}`} className="hover:text-blue-600 transition-colors">
          {projectName}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">{versionName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">{versionName}</h1>
        <button
          onClick={() => {
            setNameInput('');
            setShowCreateModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + New Build
        </button>
      </div>
      <p className="text-gray-500 mb-6">Select a build to open its checklist</p>

      {/* Grid */}
      {builds.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg">No builds yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {builds.map((build) => (
            <div
              key={build.id}
              onClick={() =>
                navigate(
                  `/projects/${projectId}/versions/${versionId}/builds/${build.id}`
                )
              }
              className="cursor-pointer"
            >
              <BuildCard
                build={build}
                onCopy={(e) => {
                  e.stopPropagation();
                  handleCopy(build);
                }}
                onRename={(e) => {
                  e.stopPropagation();
                  openRename(build);
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  openDelete(build);
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
        title="New Build"
        onConfirm={handleCreate}
        confirmText="Create"
      >
        <label className="block text-sm font-medium text-gray-700 mb-1">Build Name</label>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="e.g. Build #42"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
      </Modal>

      {/* Rename Modal */}
      <Modal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        title="Rename Build"
        onConfirm={handleRename}
        confirmText="Save"
      >
        <label className="block text-sm font-medium text-gray-700 mb-1">Build Name</label>
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
        title="Delete Build"
        onConfirm={handleDelete}
        confirmText="Delete"
        confirmVariant="danger"
      >
        <p className="text-gray-600">
          Are you sure you want to delete <strong>{selectedBuild?.name}</strong>? All test cases
          will be permanently removed.
        </p>
      </Modal>
    </div>
  );
}
