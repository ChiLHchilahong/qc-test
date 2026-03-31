import React, { useState, useEffect, useCallback } from 'react';
import { getBugs, createBug, updateBug, deleteBug, getProjects } from '../api/client';
import Modal from '../components/Modal';

const SEVERITY_OPTIONS = ['Critical', 'Major', 'Minor', 'Trivial'];
const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];
const STATUS_OPTIONS   = ['Open', 'In Progress', 'Fixed', 'Retest', 'Closed'];

const SEVERITY_CFG = {
  Critical:  { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  Major:     { bg: '#fff7ed', color: '#c2410c', border: '#fdba74' },
  Minor:     { bg: '#fefce8', color: '#a16207', border: '#fde047' },
  Trivial:   { bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
};

const STATUS_CFG = {
  Open:         { bg: '#fee2e2', color: '#b91c1c' },
  'In Progress':{ bg: '#fef3c7', color: '#b45309' },
  Fixed:        { bg: '#dcfce7', color: '#15803d' },
  Retest:       { bg: '#ede9fe', color: '#7c3aed' },
  Closed:       { bg: '#f1f5f9', color: '#475569' },
};

const PRIORITY_CFG = {
  High:   { color: '#b91c1c' },
  Medium: { color: '#c2410c' },
  Low:    { color: '#15803d' },
};

const EMPTY_FORM = {
  title: '',
  description: '',
  steps_to_reproduce: '',
  expected_result: '',
  actual_result: '',
  severity: 'Major',
  priority: 'Medium',
  status: 'Open',
  environment: '',
  project_id: '',
  reported_by: '',
  assigned_to: '',
};

export default function Bugs() {
  const [bugs, setBugs]           = useState([]);
  const [projects, setProjects]   = useState([]);
  const [loading, setLoading]     = useState(true);

  // Filters
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterSeverity,setFilterSeverity]= useState('');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);   // bug being edited
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);

  const fetchBugs = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {};
      if (filterProject) filters.project_id = filterProject;
      if (filterStatus)  filters.status = filterStatus;
      if (filterSeverity)filters.severity = filterSeverity;
      const data = await getBugs(filters);
      setBugs(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [filterProject, filterStatus, filterSeverity]);

  useEffect(() => {
    getProjects().then((data) => setProjects(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => { fetchBugs(); }, [fetchBugs]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setShowCreate(true);
  };

  const openEdit = (bug) => {
    setForm({
      title:               bug.title || '',
      description:         bug.description || '',
      steps_to_reproduce:  bug.steps_to_reproduce || '',
      expected_result:     bug.expected_result || '',
      actual_result:       bug.actual_result || '',
      severity:            bug.severity || 'Major',
      priority:            bug.priority || 'Medium',
      status:              bug.status || 'Open',
      environment:         bug.environment || '',
      project_id:          bug.project_id ? String(bug.project_id) : '',
      reported_by:         bug.reported_by || '',
      assigned_to:         bug.assigned_to || '',
    });
    setEditTarget(bug);
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, project_id: form.project_id ? Number(form.project_id) : null };
      if (editTarget) {
        await updateBug(editTarget.id, payload);
      } else {
        await createBug(payload);
      }
      setShowCreate(false);
      fetchBugs();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteBug(deleteTarget.id);
    setDeleteTarget(null);
    fetchBugs();
  };

  const handleStatusChange = async (bug, newStatus) => {
    await updateBug(bug.id, { status: newStatus });
    fetchBugs();
  };

  // Stats
  const stats = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = bugs.filter((b) => b.status === s).length;
    return acc;
  }, {});

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bug Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý bug nội bộ — Circle Tribe QC</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          + Report Bug
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        {STATUS_OPTIONS.map((s) => (
          <span
            key={s}
            style={{ background: STATUS_CFG[s].bg, color: STATUS_CFG[s].color, border: `1px solid ${STATUS_CFG[s].color}30` }}
            className="px-3 py-1 rounded-full text-xs font-semibold cursor-pointer"
            onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
          >
            {s}: {stats[s] || 0}
          </span>
        ))}
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
          Total: {bugs.length}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <option value="">All Severity</option>
          {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {(filterProject || filterStatus || filterSeverity) && (
          <button
            onClick={() => { setFilterProject(''); setFilterStatus(''); setFilterSeverity(''); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: '#1a1f36' }}>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase w-10">#</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase" style={{ minWidth: 220 }}>Title</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase" style={{ minWidth: 100 }}>Project</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase" style={{ minWidth: 90 }}>Severity</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase" style={{ minWidth: 70 }}>Priority</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase" style={{ minWidth: 110 }}>Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase" style={{ minWidth: 100 }}>Assigned To</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase" style={{ minWidth: 90 }}>Reported By</th>
                <th className="px-3 py-3 text-xs font-semibold text-white uppercase" style={{ minWidth: 90 }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="px-6 py-16 text-center text-gray-400">Loading...</td></tr>
              ) : bugs.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-16 text-center text-gray-400">Chưa có bug nào. Bấm + Report Bug để thêm.</td></tr>
              ) : bugs.map((bug, idx) => {
                const sev = SEVERITY_CFG[bug.severity] || SEVERITY_CFG.Major;
                const sta = STATUS_CFG[bug.status] || STATUS_CFG.Open;
                const pri = PRIORITY_CFG[bug.priority] || PRIORITY_CFG.Medium;
                return (
                  <tr key={bug.id} className={idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                    <td className="px-3 py-2 text-xs text-gray-400">{bug.id}</td>
                    <td className="px-3 py-2">
                      <div className="text-sm font-medium text-gray-900">{bug.title}</div>
                      {bug.environment && (
                        <div className="text-xs text-gray-400 mt-0.5">env: {bug.environment}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{bug.project_name || '—'}</td>
                    <td className="px-3 py-2">
                      <span
                        style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}
                        className="px-2 py-0.5 rounded text-xs font-semibold"
                      >
                        {bug.severity}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span style={{ color: pri.color }} className="text-xs font-bold">{bug.priority}</span>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={bug.status}
                        onChange={(e) => handleStatusChange(bug, e.target.value)}
                        style={{ background: sta.bg, color: sta.color, border: `1px solid ${sta.color}40` }}
                        className="rounded px-2 py-1 text-xs font-semibold cursor-pointer"
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{bug.assigned_to || '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{bug.reported_by || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => openEdit(bug)}
                          className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(bug)}
                          className="text-xs px-2 py-1 rounded bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title={editTarget ? `Edit Bug #${editTarget.id}` : 'Report New Bug'}
        onConfirm={handleSave}
        confirmText={saving ? 'Saving...' : editTarget ? 'Save Changes' : 'Report Bug'}
      >
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Mô tả ngắn gọn bug"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select
                value={form.severity}
                onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {SEVERITY_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {PRIORITY_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <select
                value={form.project_id}
                onChange={(e) => setForm((p) => ({ ...p, project_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {projects.map((proj) => <option key={proj.id} value={proj.id}>{proj.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
              <input
                value={form.environment}
                onChange={(e) => setForm((p) => ({ ...p, environment: e.target.value }))}
                placeholder="e.g. Android 13 / iPhone 15"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reported By</label>
              <input
                value={form.reported_by}
                onChange={(e) => setForm((p) => ({ ...p, reported_by: e.target.value }))}
                placeholder="Tên QC"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
              <input
                value={form.assigned_to}
                onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))}
                placeholder="Dev hoặc QC"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Mô tả chi tiết bug"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Steps to Reproduce</label>
            <textarea
              value={form.steps_to_reproduce}
              onChange={(e) => setForm((p) => ({ ...p, steps_to_reproduce: e.target.value }))}
              placeholder="1. Vào màn hình...&#10;2. Nhấn...&#10;3. Bug xuất hiện..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Result</label>
              <textarea
                value={form.expected_result}
                onChange={(e) => setForm((p) => ({ ...p, expected_result: e.target.value }))}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Actual Result</label>
              <textarea
                value={form.actual_result}
                onChange={(e) => setForm((p) => ({ ...p, actual_result: e.target.value }))}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Bug"
        onConfirm={handleDelete}
        confirmText="Delete"
      >
        <p className="text-sm text-gray-700">
          Bạn có chắc muốn xóa bug <strong>#{deleteTarget?.id} — {deleteTarget?.title}</strong>?
        </p>
      </Modal>
    </div>
  );
}
