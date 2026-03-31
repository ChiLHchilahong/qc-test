import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getBugById, updateBug, deleteBug } from '../api/client';
import Modal from '../components/Modal';

const SEVERITY_OPTIONS = ['Critical', 'Major', 'Minor', 'Trivial'];
const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];
const STATUS_OPTIONS   = ['Open', 'In Progress', 'Fixed', 'Retest', 'Closed'];
const CLOSED_STATUSES  = ['Fixed', 'Closed'];

const SEVERITY_CFG = {
  Critical:  { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  Major:     { bg: '#fff7ed', color: '#c2410c', border: '#fdba74' },
  Minor:     { bg: '#fefce8', color: '#a16207', border: '#fde047' },
  Trivial:   { bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
};
const STATUS_CFG = {
  Open:          { bg: '#fee2e2', color: '#b91c1c' },
  'In Progress': { bg: '#fef3c7', color: '#b45309' },
  Fixed:         { bg: '#dcfce7', color: '#15803d' },
  Retest:        { bg: '#ede9fe', color: '#7c3aed' },
  Closed:        { bg: '#f1f5f9', color: '#475569' },
};
const PRIORITY_CFG = {
  High:   { color: '#b91c1c' },
  Medium: { color: '#c2410c' },
  Low:    { color: '#15803d' },
};

function Field({ label, value, mono = false }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm text-gray-800 whitespace-pre-wrap ${mono ? 'font-mono bg-gray-50 rounded p-2' : ''}`}>{value}</p>
    </div>
  );
}

export default function BugDetail() {
  const { bugId } = useParams();
  const navigate = useNavigate();

  const [bug, setBug]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [saving, setSaving]   = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // Inline edit state
  const [editField, setEditField] = useState(null); // which field is being edited
  const [editVal, setEditVal]     = useState('');

  const fetchBug = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBugById(bugId);
      setBug(data);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Bug not found');
    } finally {
      setLoading(false);
    }
  }, [bugId]);

  useEffect(() => { fetchBug(); }, [fetchBug]);

  const handleQuickUpdate = async (field, value) => {
    setSaving(true);
    try {
      await updateBug(bugId, { [field]: value });
      await fetchBug();
    } finally {
      setSaving(false);
      setEditField(null);
    }
  };

  const handleDelete = async () => {
    await deleteBug(bugId);
    navigate('/bugs', { replace: true });
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
      <Link to="/bugs" className="mt-4 inline-block text-sm text-blue-600 hover:underline">← Back to Bugs</Link>
    </div>
  );

  const sev = SEVERITY_CFG[bug.severity] || SEVERITY_CFG.Major;
  const sta = STATUS_CFG[bug.status]     || STATUS_CFG.Open;
  const pri = PRIORITY_CFG[bug.priority] || PRIORITY_CFG.Medium;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-5">
        <Link to="/bugs" className="hover:text-blue-600">Bug Tracker</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">Bug #{bug.id}</span>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}
                className="px-2.5 py-0.5 rounded text-xs font-bold"
              >
                {bug.severity}
              </span>
              <span style={{ color: pri.color }} className="text-xs font-bold">{bug.priority}</span>
              <span className="text-xs text-gray-400">#{bug.id}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-snug">{bug.title}</h1>
            <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
              {bug.project_name && <span>📁 {bug.project_name}</span>}
              {bug.version_name && <span>🏷️ {bug.version_name}</span>}
              {bug.build_name   && <span>🔨 {bug.build_name}</span>}
              {bug.environment  && <span>🖥️ {bug.environment}</span>}
              <span>📅 {bug.created_at ? bug.created_at.slice(0, 10) : ''}</span>
            </div>
          </div>

          {/* Status quick-change */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              value={bug.status}
              onChange={(e) => handleQuickUpdate('status', e.target.value)}
              disabled={saving}
              style={{ background: sta.bg, color: sta.color, border: `1px solid ${sta.color}40` }}
              className="rounded-lg px-3 py-2 text-sm font-semibold cursor-pointer"
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={() => setShowDelete(true)}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Assignment row */}
        <div className="mt-4 flex flex-wrap gap-6 border-t pt-4 text-sm">
          <div>
            <span className="text-xs text-gray-400 block mb-0.5">Reported By</span>
            <span className="font-medium text-gray-700">{bug.reported_by || '—'}</span>
          </div>
          <div>
            <span className="text-xs text-gray-400 block mb-0.5">Assigned To</span>
            {editField === 'assigned_to' ? (
              <input
                autoFocus
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onBlur={() => handleQuickUpdate('assigned_to', editVal)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleQuickUpdate('assigned_to', editVal); if (e.key === 'Escape') setEditField(null); }}
                className="border border-blue-400 rounded px-2 py-0.5 text-sm"
              />
            ) : (
              <span
                className="font-medium text-gray-700 cursor-pointer hover:text-blue-600 hover:underline"
                onClick={() => { setEditField('assigned_to'); setEditVal(bug.assigned_to || ''); }}
                title="Click to edit"
              >
                {bug.assigned_to || '—'}
              </span>
            )}
          </div>
          <div>
            <span className="text-xs text-gray-400 block mb-0.5">Updated</span>
            <span className="font-medium text-gray-700">{bug.updated_at ? bug.updated_at.slice(0, 16).replace('T', ' ') : '—'}</span>
          </div>
        </div>
      </div>

      {/* Body — 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: main content */}
        <div className="lg:col-span-2 space-y-5">
          {bug.description && (
            <div className="bg-white rounded-2xl shadow p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Description</h2>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{bug.description}</p>
            </div>
          )}

          {bug.steps_to_reproduce && (
            <div className="bg-white rounded-2xl shadow p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Steps to Reproduce</h2>
              <p className="text-sm text-gray-800 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-3">{bug.steps_to_reproduce}</p>
            </div>
          )}

          {(bug.expected_result || bug.actual_result) && (
            <div className="bg-white rounded-2xl shadow p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h2 className="text-sm font-bold text-green-700 mb-2 uppercase tracking-wide">Expected Result</h2>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{bug.expected_result || '—'}</p>
              </div>
              <div>
                <h2 className="text-sm font-bold text-red-700 mb-2 uppercase tracking-wide">Actual Result</h2>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{bug.actual_result || '—'}</p>
              </div>
            </div>
          )}

          {bug.resolution_note && CLOSED_STATUSES.includes(bug.status) && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-green-700 mb-2 uppercase tracking-wide">✓ Resolution Note</h2>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{bug.resolution_note}</p>
            </div>
          )}
        </div>

        {/* Right: metadata */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Details</h2>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Severity</p>
              <select
                value={bug.severity}
                onChange={(e) => handleQuickUpdate('severity', e.target.value)}
                disabled={saving}
                style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}
                className="rounded px-2 py-1 text-xs font-semibold w-full"
              >
                {SEVERITY_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Priority</p>
              <select
                value={bug.priority}
                onChange={(e) => handleQuickUpdate('priority', e.target.value)}
                disabled={saving}
                className="rounded border border-gray-300 px-2 py-1 text-xs w-full"
              >
                {PRIORITY_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>

            {bug.test_case_description && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Linked Test Case</p>
                <p className="text-xs text-gray-700 bg-gray-50 rounded p-2">{bug.test_case_description}</p>
              </div>
            )}

            {(bug.project_name || bug.version_name || bug.build_name) && (
              <div className="space-y-1 border-t pt-3">
                <Field label="Project"  value={bug.project_name} />
                <Field label="Version"  value={bug.version_name} />
                <Field label="Build"    value={bug.build_name} />
                <Field label="Environment" value={bug.environment} />
              </div>
            )}
          </div>

          {/* Inline resolution note edit when status is closed */}
          {CLOSED_STATUSES.includes(bug.status) && (
            <div className="bg-white rounded-2xl shadow p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Resolution Note</h2>
              {editField === 'resolution_note' ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    rows={3}
                    className="w-full border border-green-400 rounded-lg px-2 py-1 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleQuickUpdate('resolution_note', editVal)}
                      className="text-xs bg-green-600 text-white rounded px-3 py-1 hover:bg-green-700"
                    >Save</button>
                    <button onClick={() => setEditField(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => { setEditField('resolution_note'); setEditVal(bug.resolution_note || ''); }}
                  className="text-sm text-gray-700 cursor-pointer hover:bg-gray-50 rounded p-2 whitespace-pre-wrap min-h-[40px]"
                  title="Click to edit"
                >
                  {bug.resolution_note || <span className="text-gray-400 italic">Click to add resolution note...</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete modal */}
      <Modal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        title="Delete Bug"
        onConfirm={handleDelete}
        confirmText="Delete"
      >
        <p className="text-sm text-gray-700">
          Bạn có chắc muốn xóa bug <strong>#{bug.id} — {bug.title}</strong>?
        </p>
      </Modal>
    </div>
  );
}
