import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getProjects,
  getVersions,
  getTestPlans,
  createTestPlan,
  deleteTestPlan,
} from '../api/client';
import Modal from '../components/Modal';

const PLAN_STATUSES = ['Draft', 'Ready', 'In Progress', 'Blocked', 'Ready for Sign-off', 'Closed'];

const initialForm = {
  projectId: '',
  versionId: '',
  name: '',
  status: 'Draft',
  assignee: '',
  objective: '',
  plannedStartDate: '',
  plannedEndDate: '',
};

export default function TestPlans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [projects, setProjects] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [form, setForm] = useState(initialForm);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectsData, plansData] = await Promise.all([
        getProjects(),
        getTestPlans({ projectId: projectFilter || undefined, status: statusFilter || undefined }),
      ]);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setPlans(Array.isArray(plansData) ? plansData : []);
    } catch (err) {
      setError(err?.message || 'Failed to load test plans');
    } finally {
      setLoading(false);
    }
  }, [projectFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!form.projectId) {
      setVersions([]);
      return;
    }
    getVersions(form.projectId)
      .then((rows) => setVersions(Array.isArray(rows) ? rows : []))
      .catch(() => setVersions([]));
  }, [form.projectId]);

  const projectMap = useMemo(() => {
    const map = new Map();
    (Array.isArray(projects) ? projects : []).forEach((p) => map.set(String(p.id), p.name));
    return map;
  }, [projects]);

  const handleOpenCreate = () => {
    setForm(initialForm);
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!String(form.projectId || '').trim() || !String(form.name || '').trim()) {
      return;
    }

    await createTestPlan({
      projectId: Number(form.projectId),
      versionId: form.versionId ? Number(form.versionId) : null,
      name: String(form.name || '').trim(),
      status: form.status,
      assignee: form.assignee,
      objective: form.objective,
      plannedStartDate: form.plannedStartDate || null,
      plannedEndDate: form.plannedEndDate || null,
    });

    setShowCreateModal(false);
    await fetchData();
  };

  const openDelete = (plan) => {
    setSelectedPlan(plan);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!selectedPlan) return;
    await deleteTestPlan(selectedPlan.id);
    setSelectedPlan(null);
    setShowDeleteModal(false);
    await fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 text-sm text-gray-500">
        <Link to="/projects" className="transition-colors hover:text-blue-600">Projects</Link>
        <span className="mx-2">/</span>
        <span className="font-medium text-gray-900">Test Plans</span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test Plans</h1>
          <p className="text-sm text-gray-500">Plan scope, owners, and readiness for each release.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
        >
          + New Test Plan
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:grid-cols-3">
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          {PLAN_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <button
          onClick={fetchData}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          No test plan yet. Create one to manage release scope.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <button
                  onClick={() => navigate(`/test-plans/${plan.id}`)}
                  className="text-left text-lg font-semibold text-gray-900 hover:text-blue-700"
                >
                  {plan.name}
                </button>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                  {plan.status}
                </span>
              </div>

              <div className="space-y-1 text-sm text-gray-600">
                <p><span className="font-medium text-gray-700">Project:</span> {plan.project_name || projectMap.get(String(plan.project_id)) || '-'}</p>
                <p><span className="font-medium text-gray-700">Version:</span> {plan.version_name || '-'}</p>
                <p><span className="font-medium text-gray-700">Assignee:</span> {plan.assignee || '-'}</p>
                <p><span className="font-medium text-gray-700">Timeline:</span> {plan.planned_start_date || '-'} to {plan.planned_end_date || '-'}</p>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => navigate(`/test-plans/${plan.id}`)}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Open
                </button>
                <button
                  onClick={() => openDelete(plan)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Test Plan"
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Project</label>
            <select
              value={form.projectId}
              onChange={(e) => setForm((prev) => ({ ...prev, projectId: e.target.value, versionId: '' }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Version (optional)</label>
            <select
              value={form.versionId}
              onChange={(e) => setForm((prev) => ({ ...prev, versionId: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              disabled={!form.projectId}
            >
              <option value="">No specific version</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Plan Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Regression Plan - Sprint 12"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {PLAN_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Assignee</label>
              <input
                value={form.assignee}
                onChange={(e) => setForm((prev) => ({ ...prev, assignee: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="QA Lead"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Objective</label>
            <textarea
              value={form.objective}
              onChange={(e) => setForm((prev) => ({ ...prev, objective: e.target.value }))}
              className="h-24 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Main quality goals for this release"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Planned Start</label>
              <input
                type="date"
                value={form.plannedStartDate}
                onChange={(e) => setForm((prev) => ({ ...prev, plannedStartDate: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Planned End</label>
              <input
                type="date"
                value={form.plannedEndDate}
                onChange={(e) => setForm((prev) => ({ ...prev, plannedEndDate: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowCreateModal(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              Create
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Test Plan"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Delete <span className="font-semibold text-gray-900">{selectedPlan?.name || 'this plan'}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="rounded-lg bg-rose-600 px-4 py-2 font-medium text-white hover:bg-rose-700"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
