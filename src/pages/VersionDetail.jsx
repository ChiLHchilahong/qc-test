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
import { capitalizeDisplayName } from '../utils/textFormat';

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

  const displayProjectName = capitalizeDisplayName(projectName);
  const displayVersionName = capitalizeDisplayName(versionName);

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-3 sm:px-4 md:px-2">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-[#7e8ea6]">
        <Link to="/projects" className="transition-colors hover:text-[#2f5bff]">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/projects/${projectId}`} className="transition-colors hover:text-[#2f5bff]">
          {displayProjectName}
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#1b2b49]">{displayVersionName}</span>
      </nav>

      {/* Header */}
      <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between max-[393px]:gap-2">
        <h1 className="text-2xl font-extrabold leading-none tracking-[-0.01em] text-[#0d1d3b] sm:text-3xl md:text-4xl max-[393px]:text-[26px]">{displayVersionName}</h1>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            onClick={() => navigate(`/test-plans?projectId=${projectId}&versionId=${versionId}&create=1`)}
            className="w-full rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-100 sm:w-auto sm:px-5 sm:py-3 sm:text-base max-[393px]:py-2"
          >
            + Test Plan
          </button>
          <button
            onClick={() => {
              setNameInput('');
              setShowCreateModal(true);
            }}
            className="w-full rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#4f16df] px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-95 sm:w-auto sm:px-5 sm:py-3 sm:text-base max-[393px]:py-2"
          >
            + New Build
          </button>
        </div>
      </div>
      <p className="mb-6 text-base font-medium text-[#5f708a] sm:mb-8 sm:text-lg max-[393px]:text-sm">Select a build to open its checklist</p>

      {/* Grid */}
      {builds.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg">No builds yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
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
                onCopy={() => handleCopy(build)}
                onRename={() => openRename(build)}
                onDelete={() => openDelete(build)}
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
          Are you sure you want to delete <strong>{capitalizeDisplayName(selectedBuild?.name)}</strong>? All test cases
          will be permanently removed.
        </p>
      </Modal>
    </div>
  );
}
