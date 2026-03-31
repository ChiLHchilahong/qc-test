import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  getProjects,
  getVersions,
  getTestPlans,
  createTestPlan,
  deleteTestPlan,
  importTestPlans,
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

const READY_BADGE = {
  READY: 'bg-emerald-100 text-emerald-700',
  BLOCKED: 'bg-rose-100 text-rose-700',
  RISKY: 'bg-amber-100 text-amber-700',
  NO_VERSION: 'bg-slate-100 text-slate-700',
};

async function loadXLSX() {
  if (window._XLSX) return window._XLSX;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    s.onload = () => { window._XLSX = window.XLSX; resolve(window.XLSX); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      if (currentField !== '' || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      }
    } else {
      currentField += char;
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows;
}

function normalizeHeaderKey(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeImportedPlanRow(raw) {
  const map = {};
  Object.entries(raw || {}).forEach(([k, v]) => {
    map[normalizeHeaderKey(k)] = v;
  });

  return {
    projectId: map.project_id || map.projectid || '',
    projectName: map.project || map.project_name || '',
    versionId: map.version_id || map.versionid || '',
    versionName: map.version || map.version_name || '',
    name: map.plan_name || map.name || '',
    status: map.status || 'Draft',
    assignee: map.assignee || '',
    objective: map.objective || '',
    scopeIn: map.scope_in || '',
    scopeOut: map.scope_out || '',
    entryCriteria: map.entry_criteria || '',
    exitCriteria: map.exit_criteria || '',
    plannedStartDate: map.planned_start || map.planned_start_date || '',
    plannedEndDate: map.planned_end || map.planned_end_date || '',
    minPassRate: map.min_pass_rate || map.min_pass_rate_percent || 80,
    maxFailed: map.max_failed || 0,
    maxNotRunPercent: map.max_not_run_percent || 20,
  };
}

export default function TestPlans() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const queryProjectId = searchParams.get('projectId') || '';
  const queryVersionId = searchParams.get('versionId') || '';
  const queryName = searchParams.get('name') || '';
  const queryCreate = searchParams.get('create') === '1';

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
    if (queryProjectId) {
      setProjectFilter(queryProjectId);
    }
  }, [queryProjectId]);

  useEffect(() => {
    if (!form.projectId) {
      setVersions([]);
      return;
    }
    getVersions(form.projectId)
      .then((rows) => setVersions(Array.isArray(rows) ? rows : []))
      .catch(() => setVersions([]));
  }, [form.projectId]);

  useEffect(() => {
    if (!queryCreate) return;

    setForm((prev) => ({
      ...prev,
      projectId: queryProjectId || prev.projectId,
      versionId: queryVersionId || prev.versionId,
      name: queryName || prev.name,
    }));
    setShowCreateModal(true);

    // Clear one-time creation params so modal does not auto-open again on refresh/revisit.
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    nextParams.delete('name');
    setSearchParams(nextParams, { replace: true });
  }, [queryCreate, queryProjectId, queryVersionId, queryName, searchParams, setSearchParams]);

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

  const handleExportCSV = () => {
    if (!plans.length) {
      alert('Không có test plan để export');
      return;
    }

    const headers = [
      'Plan Name', 'Status', 'Readiness', 'Project', 'Project ID', 'Version', 'Version ID',
      'Assignee', 'Objective', 'Scope In', 'Scope Out', 'Entry Criteria', 'Exit Criteria',
      'Planned Start', 'Planned End', 'Min Pass Rate', 'Max Failed', 'Max Not Run %'
    ];
    const rows = plans.map((p) => [
      p.name || '',
      p.status || '',
      p.execution_readiness_status || '',
      p.project_name || '',
      p.project_id || '',
      p.version_name || '',
      p.version_id || '',
      p.assignee || '',
      p.objective || '',
      p.scope_in || '',
      p.scope_out || '',
      p.entry_criteria || '',
      p.exit_criteria || '',
      p.planned_start_date || '',
      p.planned_end_date || '',
      p.min_pass_rate ?? 80,
      p.max_failed ?? 0,
      p.max_not_run_percent ?? 20,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((x) => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(','))
      .join('\n');

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `test-plans-${Date.now()}.csv`;
    a.click();
  };

  const handleExportExcel = async () => {
    if (!plans.length) {
      alert('Không có test plan để export');
      return;
    }

    const XLSX = await loadXLSX();
    const rows = plans.map((p) => ({
      'Plan Name': p.name || '',
      Status: p.status || '',
      Readiness: p.execution_readiness_status || '',
      Project: p.project_name || '',
      'Project ID': p.project_id || '',
      Version: p.version_name || '',
      'Version ID': p.version_id || '',
      Assignee: p.assignee || '',
      Objective: p.objective || '',
      'Scope In': p.scope_in || '',
      'Scope Out': p.scope_out || '',
      'Entry Criteria': p.entry_criteria || '',
      'Exit Criteria': p.exit_criteria || '',
      'Planned Start': p.planned_start_date || '',
      'Planned End': p.planned_end_date || '',
      'Min Pass Rate': p.min_pass_rate ?? 80,
      'Max Failed': p.max_failed ?? 0,
      'Max Not Run %': p.max_not_run_percent ?? 20,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Test Plans');
    XLSX.writeFile(wb, `test-plans-${Date.now()}.xlsx`);
  };

  const handleDownloadTemplateCSV = () => {
    const headers = [
      'Plan Name', 'Status', 'Project', 'Project ID', 'Version', 'Version ID',
      'Assignee', 'Objective', 'Scope In', 'Scope Out', 'Entry Criteria', 'Exit Criteria',
      'Planned Start', 'Planned End', 'Min Pass Rate', 'Max Failed', 'Max Not Run %'
    ];
    const sampleRow = [
      'Regression Plan - Sprint 12',
      'Draft',
      'Guest',
      '',
      '1.2.1',
      '',
      'QA Lead',
      'Validate core user flows and critical modules',
      'Login, Project, Build Checklist',
      'Performance testing',
      'Stable test environment and test data ready',
      'No critical defects and pass rate reaches threshold',
      '2026-04-01',
      '2026-04-05',
      '80',
      '0',
      '20',
    ];

    const csv = [headers, sampleRow]
      .map((row) => row.map((x) => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(','))
      .join('\n');

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = 'test-plan-import-template.csv';
    a.click();
  };

  const handleDownloadTemplateExcel = async () => {
    const XLSX = await loadXLSX();
    const rows = [
      {
        'Plan Name': 'Regression Plan - Sprint 12',
        Status: 'Draft',
        Project: 'Guest',
        'Project ID': '',
        Version: '1.2.1',
        'Version ID': '',
        Assignee: 'QA Lead',
        Objective: 'Validate core user flows and critical modules',
        'Scope In': 'Login, Project, Build Checklist',
        'Scope Out': 'Performance testing',
        'Entry Criteria': 'Stable test environment and test data ready',
        'Exit Criteria': 'No critical defects and pass rate reaches threshold',
        'Planned Start': '2026-04-01',
        'Planned End': '2026-04-05',
        'Min Pass Rate': 80,
        'Max Failed': 0,
        'Max Not Run %': 20,
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'test-plan-import-template.xlsx');
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const fileName = String(file.name || '').toLowerCase();
      let rawRows = [];

      if (fileName.endsWith('.csv')) {
        const text = await file.text();
        const rows = parseCSV(text);
        if (!rows.length) throw new Error('CSV rỗng');
        const headers = rows[0].map((h) => normalizeHeaderKey(h));
        rawRows = rows.slice(1).filter((r) => r.some((v) => String(v || '').trim())).map((r) => {
          const obj = {};
          headers.forEach((h, idx) => { obj[h] = r[idx] ?? ''; });
          return obj;
        });
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const XLSX = await loadXLSX();
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
      } else {
        throw new Error('Chỉ hỗ trợ file CSV hoặc Excel');
      }

      const plansForImport = rawRows
        .map(normalizeImportedPlanRow)
        .filter((row) => String(row.name || '').trim());

      if (!plansForImport.length) {
        throw new Error('Không tìm thấy dòng test plan hợp lệ trong file');
      }

      const result = await importTestPlans(plansForImport);
      await fetchData();

      const errorCount = Array.isArray(result?.errors) ? result.errors.length : 0;
      alert(`✅ Imported ${result?.imported ?? 0} plans${errorCount ? `\n⚠️ ${errorCount} dòng lỗi (xem console)` : ''}`);
      if (errorCount) {
        console.warn('Test plan import errors:', result.errors);
      }
    } catch (e) {
      alert('❌ Import lỗi: ' + (e?.message || 'Unknown error'));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => handleImportFile(e.target.files?.[0])}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? 'Importing...' : 'Import Excel/CSV'}
          </button>
          <button
            onClick={handleDownloadTemplateExcel}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Template Excel
          </button>
          <button
            onClick={handleDownloadTemplateCSV}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Template CSV
          </button>
          <button
            onClick={handleExportExcel}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Export Excel
          </button>
          <button
            onClick={handleExportCSV}
            className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            Export CSV
          </button>
          <button
            onClick={handleOpenCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
          >
            + New Test Plan
          </button>
        </div>
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

              <div className="mb-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${READY_BADGE[plan.execution_readiness_status] || READY_BADGE.NO_VERSION}`}>
                  {plan.execution_readiness_status || 'NO_VERSION'}
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
        onConfirm={handleCreate}
        confirmText="Create"
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

        </div>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Test Plan"
        onConfirm={handleDelete}
        confirmText="Delete"
        confirmVariant="danger"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Delete <span className="font-semibold text-gray-900">{selectedPlan?.name || 'this plan'}</span>? This action cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
}
