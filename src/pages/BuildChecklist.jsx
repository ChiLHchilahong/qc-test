import { readDocx, readPDF } from "../utils/fileReader";
import { generateTestCases } from "../utils/ai";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getTestCases, getProjects, getVersions, getBuilds,
  createTestCase, updateTestCase, deleteTestCase,
  importTestCases, createJiraIssue, sendBugsToJira,
} from '../api/client';
import Modal from '../components/Modal';

const RESULT_CFG = {
  'Not Run': { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },
  Passed:    { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  Failed:    { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  Blocked:   { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
};
const RESULTS = Object.keys(RESULT_CFG);
const STATUS_CFG = {
  'To Do':       { bg: '#f1f5f9', color: '#64748b' },
  'In Progress': { bg: '#eff6ff', color: '#1d4ed8' },
  Yes:           { bg: '#f0fdf4', color: '#16a34a' },
};
const STATUSES = Object.keys(STATUS_CFG);

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

async function parseFileToRows(file) {
  const XLSX = await loadXLSX();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return rows.map((r) => ({
    feature:       r['Feature'] || r['feature'] || r['Module'] || '',
    description:   r['Test Case Description'] || r['description'] || r['Test Case'] || r['Title'] || '',
    testToPerform: r['Test To Perform'] || r['testToPerform'] || r['Steps'] || '',
    testStatus:    r['?Test'] || r['Test Status'] || r['testStatus'] || 'To Do',
    result:        r['Result'] || r['result'] || 'Not Run',
    issue:         r['Issue (Jira)'] || r['Issue'] || r['issue'] || '',
    note:          r['Note'] || r['note'] || '',
  }));
}

async function exportToExcel(testCases, meta) {
  const XLSX = await loadXLSX();
  const counts = { Passed: 0, Failed: 0, Blocked: 0, 'Not Run': 0 };
  testCases.forEach((tc) => { if (counts[tc.result] !== undefined) counts[tc.result]++; });
  const total = testCases.length;
  const rate = total > 0 ? Math.round(counts.Passed / total * 100) : 0;
  const summaryData = [
    ['QC Test Execution Report'], [],
    ['Project', meta.project], ['Version', meta.version], ['Build', meta.build],
    ['Tester', meta.tester], ['Date', new Date().toLocaleDateString('vi-VN')], [],
    ['SUMMARY'],
    ['Total', 'Passed', 'Failed', 'Blocked', 'Not Run', 'Pass Rate'],
    [total, counts.Passed, counts.Failed, counts.Blocked, counts['Not Run'], rate + '%'],
  ];
  const tcHeader = ['#', 'Feature', 'Test Case Description', 'Test To Perform', '?Test', 'Result', 'Issue (Jira)', 'Note'];
  const tcData = testCases.map((tc, i) => [i + 1, tc.feature || '', tc.description || '', tc.test_to_perform || '', tc.test_status || '', tc.result || '', tc.issue || '', tc.note || '']);
  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  const wsTC = XLSX.utils.aoa_to_sheet([tcHeader, ...tcData]);
  wsTC['!cols'] = [{ wch: 4 }, { wch: 18 }, { wch: 35 }, { wch: 40 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 25 }];
  wsSummary['!cols'] = [{ wch: 14 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
  XLSX.utils.book_append_sheet(wb, wsTC, 'Test Cases');
  XLSX.writeFile(wb, 'qc-report-' + meta.build + '.xlsx');
}

function buildEmailHtml(testCases, meta) {
  const counts = { Passed: 0, Failed: 0, Blocked: 0, 'Not Run': 0 };
  testCases.forEach((tc) => { if (counts[tc.result] !== undefined) counts[tc.result]++; });
  const total = testCases.length;
  const rate = total > 0 ? Math.round(counts.Passed / total * 100) : 0;
  const th = (h) => "<th style='padding:9px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;white-space:nowrap'>" + h + "</th>";
  const thead = ['#', 'Feature', 'Test Case', 'Test To Perform', '?Test', 'Result', 'Jira', 'Note'].map(th).join('');
  const tbody = testCases.map(function(tc, i) {
    const r = RESULT_CFG[tc.result] || RESULT_CFG['Not Run'];
    const s = STATUS_CFG[tc.test_status] || STATUS_CFG['To Do'];
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
    const jira = tc.issue ? "<span style='background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:2px 7px;border-radius:4px;font-size:11px;font-family:monospace'>" + tc.issue + "</span>" : "<span style='color:#e2e8f0'>&#8212;</span>";
    return "<tr style='background:" + bg + "'><td style='padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#94a3b8'>" + (i+1) + "</td><td style='padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569'>" + (tc.feature||'&#8212;') + "</td><td style='padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b'>" + (tc.description||'&#8212;') + "</td><td style='padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569'>" + (tc.test_to_perform||'&#8212;') + "</td><td style='padding:8px 12px;border-bottom:1px solid #f1f5f9'><span style='background:" + s.bg + ";color:" + s.color + ";padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600'>" + (tc.test_status||'To Do') + "</span></td><td style='padding:8px 12px;border-bottom:1px solid #f1f5f9'><span style='background:" + r.bg + ";color:" + r.color + ";border:1px solid " + r.border + ";padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700'>" + (tc.result||'Not Run') + "</span></td><td style='padding:8px 12px;border-bottom:1px solid #f1f5f9'>" + jira + "</td><td style='padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b'>" + (tc.note||'&#8212;') + "</td></tr>";
  }).join('');
  const statBadges = Object.entries(RESULT_CFG).map(function(e) { const k=e[0],v=e[1]; return "<td style='padding:9px 13px;background:" + v.bg + ";border-radius:8px;border:1px solid " + v.border + ";text-align:center'><div style='font-size:17px;font-weight:700;color:" + v.color + "'>" + (counts[k]||0) + "</div><div style='font-size:10px;color:" + v.color + "'>" + k + "</div></td><td style='width:5px'></td>"; }).join('');
  return "<!DOCTYPE html><html><body style='font-family:Segoe UI,Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px'><div style='max-width:980px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)'><div style='background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:26px 32px;color:#fff'><div style='font-size:11px;text-transform:uppercase;letter-spacing:2px;opacity:.65;margin-bottom:4px'>Test Execution Report</div><div style='font-size:22px;font-weight:700;margin-bottom:14px'>" + meta.project + " &mdash; " + meta.version + " &mdash; " + meta.build + "</div><div style='display:flex;gap:24px;flex-wrap:wrap'><div><div style='opacity:.6;font-size:11px'>Tester</div><div style='font-weight:600'>" + meta.tester + "</div></div><div><div style='opacity:.6;font-size:11px'>Ng&agrave;y</div><div style='font-weight:600'>" + new Date().toLocaleDateString('vi-VN') + "</div></div></div></div><div style='padding:18px 28px;background:#f8fafc;border-bottom:1px solid #e2e8f0'><table style='border-collapse:separate;border-spacing:5px'><tr><td style='padding:10px 18px;background:#fff;border-radius:8px;border:1px solid #e2e8f0;text-align:center'><div style='font-size:20px;font-weight:700;color:#1e293b'>" + total + "</div><div style='font-size:11px;color:#64748b'>T&#7893;ng TC</div></td><td style='width:5px'></td><td style='padding:10px 18px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;text-align:center'><div style='font-size:20px;font-weight:700;color:#15803d'>" + rate + "%</div><div style='font-size:11px;color:#15803d'>Pass Rate</div></td><td style='width:5px'></td>" + statBadges + "</tr></table></div><div style='padding:20px 28px;overflow-x:auto'><table style='width:100%;border-collapse:collapse;min-width:700px'><thead><tr style='background:#f8fafc'>" + thead + "</tr></thead><tbody>" + tbody + "</tbody></table></div><div style='padding:12px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8'>Generated by QC Suite &bull; " + new Date().toLocaleDateString('vi-VN') + " &bull; " + meta.tester + "</div></div></body></html>";
}

function ResultBadge({ result, onClick }) {
  const cfg = RESULT_CFG[result] || RESULT_CFG['Not Run'];
  return (
    <button onClick={onClick} title="Click để đổi"
      style={{ background: cfg.bg, color: cfg.color, border: '1px solid ' + cfg.border, padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {result || 'Not Run'}
    </button>
  );
}

function ImportDropZone({ onParsed }) {
  const [dragging, setDragging] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef();
  async function handle(file) {
    setErr('');
    try { const rows = await parseFileToRows(file); if (!rows.length) { setErr('File trống.'); return; } onParsed(rows); }
    catch (e) { setErr('Lỗi: ' + e.message); }
  }
  return (
    <div>
      <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
        onClick={() => ref.current.click()}
        style={{ border: '2px dashed ' + (dragging ? '#3b82f6' : '#cbd5e1'), borderRadius: 10, padding: '22px 16px', textAlign: 'center', cursor: 'pointer', background: dragging ? '#eff6ff' : '#f8fafc' }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Kéo thả file Excel / CSV vào đây</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>hoặc click để chọn (.xlsx, .xls, .csv)</div>
        <input ref={ref} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) handle(e.target.files[0]); }} />
      </div>
      {err && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '6px 10px', borderRadius: 6, fontSize: 12, marginTop: 6 }}>{err}</div>}
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Cột mẫu: <strong>Feature | Test Case Description | Test To Perform | ?Test | Result | Issue (Jira) | Note</strong></div>
    </div>
  );
}

function JiraModal({ tc, onClose, onCreated }) {
  const [summary, setSummary] = useState(tc.description || '');
  const [desc, setDesc] = useState(tc.note || '');
  const [priority, setPriority] = useState('Medium');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  function submit() {
    setLoading(true); setErr('');
    createJiraIssue({ summary, description: desc, priority, testCaseId: tc.id })
      .then((data) => onCreated(tc.id, data.key))
      .catch((e) => { setErr(e.response?.data?.error || e.message); setLoading(false); });
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', marginBottom: 16 }}>🐛 Tạo Jira Bug</div>
        {err && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{err}</div>}
        <label className="block text-sm font-medium text-gray-700 mb-1">Summary *</label>
        <input value={summary} onChange={(e) => setSummary(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3" />
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3" />
        <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-5">
          {['Highest', 'High', 'Medium', 'Low', 'Lowest'].map((p) => <option key={p}>{p}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Hủy</button>
          <button onClick={submit} disabled={loading || !summary.trim()} className={'px-4 py-2 rounded-lg text-sm font-semibold text-white ' + (loading || !summary.trim() ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700')}>
            {loading ? 'Đang tạo...' : 'Tạo Bug'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportModal({ testCases, meta, onClose }) {
  const [tester, setTester] = useState('');
  const [copied, setCopied] = useState(false);
  const m = { ...meta, tester: tester || 'QC Team' };
  const html = buildEmailHtml(testCases, m);
  async function copyEmail() {
    try { const blob = new Blob([html], { type: 'text/html' }); await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]); }
    catch { navigator.clipboard.writeText(html); }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }
  function dlHtml() {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = 'qc-report-' + meta.build + '.html'; a.click();
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', padding: '18px 24px', color: '#fff' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>📊 Xuất Report</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{meta.project} — {meta.version} — {meta.build}</div>
        </div>
        <div style={{ padding: 24 }}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tên Tester</label>
          <input value={tester} onChange={(e) => setTester(e.target.value)} placeholder="Nguyen Van A" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <button onClick={() => exportToExcel(testCases, m)} style={{ padding: 12, borderRadius: 10, border: '2px solid #16a34a', background: '#f0fdf4', color: '#16a34a', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📊 Excel (.xlsx)</button>
            <button onClick={copyEmail} style={{ padding: 12, borderRadius: 10, border: '2px solid #2563eb', background: copied ? '#1e3a5f' : '#eff6ff', color: copied ? '#fff' : '#2563eb', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{copied ? '✓ Đã copy!' : '📋 Copy Email'}</button>
          </div>
          <button onClick={dlHtml} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>⬇ Download HTML</button>
          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e', marginBottom: 16 }}>Mẹo: Copy Email → Outlook → Ctrl+V vào body → Gửi</div>
          <div style={{ textAlign: 'right' }}><button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Đóng</button></div>
        </div>
      </div>
    </div>
  );
}

export default function BuildChecklist() {
  const { projectId, versionId, buildId } = useParams();
  const [testCases, setTestCases] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [versionName, setVersionName] = useState('');
  const [buildName, setBuildName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [jiraTc, setJiraTc] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTC, setNewTC] = useState({ feature: '', description: '', testToPerform: '' });
  const [editCell, setEditCell] = useState(null);
  const [editVal, setEditVal] = useState('');

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([getTestCases(buildId), getProjects(), getVersions(projectId), getBuilds(versionId)])
      .then(([tcs, projects, versions, builds]) => {
        setTestCases(Array.isArray(tcs) ? tcs : []);
        setProjectName(projects.find((p) => String(p.id) === String(projectId))?.name || '');
        setVersionName(versions.find((v) => String(v.id) === String(versionId))?.name || '');
        setBuildName(builds.find((b) => String(b.id) === String(buildId))?.name || '');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [buildId, projectId, versionId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function cycleResult(tc) {
    const next = RESULTS[(RESULTS.indexOf(tc.result) + 1) % RESULTS.length];
    updateTestCase(tc.id, { result: next }).then(fetchAll);
  }
  function saveEdit() {
    if (!editCell) return;
    const body = {};
    if (editCell.field === 'test_to_perform') body.testToPerform = editVal;
    else if (editCell.field === 'test_status') body.testStatus = editVal;
    else body[editCell.field] = editVal;
    updateTestCase(editCell.id, body).then(fetchAll);
    setEditCell(null);
  }
  function handleImport(rows) {
    // ✅ AI IMPORT DOC/PDF
    const handleImportAI = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      let text = "";

      try {
        if (file.name.endsWith(".docx")) {
          text = await readDocx(file);
        } else if (file.name.endsWith(".pdf")) {
          text = await readPDF(file);
        } else {
          alert("Chỉ hỗ trợ PDF hoặc DOCX");
          return;
        }

        const aiData = await generateTestCases(text);

        const mapped = aiData.map((t) => ({
          feature: t.feature,
          description: t.description,
          testToPerform: t.steps,
          testStatus: "To Do",
          result: "Not Run",
          issue: "",
          note: "",
        }));

        setImportLoading(true);

        await importTestCases(buildId, mapped);

        fetchAll();
        alert("✅ Import AI thành công!");
      } catch (err) {
        console.error(err);
        alert("❌ Lỗi AI import");
      } finally {
        setImportLoading(false);
      }
    };
    setImportLoading(true);
    importTestCases(buildId, rows).then(() => { fetchAll(); setShowImport(false); }).catch((e) => alert('Import lỗi: ' + e.message)).finally(() => setImportLoading(false));
  }
  const exportData = () => {
  if (!testCases || testCases.length === 0) {
    alert("Không có data để export");
    return;
  }

  const headers = [
    "Feature",
    "Test Case Description",
    "Test To Perform",
    "Test",
    "Result",
    "Issue",
    "Note",
  ];

  const rows = testCases.map((t) => [
    t.feature || "",
    t.description || "",
    t.testToPerform || "",
    t.testStatus || "",
    t.result || "",
    t.issue || "",
    t.note || "",
  ]);

  const csvContent =
    [headers, ...rows]
      .map((e) => e.map((x) => `"${x}"`).join(","))
      .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "testcases.csv";
  a.click();
};
  function handleJiraCreated(tcId, key) {
    updateTestCase(tcId, { issue: key }).then(() => { fetchAll(); setJiraTc(null); });
  }
  function handleAddTC() {
    if (!newTC.description.trim()) return;
    createTestCase(buildId, newTC).then(() => { setShowAddModal(false); setNewTC({ feature: '', description: '', testToPerform: '' }); fetchAll(); });
  }
  function handleDelete(id) {
    if (!window.confirm('Xóa test case này?')) return;
    deleteTestCase(id).then(fetchAll);
  }

  const stats = { total: testCases.length, passed: testCases.filter((t) => t.result === 'Passed').length, failed: testCases.filter((t) => t.result === 'Failed').length, blocked: testCases.filter((t) => t.result === 'Blocked').length, notRun: testCases.filter((t) => !t.result || t.result === 'Not Run').length };
  const passRate = stats.total > 0 ? Math.round(stats.passed / stats.total * 100) : 0;

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;
  if (error) return <div className="p-6"><div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div></div>;

  const meta = { project: projectName, version: versionName, build: buildName };
  const COLS = [
    { key: 'feature',         label: 'Feature (A)',               w: 120 },
    { key: 'description',     label: 'Test Case Description (B)', w: 200 },
    { key: 'test_to_perform', label: 'Test to Perform (C)',        w: 220 },
    { key: 'test_status',     label: '?Test (D)', type: 'status', w: 110 },
    { key: 'result',          label: 'Result (E)', type: 'result', w: 110 },
    { key: 'issue',           label: 'Issue (F)',                  w: 110 },
    { key: 'note',            label: 'Note (G)',                   w: 160 },
  ];

  return (
    <div className="p-6">
      <nav className="text-sm text-gray-500 mb-4">
        <Link to="/projects" className="hover:text-blue-600 transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <Link to={'/projects/' + projectId} className="hover:text-blue-600 transition-colors">{projectName}</Link>
        <span className="mx-2">/</span>
        <Link to={'/projects/' + projectId + '/versions/' + versionId} className="hover:text-blue-600 transition-colors">{versionName}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">{buildName}</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-4">{buildName}</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        {[{ l: 'Total', v: stats.total, c: 'bg-gray-100 text-gray-700' }, { l: 'Pass Rate', v: passRate + '%', c: 'bg-green-100 text-green-700' }, { l: 'Passed', v: stats.passed, c: 'bg-emerald-100 text-emerald-700' }, { l: 'Failed', v: stats.failed, c: 'bg-red-100 text-red-700' }, { l: 'Blocked', v: stats.blocked, c: 'bg-orange-100 text-orange-700' }, { l: 'Not Run', v: stats.notRun, c: 'bg-gray-100 text-gray-500' }].map((s) => (
          <span key={s.l} className={'px-3 py-1 rounded-full text-sm font-semibold ' + s.c}>{s.l}: {s.v}</span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setShowImport(!showImport)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">📂 Import Excel/CSV</button>
        <button onClick={() => sendBugsToJira(buildId).then(fetchAll).catch((e) => alert(e.message))} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">Send to Jira</button>
        <button onClick={() => setShowReport(true)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">📊 Report</button>
        <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">+ Add Test Case</button>
        <button onClick={exportData} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2">📁 Export Excel/CSV </button>
      </div>

      {showImport && (
        <div className="mb-4 bg-white rounded-xl shadow p-4">
          <ImportDropZone onParsed={handleImport} />
          {importLoading && <p className="text-blue-600 text-sm mt-2">Đang import...</p>}
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: '#1a1f36' }}>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase w-10">#</th>
                {COLS.map((c) => <th key={c.key} className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider" style={{ minWidth: c.w }}>{c.label}</th>)}
                <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {testCases.length === 0 ? (
                <tr><td colSpan={COLS.length + 2} className="px-6 py-16 text-center text-gray-400">Chưa có test case. Bấm Import hoặc Add Test Case.</td></tr>
              ) : testCases.map((tc, idx) => (
                <tr key={tc.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
                  {COLS.map((col) => {
                    const isEditing = editCell?.id === tc.id && editCell?.field === col.key;
                    if (col.type === 'result') return (
                      <td key={col.key} className="px-3 py-2"><ResultBadge result={tc.result || 'Not Run'} onClick={() => cycleResult(tc)} /></td>
                    );
                    if (col.type === 'status') {
                      const scfg = STATUS_CFG[tc.test_status] || STATUS_CFG['To Do'];
                      return (
                        <td key={col.key} className="px-3 py-2">
                          <select value={tc.test_status || 'To Do'} onChange={(e) => updateTestCase(tc.id, { testStatus: e.target.value }).then(fetchAll)} style={{ background: scfg.bg, color: scfg.color, border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {STATUSES.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        </td>
                      );
                    }
                    return (
                      <td key={col.key} className="px-3 py-1">
                        {isEditing ? (
                          <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} onBlur={saveEdit} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditCell(null); }} className="w-full border border-blue-400 rounded px-2 py-1 text-xs outline-none" style={{ minWidth: col.w - 20 }} />
                        ) : (
                          <div onClick={() => { setEditCell({ id: tc.id, field: col.key }); setEditVal(tc[col.key] || ''); }} className="cell-editable px-2 py-1 rounded text-xs min-h-[24px] cursor-text" title="Click để sửa">
                            {col.key === 'issue' && tc.issue ? <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 7px', borderRadius: 4, fontFamily: 'monospace', fontSize: 11 }}>{tc.issue}</span> : (tc[col.key] || <span className="text-gray-300">—</span>)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex gap-1">
                      {tc.result === 'Failed' && !tc.issue && <button onClick={() => setJiraTc(tc)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-semibold" title="Tạo bug Jira">🐛 Jira</button>}
                      <button onClick={() => handleDelete(tc.id)} className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600">✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Test Case" onConfirm={handleAddTC} confirmText="Add">
        <div className="space-y-3">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Feature</label><input value={newTC.feature} onChange={(e) => setNewTC((p) => ({ ...p, feature: e.target.value }))} placeholder="e.g. Login" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Test Case Description *</label><textarea value={newTC.description} onChange={(e) => setNewTC((p) => ({ ...p, description: e.target.value }))} placeholder="Mô tả test case" rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Test to Perform</label><textarea value={newTC.testToPerform} onChange={(e) => setNewTC((p) => ({ ...p, testToPerform: e.target.value }))} placeholder="Các bước thực hiện" rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
        </div>
      </Modal>

      {jiraTc && <JiraModal tc={jiraTc} onClose={() => setJiraTc(null)} onCreated={handleJiraCreated} />}
      {showReport && <ReportModal testCases={testCases} meta={meta} onClose={() => setShowReport(false)} />}
    </div>
  );
}
