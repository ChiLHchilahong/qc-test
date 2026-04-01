import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  getProjects,
  getVersions,
  getBuilds,
  getTestCases,
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

function normalizeResult(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'Not Run';
  if (raw === 'passed' || raw === 'pass') return 'Passed';
  if (raw === 'failed' || raw === 'fail') return 'Failed';
  if (raw === 'warning' || raw === 'warn') return 'Warning';
  if (raw === 'in progress' || raw === 'in-progress' || raw === 'in_progress' || raw === 'inprogress') return 'In Progress';
  return 'Not Run';
}

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
  const queryVersionName = searchParams.get('versionName') || '';
  const queryBuildId = searchParams.get('buildId') || '';
  const queryBuildName = searchParams.get('buildName') || '';
  const queryName = searchParams.get('name') || '';
  const queryCreate = searchParams.get('create') === '1';
  const [untestedCases, setUntestedCases] = useState([]);
  const [planIntro, setPlanIntro] = useState('');
  const [planHelperCopied, setPlanHelperCopied] = useState(false);
  const [planCopyMode, setPlanCopyMode] = useState('full');
  const [showPlanHelperDetails, setShowPlanHelperDetails] = useState(false);
  const [helperContext, setHelperContext] = useState({ buildId: '', buildName: '', sourceLabel: '' });

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

  useEffect(() => {
    if (!showCreateModal) {
      setHelperContext({ buildId: '', buildName: '', sourceLabel: '' });
      setUntestedCases([]);
      return;
    }

    if (queryBuildId) {
      setHelperContext({
        buildId: queryBuildId,
        buildName: queryBuildName,
        sourceLabel: `Build hiện tại${queryBuildName ? `: ${queryBuildName}` : ''}`,
      });
      return;
    }

    if (!queryVersionId) {
      setHelperContext({ buildId: '', buildName: '', sourceLabel: '' });
      setUntestedCases([]);
      return;
    }

    getBuilds(queryVersionId)
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        if (!list.length) {
          setHelperContext({ buildId: '', buildName: '', sourceLabel: '' });
          setUntestedCases([]);
          return;
        }

        const latestBuild = [...list].sort((left, right) => {
          const leftTime = Date.parse(left.createdAt || left.created_at || '') || 0;
          const rightTime = Date.parse(right.createdAt || right.created_at || '') || 0;
          if (rightTime !== leftTime) return rightTime - leftTime;
          return Number(right.id || 0) - Number(left.id || 0);
        })[0];

        setHelperContext({
          buildId: String(latestBuild?.id || ''),
          buildName: latestBuild?.name || '',
          sourceLabel: `Build mới nhất của version${queryVersionName ? ` ${queryVersionName}` : ''}`,
        });
      })
      .catch(() => {
        setHelperContext({ buildId: '', buildName: '', sourceLabel: '' });
        setUntestedCases([]);
      });
  }, [queryBuildId, queryBuildName, queryVersionId, queryVersionName, showCreateModal]);

  useEffect(() => {
    if (!showCreateModal || !helperContext.buildId) {
      setUntestedCases([]);
      return;
    }

    getTestCases(helperContext.buildId)
      .then((rows) => {
        const items = (Array.isArray(rows) ? rows : []).filter((tc) => {
          // "Chưa test" = chưa có kết quả chạy, không phụ thuộc ?Test Yes/No
          return normalizeResult(tc.result) === 'Not Run';
        });
        setUntestedCases(items);
      })
      .catch(() => setUntestedCases([]));
  }, [helperContext.buildId, showCreateModal]);

  const groupedUntestedCases = useMemo(() => {
    return untestedCases.reduce((acc, tc) => {
      const key = String(tc.feature || 'General').trim() || 'General';
      if (!acc[key]) acc[key] = [];
      acc[key].push(tc);
      return acc;
    }, {});
  }, [untestedCases]);

  const planObjectiveSuggestion = useMemo(() => {
    if (!untestedCases.length) return '';
    const features = Object.keys(groupedUntestedCases);
    const featurePreview = features.slice(0, 4).join(', ');
    return `Focus on ${untestedCases.length} not-run test cases for ${helperContext.buildName || queryVersionName || 'current scope'} across ${features.length} feature(s): ${featurePreview}${features.length > 4 ? ', ...' : ''}.`;
  }, [groupedUntestedCases, helperContext.buildName, queryVersionName, untestedCases]);

  const estimatedHours = useMemo(() => {
    if (!untestedCases.length) return 0;
    return Math.max(1, Math.ceil(untestedCases.length / 3));
  }, [untestedCases]);

  const summaryBullets = useMemo(() => {
    return Object.entries(groupedUntestedCases).map(([feature, cases]) => {
      const topCases = cases.slice(0, 2).map((tc) => tc.description || tc.testToPerform || '').filter(Boolean);
      const suffix = cases.length > 2 ? ` và ${cases.length - 2} case khác` : '';
      return `${feature}: ${topCases.join('; ')}${suffix}`.trim();
    }).filter(Boolean);
  }, [groupedUntestedCases]);

  const buildPlanHelperHtml = useCallback(() => {
    const today = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    const intro = planIntro.trim();
    const targetName = helperContext.buildName || queryVersionName || form.name || 'current scope';
    const summaryHtml = summaryBullets
      .map((line) => `<li style='margin:0 0 8px;color:#374151;font-size:14px'>${line}</li>`)
      .join('');
    const blocks = Object.entries(groupedUntestedCases).map(([feature, cases]) => {
      const items = cases
        .map((tc) => `<li style='margin:3px 0;color:#374151;font-size:14px'>${tc.description || tc.testToPerform || ''}</li>`)
        .join('');
      return `<li style='margin-bottom:10px;color:#374151;font-size:14px;font-weight:600'>${feature}:<ul style='margin:6px 0 0 16px;list-style:circle;padding-left:8px'>${items}</ul></li>`;
    }).join('');
    const detailSection = planCopyMode === 'summary'
      ? ''
      : `<div style='margin:0 0 18px'><p style='margin:0 0 10px;font-size:14px;font-weight:700;color:#1e293b'><em>Danh sách case chưa test:</em></p>${blocks ? `<ul style='margin:0 0 0 20px;padding-left:20px;list-style:disc;line-height:1.9'>${blocks}</ul>` : `<p style='margin:0;color:#64748b;font-size:14px'>Hiện chưa có case chưa test.</p>`}</div>`;

    return (
      `<!DOCTYPE html><html><head><meta charset='utf-8'></head><body style='font-family:Segoe UI,Calibri,Arial,sans-serif;color:#1e293b;margin:0;padding:24px;background:#f8fafc'>` +
      `<div style='max-width:720px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 16px rgba(0,0,0,.08)'>` +
      `<p style='margin:0 0 16px;font-size:14px;color:#1e293b'>Dear team,</p>` +
      `<p style='margin:0 0 14px;font-size:14px;color:#1e293b'>QC gửi plan test cho <strong style='color:#1d4ed8'>${targetName}</strong> - ngày ${today}</p>` +
      (intro ? `<p style='margin:0 0 16px;font-size:14px;color:#374151'>${intro.replace(/\n/g, '<br>')}</p>` : '') +
      `<div style='margin:0 0 18px'><p style='margin:0 0 10px;font-size:14px;font-weight:700;color:#1e293b'><em>Tóm tắt ý chính:</em></p><ul style='margin:0 0 0 20px;padding-left:20px;list-style:disc;line-height:1.9'>${summaryHtml || `<li style='color:#64748b'>Hiện chưa có case chưa test để tóm tắt.</li>`}</ul></div>` +
      detailSection +
      `<p style='margin:0 0 20px;font-size:14px;color:#1e293b'><strong>Estimate time:</strong> ${estimatedHours || 0} hours</p>` +
      `<div style='border-top:1px solid #e2e8f0;padding-top:16px'><p style='margin:0;font-size:14px;color:#374151'>Best regards,</p><p style='margin:4px 0 0;font-size:14px;color:#374151'><strong>${form.assignee || 'QC Team'}</strong></p></div>` +
      `</div></body></html>`
    );
  }, [estimatedHours, form.assignee, form.name, groupedUntestedCases, helperContext.buildName, planCopyMode, planIntro, queryVersionName, summaryBullets]);

  const handleCopyPlanHelper = useCallback(async () => {
    const html = buildPlanHelperHtml();
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) })]);
    } catch {
      await navigator.clipboard.writeText(html);
    }
    setPlanHelperCopied(true);
    setTimeout(() => setPlanHelperCopied(false), 2500);
  }, [buildPlanHelperHtml]);

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
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
          <button
            onClick={handleDownloadTemplateExcel}
            className="rounded-lg bg-slate-500 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600"
          >
            Template Excel
          </button>
          <button
            onClick={handleDownloadTemplateCSV}
            className="rounded-lg bg-slate-500 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600"
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
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Export CSV
          </button>
          <button
            onClick={handleOpenCreate}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
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
              onClick={() => navigate(`/test-plans/${plan.id}`)}
              className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <span className="text-left text-lg font-semibold text-gray-900">
                  {plan.name}
                </span>
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
                  onClick={(e) => { e.stopPropagation(); navigate(`/test-plans/${plan.id}`); }}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Open
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openDelete(plan); }}
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

          {(queryBuildId || helperContext.buildId) && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-sky-900">Plan Helper From Current Build</div>
                  <div className="text-xs text-sky-700">Giữ nguyên modal hiện tại, chỉ thêm khối hỗ trợ lấy case chưa test từ {helperContext.sourceLabel || 'build hiện tại'}{helperContext.buildName ? ` (${helperContext.buildName})` : ''}.</div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-sky-700">{untestedCases.length} case chưa test</span>
                  <span className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-emerald-700">{Object.keys(groupedUntestedCases).length} feature</span>
                  <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-amber-700">~ {estimatedHours} giờ</span>
                </div>
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-sm font-medium text-gray-700">Nội dung mở đầu để copy sang Outlook</label>
                <textarea
                  value={planIntro}
                  onChange={(e) => setPlanIntro(e.target.value)}
                  className="h-14 w-full rounded-lg border border-sky-200 bg-white px-3 py-2"
                  placeholder={`VD: Test các tính năng mới của ${helperContext.buildName || queryVersionName || 'scope hiện tại'}:`}
                />
              </div>

              <div className="mb-3 rounded-lg border border-white/80 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Summary đề xuất cho Objective</div>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, objective: planObjectiveSuggestion || prev.objective }))}
                    disabled={!planObjectiveSuggestion}
                    className="rounded-lg border border-sky-200 bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Use In Objective
                  </button>
                </div>
                <div className="text-sm text-gray-700">{planObjectiveSuggestion || 'Không có case chưa test để gợi ý summary.'}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={planCopyMode}
                  onChange={(e) => setPlanCopyMode(e.target.value)}
                  className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                >
                  <option value="full">Tóm tắt + list case</option>
                  <option value="summary">Chỉ tóm tắt ý chính</option>
                </select>
                <button
                  type="button"
                  onClick={handleCopyPlanHelper}
                  className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                >
                  {planHelperCopied ? 'Đã copy cho Outlook' : 'Copy Outlook Plan'}
                </button>
                <button
                  type="button"
                  onClick={() => setPlanIntro((prev) => prev || `Test các tính năng mới của ${helperContext.buildName || queryVersionName || 'scope hiện tại'}:`)}
                  className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"
                >
                  Điền intro mẫu
                </button>
                <button
                  type="button"
                  onClick={() => setShowPlanHelperDetails((v) => !v)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  {showPlanHelperDetails ? 'Ẩn chi tiết case' : 'Hiện chi tiết case'}
                </button>
                <span className="self-center text-xs text-gray-500">Estimate gợi ý: {estimatedHours} giờ.</span>
              </div>

              {showPlanHelperDetails && (
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg border border-white/80 bg-white p-3">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Tóm tắt ý chính để gửi mail</div>
                    {summaryBullets.length === 0 ? (
                      <div className="text-sm text-emerald-700">Không có case chưa test để tóm tắt.</div>
                    ) : (
                      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                        {summaryBullets.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-lg border border-white/80 bg-white p-3">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Danh sách case chưa test</div>
                    {untestedCases.length === 0 ? (
                      <div className="text-sm text-emerald-700">Không có case nào đang ở trạng thái Not Run.</div>
                    ) : (
                      <div className="max-h-44 space-y-3 overflow-y-auto pr-1 text-sm text-gray-700">
                        {Object.entries(groupedUntestedCases).map(([feature, cases]) => (
                          <div key={feature}>
                            <div className="font-semibold text-slate-800">{feature}</div>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-gray-600">
                              {cases.map((tc) => (
                                <li key={tc.id}>{tc.description || tc.testToPerform || '(không có mô tả)'}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

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
