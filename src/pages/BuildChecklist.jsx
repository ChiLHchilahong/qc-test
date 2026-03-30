import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getTestCases, getProjects, getVersions, getBuilds,
  createTestCase, updateTestCase, deleteTestCase,
  importTestCases,
} from '../api/client';
import Modal from '../components/Modal';
import { capitalizeDisplayName } from '../utils/textFormat';

// ─── Config ───────────────────────────────────────────────
const RESULT_CFG = {
  'Not Run':   { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },
  Passed:      { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  Failed:      { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  Warning:     { bg: '#fff7ed', color: '#c2410c', border: '#fdba74' },
  'In Progress': { bg: '#fef3c7', color: '#b45309', border: '#fcd34d' },
};
const RESULTS = Object.keys(RESULT_CFG);
const TEST_STATUS_CFG = {
  Yes: { bg: '#dcfce7', color: '#15803d' },
  No: { bg: '#ffe4e6', color: '#be123c' },
};
const TEST_STATUS_OPTIONS = Object.keys(TEST_STATUS_CFG);
const LS_GEMINI_API_KEY = 'qc:gemini-api-key';
const LS_AI_PROMPT = 'qc:ai-prompt';

const normalizeResult = (value) => {
  if (!value || typeof value !== 'string') return 'Not Run';
  const raw = value.trim().toLowerCase();
  if (raw === 'passed' || raw === 'pass') return 'Passed';
  if (raw === 'failed' || raw === 'fail') return 'Failed';
  if (raw === 'warning' || raw === 'warn') return 'Warning';
  if (raw === 'in progress' || raw === 'in-progress' || raw === 'in_progress' || raw === 'inprogress') return 'In Progress';
  if (raw === 'not run' || raw === 'not-run' || raw === 'not_run' || raw === 'notrun') return 'Not Run';
  if (raw === 'blocked') return 'In Progress';
  // fallback: if matched any defined key ignoring case
  const key = Object.keys(RESULT_CFG).find((x) => x.toLowerCase() === raw);
  return key || 'Not Run';
};

function extractJSONArrayFromText(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return null;

  const tryParse = (input) => {
    try { return JSON.parse(input); }
    catch { return null; }
  };

  const direct = tryParse(text);
  if (Array.isArray(direct)) return direct;
  if (direct && Array.isArray(direct.testCases)) return direct.testCases;
  if (direct && Array.isArray(direct.data)) return direct.data;

  const withoutFenceStart = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  const unfenced = tryParse(withoutFenceStart);
  if (Array.isArray(unfenced)) return unfenced;
  if (unfenced && Array.isArray(unfenced.testCases)) return unfenced.testCases;
  if (unfenced && Array.isArray(unfenced.data)) return unfenced.data;

  const firstBracket = withoutFenceStart.indexOf('[');
  if (firstBracket >= 0) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = firstBracket; i < withoutFenceStart.length; i++) {
      const ch = withoutFenceStart[i];

      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === '[') depth++;
      if (ch === ']') {
        depth--;
        if (depth === 0) {
          const candidate = withoutFenceStart.slice(firstBracket, i + 1);
          const parsed = tryParse(candidate);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    }

    // Nếu mảng bị cắt giữa chừng, vẫn cố vớt các object hoàn chỉnh đã trả về.
    const salvage = [];
    let objectStart = -1;
    let objectDepth = 0;
    let arrayStarted = false;
    inString = false;
    escaped = false;

    for (let i = firstBracket; i < withoutFenceStart.length; i++) {
      const ch = withoutFenceStart[i];

      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === '[') {
        arrayStarted = true;
        continue;
      }
      if (!arrayStarted) continue;

      if (ch === '{') {
        if (objectDepth === 0) objectStart = i;
        objectDepth++;
      }

      if (ch === '}') {
        objectDepth--;
        if (objectDepth === 0 && objectStart >= 0) {
          const candidate = withoutFenceStart.slice(objectStart, i + 1);
          const parsed = tryParse(candidate);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) salvage.push(parsed);
          objectStart = -1;
        }
      }
    }

    if (salvage.length > 0) return salvage;
  }

  return null;
}

const getResultColor = (result) => {
  const normalized = normalizeResult(result);
  if (normalized === 'Passed') return 'bg-green-100 text-green-700 border-green-400';
  if (normalized === 'Failed') return 'bg-red-100 text-red-700 border-red-400';
  if (normalized === 'Warning') return 'bg-orange-100 text-orange-700 border-orange-400';
  if (normalized === 'In Progress') return 'bg-yellow-100 text-yellow-700 border-yellow-400';
  return 'bg-slate-100 text-slate-700 border-slate-300';
};
const getTestStatusColor = (status) => {
  if (status === 'Yes') return 'bg-green-100 text-green-700 border-green-400';
  if (status === 'No')  return 'bg-rose-100 text-rose-700 border-rose-400';
  return '';
};

// ─── SheetJS ──────────────────────────────────────────────
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

// CSV Parser - xử lý quoted fields đúng cách
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
        // Escaped quote
        currentField += '"';
        i++;
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f)) rows.push(currentRow);
        currentRow = [];
        currentField = '';
      }
      if (char === '\r' && nextChar === '\n') i++;
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f)) rows.push(currentRow);
  }

  return rows;
}

async function parseFileToRows(file) {
  const XLSX = await loadXLSX();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const expectedHeaders = [
    'feature', 'test case description', 'descriptions', 'description',
    'test to perform', '?test', 'test status', 'result', 'issue (jira)', 'issue', 'note',
  ];

  // Pick the sheet that looks most like a test-case table (avoid importing Summary sheet).
  const bestSheetName = wb.SheetNames.reduce((bestName, sheetName, idx) => {
    const ws = wb.Sheets[sheetName];
    const preview = XLSX.utils.sheet_to_json(ws, { defval: '', range: 0, blankrows: false });
    const headerSet = new Set(
      preview.slice(0, 3).flatMap((row) => Object.keys(row || {}).map((k) => String(k).trim().toLowerCase()))
    );
    const score = expectedHeaders.reduce((acc, h) => acc + (headerSet.has(h) ? 1 : 0), 0);
    const isBetter = !bestName || score > bestName.score || (score === bestName.score && idx > bestName.idx);
    return isBetter ? { name: sheetName, score, idx } : bestName;
  }, null)?.name || wb.SheetNames[0];

  const ws = wb.Sheets[bestSheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
  return rows.map((r) => ({
    feature:       r['Feature'] || r['feature'] || r['FEATURE (A)'] || r['Module'] || '',
    description:   r['Test Case Description'] || r['TEST CASE DESCRIPTION (B)'] || r['Descriptions'] || r['description'] || r['Title'] || '',
    testToPerform: r['Test To Perform'] || r['TEST TO PERFORM (C)'] || r['testToPerform'] || r['Steps'] || '',
    testStatus:    r['?Test'] || r['Test Status'] || 'Yes',
    result:        r['Result'] || r['result'] || 'Not Run',
    issue:         r['Issue (Jira)'] || r['Issue'] || r['issue'] || '',
    note:          r['Note'] || r['note'] || '',
  }));
}

// ─── Export CSV (giữ nguyên) ──────────────────────────────
function exportCSV(testCases) {
  if (!testCases || testCases.length === 0) { alert('Không có data để export'); return; }
  const headers = ['Feature', 'Test Case Description', 'Test To Perform', 'Test', 'Result', 'Issue', 'Note'];
  const rows = testCases.map((t) => [t.feature||'', t.description||'', t.testToPerform||t.test_to_perform||'', t.testStatus||t.test_status||'', normalizeResult(t.result), t.issue||'', t.note||'']);
  const csv = [headers, ...rows].map((e) => e.map((x) => '"' + x + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = 'testcases.csv'; a.click();
}

// ─── Export Excel ─────────────────────────────────────────
async function exportToExcel(testCases, meta) {
  const XLSX = await loadXLSX();
  const counts = { Passed: 0, Failed: 0, Warning: 0, 'In Progress': 0, 'Not Run': 0 };
  testCases.forEach((tc) => {
    const key = normalizeResult(tc.result);
    if (counts[key] !== undefined) counts[key]++;
  });
  const total = testCases.length;
  const rate = total > 0 ? Math.round(counts.Passed / total * 100) : 0;
  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.aoa_to_sheet([
    ['QC Test Execution Report'], [],
    ['Project', meta.project], ['Version', meta.version], ['Build', meta.build],
    ['Tester', meta.tester], ['Date', new Date().toLocaleDateString('vi-VN')], [],
    ['SUMMARY'],
    ['Total', 'Passed', 'Failed', 'Warning', 'In Progress', 'Not Run', 'Pass Rate'],
    [total, counts.Passed, counts.Failed, counts.Warning, counts['In Progress'], counts['Not Run'], rate + '%'],
  ]);
  const tcHeader = ['#', 'Feature', 'Test Case Description', 'Test To Perform', '?Test', 'Result', 'Issue (Jira)', 'Note'];
  const tcData = testCases.map((tc, i) => [i+1, tc.feature||'', tc.description||'', tc.testToPerform||tc.test_to_perform||'', tc.testStatus||tc.test_status||'', normalizeResult(tc.result), tc.issue||'', tc.note||'']);
  const wsTC = XLSX.utils.aoa_to_sheet([tcHeader, ...tcData]);
  wsTC['!cols'] = [{ wch: 4 }, { wch: 20 }, { wch: 40 }, { wch: 45 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 28 }];
  wsSummary['!cols'] = [{ wch: 15 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
  XLSX.utils.book_append_sheet(wb, wsTC, 'Test Cases');
  XLSX.writeFile(wb, 'qc-report-' + (meta.build || 'export') + '.xlsx');
}

// ─── Email HTML builders ──────────────────────────────────
// 1. Sum-up email (theo mẫu bạn gửi)
function buildSumUpHtml(testCases, meta, buildStatus) {
  const failed     = testCases.filter((tc) => normalizeResult(tc.result) === 'Failed');
  const warning    = testCases.filter((tc) => normalizeResult(tc.result) === 'Warning');
  const passed     = testCases.filter((tc) => normalizeResult(tc.result) === 'Passed');
  const inProgress = testCases.filter((tc) => normalizeResult(tc.result) === 'In Progress');
  const notrun     = testCases.filter((tc) => normalizeResult(tc.result) === 'Not Run');
  const total   = testCases.length;
  const rate    = total > 0 ? Math.round(passed.length / total * 100) : 0;
  const today   = new Date().toLocaleDateString('vi-VN');

  const bullets = (buildStatus || '').split('\n').filter((l) => l.trim()).map((l) =>
    "<li style='margin-bottom:8px;color:#374151;font-size:14px'>" + l.trim() + "</li>"
  ).join('');

  const bugRows = failed.map((tc, i) => {
    const bg = i % 2 === 0 ? '#ffffff' : '#fef2f2';
    const jiraKey = tc.issue
      ? "<span style='background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:2px 8px;border-radius:4px;font-size:12px;font-family:Consolas,monospace'>" + tc.issue + "</span>"
      : "<span style='color:#94a3b8;font-size:12px'>&#8212;</span>";
    return "<tr style='background:" + bg + "'>"
      + "<td style='padding:8px 12px;border-bottom:1px solid #fecdd3;font-size:12px'>" + jiraKey + "</td>"
      + "<td style='padding:8px 12px;border-bottom:1px solid #fecdd3;font-size:12px;color:#475569;font-weight:600'>" + (tc.feature || '&#8212;') + "</td>"
      + "<td style='padding:8px 12px;border-bottom:1px solid #fecdd3;font-size:12px;color:#1e293b'>" + (tc.description || '&#8212;') + "</td>"
      + "<td style='padding:8px 12px;border-bottom:1px solid #fecdd3;font-size:12px;color:#64748b'>" + (tc.note || '&#8212;') + "</td>"
      + "</tr>";
  }).join('');

  return "<!DOCTYPE html><html><head><meta charset='utf-8'></head>"
    + "<body style='font-family:Segoe UI,Calibri,Arial,sans-serif;color:#1e293b;margin:0;padding:24px;background:#f8fafc'>"
    + "<div style='max-width:820px;margin:0 auto;background:#fff;border-radius:12px;padding:36px;box-shadow:0 2px 16px rgba(0,0,0,.08)'>"

    // Greeting
    + "<p style='margin:0 0 6px;font-size:15px;color:#1e293b'>Dear team,</p>"
    + "<p style='margin:0 0 24px;font-size:15px;color:#1e293b'>QC sum up status b&#7843;n build Beta <strong style='color:#1d4ed8'>"
    + meta.version + " (" + meta.build + ")</strong> trong h&#244;m nay</p>"

    // Build status section
    + "<div style='margin-bottom:24px'>"
    + "<p style='font-size:14px;font-weight:700;text-decoration:underline;margin:0 0 12px;color:#1e293b'><em>Build status:</em></p>"
    + "<ul style='margin:0;padding-left:22px;line-height:1.9'>"
    + (bullets || "<li style='color:#94a3b8;font-size:14px'>&#8212;</li>")
    + "</ul></div>"

    // Bug sum-up highlight
    + "<div style='margin-bottom:24px;padding:14px 20px;background:#fff7ed;border-left:4px solid #f97316;border-radius:0 8px 8px 0'>"
    + "<p style='margin:0;font-size:14px;font-weight:700;color:#c2410c'>"
    + "<u>Bug sum-up:</u> <span style='font-size:18px'>" + failed.length + " new bugs</span></p>"
    + "</div>"

    // Stats row
    + "<div style='display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px'>"
    + "<div style='padding:10px 18px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;text-align:center;min-width:70px'><div style='font-size:20px;font-weight:700;color:#15803d'>" + rate + "%</div><div style='font-size:11px;color:#15803d'>Pass Rate</div></div>"
    + "<div style='padding:10px 18px;background:#f1f5f9;border-radius:8px;border:1px solid #e2e8f0;text-align:center;min-width:70px'><div style='font-size:20px;font-weight:700;color:#1e293b'>" + total + "</div><div style='font-size:11px;color:#64748b'>Total TC</div></div>"
    + "<div style='padding:10px 18px;background:#f0fdf4;border-radius:8px;border:1px solid #86efac;text-align:center;min-width:70px'><div style='font-size:20px;font-weight:700;color:#15803d'>" + passed.length + "</div><div style='font-size:11px;color:#15803d'>Passed</div></div>"
    + "<div style='padding:10px 18px;background:#fee2e2;border-radius:8px;border:1px solid #fca5a5;text-align:center;min-width:70px'><div style='font-size:20px;font-weight:700;color:#b91c1c'>" + failed.length + "</div><div style='font-size:11px;color:#b91c1c'>Failed</div></div>"
    + "<div style='padding:10px 18px;background:#fff7ed;border-radius:8px;border:1px solid #fdba74;text-align:center;min-width:70px'><div style='font-size:20px;font-weight:700;color:#c2410c'>" + warning.length + "</div><div style='font-size:11px;color:#c2410c'>Warning</div></div>"
    + "<div style='padding:10px 18px;background:#fef3c7;border-radius:8px;border:1px solid #fcd34d;text-align:center;min-width:70px'><div style='font-size:20px;font-weight:700;color:#b45309'>" + inProgress.length + "</div><div style='font-size:11px;color:#b45309'>In Progress</div></div>"
    + "<div style='padding:10px 18px;background:#f1f5f9;border-radius:8px;border:1px solid #cbd5e1;text-align:center;min-width:70px'><div style='font-size:20px;font-weight:700;color:#64748b'>" + notrun.length + "</div><div style='font-size:11px;color:#64748b'>Not Run</div></div>"
    + "</div>"

    // Bug table
    + (failed.length > 0
        ? "<div style='margin-bottom:24px'>"
          + "<p style='font-size:14px;font-weight:700;color:#b91c1c;margin:0 0 10px'>&#128027; Chi ti&#7871;t bugs (" + failed.length + " issues):</p>"
          + "<table style='width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #fecdd3'>"
          + "<thead><tr style='background:#b91c1c'>"
          + "<th style='padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase'>Jira Key</th>"
          + "<th style='padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase'>Feature</th>"
          + "<th style='padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase'>Description</th>"
          + "<th style='padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase'>Note</th>"
          + "</tr></thead><tbody>" + bugRows + "</tbody></table>"
          + "</div>"
        : "<p style='color:#15803d;font-size:14px;margin-bottom:24px'>&#10003; Kh&#244;ng c&#243; bug n&#224;o!</p>")

    // Signature
    + "<div style='border-top:1px solid #e2e8f0;padding-top:18px'>"
    + "<p style='margin:0;font-size:14px;color:#374151'>Thanks,<br><strong>" + (meta.tester || 'QC Team') + "</strong></p>"
    + "<p style='margin:8px 0 0;font-size:11px;color:#94a3b8'>QC Suite &bull; " + today + " &bull; " + meta.project + " &bull; " + meta.version + "</p>"
    + "</div>"
    + "</div></body></html>";
}

// 2. Full TC table email
function buildFullHtml(testCases, meta) {
  const counts = { Passed: 0, Failed: 0, Warning: 0, 'In Progress': 0, 'Not Run': 0 };
  testCases.forEach((tc) => {
    const key = normalizeResult(tc.result);
    if (counts[key] !== undefined) counts[key]++;
  });
  const total = testCases.length;
  const rate = total > 0 ? Math.round(counts.Passed / total * 100) : 0;
  const th = (h) => "<th style='padding:9px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;white-space:nowrap'>" + h + "</th>";
  const thead = ['#', 'Feature', 'Test Case', 'Test To Perform', '?Test', 'Result', 'Jira', 'Note'].map(th).join('');
  const tbody = testCases.map((tc, i) => {
    const res = normalizeResult(tc.result);
    const r = RESULT_CFG[res] || RESULT_CFG['Not Run'];
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
    const jira = tc.issue
      ? "<span style='background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:2px 7px;border-radius:4px;font-size:11px;font-family:monospace'>" + tc.issue + "</span>"
      : "<span style='color:#e2e8f0'>&#8212;</span>";
    const testStatus = tc.testStatus || tc.test_status || '';
    const tsBg = testStatus === 'Yes' ? '#f0fdf4' : '#fef2f2';
    const tsColor = testStatus === 'Yes' ? '#15803d' : '#dc2626';
    return "<tr style='background:" + bg + "'>"
      + "<td style='padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#94a3b8'>" + (i+1) + "</td>"
      + "<td style='padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;font-weight:600'>" + (tc.feature||'&#8212;') + "</td>"
      + "<td style='padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#1e293b'>" + (tc.description||'&#8212;') + "</td>"
      + "<td style='padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569'>" + (tc.testToPerform||tc.test_to_perform||'&#8212;') + "</td>"
      + "<td style='padding:8px 10px;border-bottom:1px solid #f1f5f9'><span style='background:" + tsBg + ";color:" + tsColor + ";padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700'>" + (testStatus||'No') + "</span></td>"
      + "<td style='padding:8px 10px;border-bottom:1px solid #f1f5f9'><span style='background:" + r.bg + ";color:" + r.color + ";border:1px solid " + r.border + ";padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700'>" + (tc.result||'Not Run') + "</span></td>"
      + "<td style='padding:8px 10px;border-bottom:1px solid #f1f5f9'>" + jira + "</td>"
      + "<td style='padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b'>" + (tc.note||'&#8212;') + "</td>"
      + "</tr>";
  }).join('');
  const badges = Object.entries(RESULT_CFG).map(([k, v]) =>
    "<td style='padding:9px 13px;background:" + v.bg + ";border-radius:8px;border:1px solid " + v.border + ";text-align:center'><div style='font-size:17px;font-weight:700;color:" + v.color + "'>" + (counts[k]||0) + "</div><div style='font-size:10px;color:" + v.color + "'>" + k + "</div></td><td style='width:5px'></td>"
  ).join('');
  return "<!DOCTYPE html><html><head><meta charset='utf-8'></head><body style='font-family:Segoe UI,Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px'>"
    + "<div style='max-width:980px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)'>"
    + "<div style='background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:26px 32px;color:#fff'>"
    + "<div style='font-size:11px;text-transform:uppercase;letter-spacing:2px;opacity:.65;margin-bottom:4px'>Test Execution Report</div>"
    + "<div style='font-size:22px;font-weight:700;margin-bottom:14px'>" + meta.project + " &mdash; " + meta.version + " &mdash; " + meta.build + "</div>"
    + "<div style='display:flex;gap:24px;flex-wrap:wrap'><div><div style='opacity:.6;font-size:11px'>Tester</div><div style='font-weight:600'>" + (meta.tester||'QC Team') + "</div></div>"
    + "<div><div style='opacity:.6;font-size:11px'>Ng&agrave;y</div><div style='font-weight:600'>" + new Date().toLocaleDateString('vi-VN') + "</div></div></div></div>"
    + "<div style='padding:18px 28px;background:#f8fafc;border-bottom:1px solid #e2e8f0'><table style='border-collapse:separate;border-spacing:5px'><tr>"
    + "<td style='padding:10px 18px;background:#fff;border-radius:8px;border:1px solid #e2e8f0;text-align:center'><div style='font-size:20px;font-weight:700;color:#1e293b'>" + total + "</div><div style='font-size:11px;color:#64748b'>T&#7893;ng TC</div></td>"
    + "<td style='width:5px'></td>"
    + "<td style='padding:10px 18px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;text-align:center'><div style='font-size:20px;font-weight:700;color:#15803d'>" + rate + "%</div><div style='font-size:11px;color:#15803d'>Pass Rate</div></td>"
    + "<td style='width:5px'></td>" + badges + "</tr></table></div>"
    + "<div style='padding:20px 28px;overflow-x:auto'><table style='width:100%;border-collapse:collapse;min-width:800px'>"
    + "<thead><tr style='background:#f8fafc'>" + thead + "</tr></thead><tbody>" + tbody + "</tbody></table></div>"
    + "<div style='padding:12px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8'>QC Suite &bull; " + new Date().toLocaleDateString('vi-VN') + " &bull; " + (meta.tester||'QC Team') + "</div>"
    + "</div></body></html>";
}

// ─── Import Drop Zone ─────────────────────────────────────
function ImportDropZone({ onParsed }) {
  const [dragging, setDragging] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef();
  async function handle(file) {
    setErr('');
    try {
      let rows;
      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const lines = parseCSV(text);
        if (lines.length <= 1) { setErr('File rỗng'); return; }
        rows = lines.slice(1).map((r) => ({
          feature: r[0]||'', description: r[1]||'', testToPerform: r[2]||'',
          testStatus: (r[3]||'').toLowerCase().includes('yes') ? 'Yes' : 'No',
          result: normalizeResult(r[4] || 'Not Run'),
          issue: r[5]||'', note: r[6]||'',
        }));
      } else {
        rows = await parseFileToRows(file);
      }
      if (!rows.length) { setErr('File trống.'); return; }
      onParsed(rows);
    } catch (e) { setErr('Lỗi: ' + e.message); }
  }
  return (
    <div>
      <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) { handle(f); e.dataTransfer.items.clear(); } }}
        onClick={() => ref.current.click()}
        style={{ border: '2px dashed ' + (dragging ? '#3b82f6' : '#cbd5e1'), borderRadius: 10, padding: '22px', textAlign: 'center', cursor: 'pointer', background: dragging ? '#eff6ff' : '#f8fafc' }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Kéo thả file Excel/CSV vào đây</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>hoặc click để chọn (.xlsx, .xls, .csv)</div>
        <input ref={ref} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) { handle(e.target.files[0]); ref.current.value = ''; } }} />
      </div>
      {err && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '6px 10px', borderRadius: 6, fontSize: 12, marginTop: 6 }}>{err}</div>}
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
        Cột: <strong>Feature | Test Case Description | Test To Perform | ?Test | Result | Issue (Jira) | Note</strong>
      </div>
    </div>
  );
}

// ─── Report Modal (THEO MẪU EMAIL) ───────────────────────
function ReportModal({ testCases, meta, onClose }) {
  const [tester, setTester] = useState('');
  const [buildStatus, setBuildStatus] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState('sumup');

  const failed = testCases.filter((tc) => normalizeResult(tc.result) === 'Failed');
  const passed = testCases.filter((tc) => normalizeResult(tc.result) === 'Passed');
  const m = { ...meta, tester: tester || 'QC Team' };

  async function genAIStatus() {
    setAiLoading(true);
    try {
      const bugList = failed.map((tc) => '- [' + (tc.issue || 'no-key') + '] ' + (tc.feature || '') + ': ' + (tc.description || '')).join('\n');
      const prompt = 'Bạn là QC engineer. Viết 3-4 bullet points tóm tắt tình trạng build bằng tiếng Việt.\n'
        + 'Build: ' + meta.version + ' - ' + meta.build + ' | Project: ' + meta.project + '\n'
        + 'Total TC: ' + testCases.length + ' | Passed: ' + passed.length + ' | Failed: ' + failed.length + '\n'
        + 'Bugs:\n' + (bugList || 'Không có') + '\n\n'
        + 'Yêu cầu: Mỗi bullet point 1 dòng. Không dùng dấu gạch đầu dòng. Ngắn gọn, chuyên nghiệp.';
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json();
      setBuildStatus((data.content && data.content[0] && data.content[0].text || '').trim());
    } catch (e) { setBuildStatus('Lỗi AI: ' + e.message); }
    finally { setAiLoading(false); }
  }

  const sumUpHtml = buildSumUpHtml(testCases, m, buildStatus);
  const fullHtml  = buildFullHtml(testCases, m);
  const activeHtml = tab === 'sumup' ? sumUpHtml : fullHtml;

  async function doCopy() {
    try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([activeHtml], { type: 'text/html' }) })]); }
    catch { navigator.clipboard.writeText(activeHtml); }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }
  function doDownload() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([activeHtml], { type: 'text/html' }));
    a.download = 'qc-report-' + meta.build + '.html'; a.click();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.25)' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', padding: '18px 24px', color: '#fff', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>📊 Xuất Report Email</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{meta.project} — {meta.version} — {meta.build}</div>
        </div>

        <div style={{ overflowY: 'auto', padding: 24, flex: 1 }}>

          {/* Tên tester + tab chọn loại */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4, fontWeight: 600 }}>Tên Tester / Người gửi</label>
              <input value={tester} onChange={(e) => setTester(e.target.value)} placeholder="Chi. La Hong"
                className="w-full border border-gray-300 rounded-lg px-3 py-2" style={{ fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4, fontWeight: 600 }}>Loại email</label>
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', height: 40 }}>
                {[['sumup', '📋 Sum-up (mẫu)'], ['full', '📄 Full TC']].map(([id, label]) => (
                  <button key={id} onClick={() => setTab(id)}
                    style={{ flex: 1, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: tab === id ? '#2563eb' : '#f8fafc', color: tab === id ? '#fff' : '#64748b' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Build status - chỉ hiện ở tab sum-up */}
          {tab === 'sumup' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Build Status bullets (mỗi dòng = 1 bullet)</label>
                <button onClick={genAIStatus} disabled={aiLoading}
                  style={{ padding: '5px 14px', borderRadius: 8, border: 'none', background: aiLoading ? '#c4b5fd' : '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 700, cursor: aiLoading ? 'wait' : 'pointer' }}>
                  {aiLoading ? '⏳ Đang gen...' : '✨ AI viết'}
                </button>
              </div>
              <textarea value={buildStatus} onChange={(e) => setBuildStatus(e.target.value)} rows={4}
                placeholder={'Mỗi dòng sẽ thành 1 bullet. Ví dụ:\nBản build tập trung test cơ chế các tính năng mới\nPhát sinh bug ở hầu hết các tính năng mới\nTính năng artifact chưa được apply vào game'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                style={{ fontSize: 13, resize: 'vertical' }} />
            </div>
          )}

          {/* Bug summary */}
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 13 }}>
            <strong style={{ color: '#b91c1c' }}>Bug sum-up:</strong>
            <span style={{ color: '#374151', marginLeft: 8 }}>{failed.length} bugs từ TC Failed</span>
            {failed.filter((t) => t.issue).length > 0 && (
              <span style={{ color: '#1d4ed8', marginLeft: 6 }}>({failed.filter((t) => t.issue).length} có Jira key)</span>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <button onClick={doCopy}
              style={{ padding: 12, borderRadius: 10, border: '2px solid #2563eb', background: copied ? '#1e3a5f' : '#eff6ff', color: copied ? '#fff' : '#2563eb', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {copied ? '✓ Đã copy!' : '📋 Copy Email (Outlook)'}
            </button>
            <button onClick={() => exportToExcel(testCases, m)}
              style={{ padding: 12, borderRadius: 10, border: '2px solid #16a34a', background: '#f0fdf4', color: '#16a34a', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              📊 Excel (.xlsx)
            </button>
          </div>
          <button onClick={doDownload}
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>
            ⬇ Download HTML file
          </button>

          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e' }}>
            💡 Copy Email → mở Outlook → New Email → <strong>Ctrl+V</strong> vào body → Gửi
          </div>
        </div>

        <div style={{ padding: '12px 24px', borderTop: '1px solid #e2e8f0', textAlign: 'right', flexShrink: 0 }}>
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Đóng</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────
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
  const [showJiraModal, setShowJiraModal] = useState(false);
  const [jiraBug, setJiraBug] = useState({ summary: '', description: '', priority: 'Medium', type: 'Bug' });
  const [showAISection, setShowAISection] = useState(false);
  const [aiPrompt, setAiPrompt] = useState(() => {
    try { return localStorage.getItem(LS_AI_PROMPT) || ''; }
    catch { return ''; }
  });
  const [fileContent, setFileContent] = useState('');
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const [aiGeminiKey, setAiGeminiKey] = useState(() => {
    try { return localStorage.getItem(LS_GEMINI_API_KEY) || ''; }
    catch { return ''; }
  });
  const [showAiGeminiKey, setShowAiGeminiKey] = useState(false);
  const [aiFileName, setAiFileName] = useState('');
  const [aiProvider, setAiProvider] = useState('');
  const aiInputRef = useRef();

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

  useEffect(() => {
    try {
      if (aiGeminiKey.trim()) localStorage.setItem(LS_GEMINI_API_KEY, aiGeminiKey.trim());
      else localStorage.removeItem(LS_GEMINI_API_KEY);
    } catch {
      // Ignore localStorage failures and keep in-memory state.
    }
  }, [aiGeminiKey]);

  useEffect(() => {
    try {
      if (aiPrompt.trim()) localStorage.setItem(LS_AI_PROMPT, aiPrompt);
      else localStorage.removeItem(LS_AI_PROMPT);
    } catch {
      // Ignore localStorage failures and keep in-memory state.
    }
  }, [aiPrompt]);

  const handleUpdateResult = async (tc, newResult) => {
    const resultNormalized = normalizeResult(newResult);
    try { await updateTestCase(tc.id, { result: resultNormalized }); fetchAll(); }
    catch (e) { alert('Update result lỗi'); }
  };

  const handleUpdateTestStatus = async (tc, newStatus) => {
    try {
      const updateData = { test_status: newStatus, testStatus: newStatus };
      if (newStatus === 'No') { updateData.result = 'Not Run'; }
      await updateTestCase(tc.id, updateData); fetchAll();
    } catch (e) { alert('Update lỗi'); }
  };

  function saveEdit() {
    if (!editCell) return;
    updateTestCase(editCell.id, { [editCell.field]: editVal }).then(fetchAll);
    setEditCell(null);
  }

  function handleImport(rows) {
    setImportLoading(true);
    importTestCases(buildId, rows)
      .then(() => { fetchAll(); setShowImport(false); alert('✅ Import thành công!'); })
      .catch((e) => alert('Import lỗi: ' + e.message))
      .finally(() => setImportLoading(false));
  }

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

  const handleDeleteAll = async () => {
    if (!testCases.length) { alert('Không có test case để xoá'); return; }
    if (!window.confirm('Xoá toàn bộ ' + testCases.length + ' test case?')) return;
    try {
      setLoading(true);
      await Promise.all(testCases.map((tc) => deleteTestCase(tc.id)));
      fetchAll(); alert('✅ Đã xoá toàn bộ');
    } catch { alert('❌ Lỗi khi xoá'); } finally { setLoading(false); }
  };

  const handleOpenJira = () => {
    setShowJiraModal(true);
  };

  // Parse PDF từ CDN
  async function loadPDFLib() {
    if (window.pdfjsLib) return window.pdfjsLib;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        if (window.pdfjsWorker) {
          window.pdfjsWorker.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        resolve(window.pdfjsLib || window.pdfjs);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function parsePDF(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await loadPDFLib();
      if (!pdfjsLib.getDocument) throw new Error('PDF library không load được');
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        text += textContent.items.map(item => item.str).join(' ') + '\n';
      }
      return text;
    } catch (e) {
      throw new Error('Lỗi parse PDF: ' + e.message);
    }
  }

  async function parseDOCX(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      if (!window.mammoth) {
        throw new Error('Mammoth library chưa load');
      }
      const result = await window.mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (e) {
      throw new Error('Lỗi parse DOCX: ' + e.message);
    }
  }

  async function handleAIFileUpload(file) {
    try {
      setAiGenLoading(true);
      const fileNameLower = (file.name || '').toLowerCase();
      // Kiểm tra file size (max 20MB)
      if (file.size > 20 * 1024 * 1024) {
        alert('❌ File quá lớn! Max 20MB. Hiện tại: ' + (file.size / 1024 / 1024).toFixed(1) + 'MB');
        return;
      }
      let content = '';
      if (fileNameLower.endsWith('.pdf')) {
        content = await parsePDF(file);
      } else if (fileNameLower.endsWith('.docx')) {
        if (!window.mammoth) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js';
            script.onload = () => {
              if (window.mammoth) resolve();
              else reject(new Error('Mammoth load xong nhưng không tìm thấy window.mammoth'));
            };
            script.onerror = () => reject(new Error('Không tải được thư viện Mammoth từ CDN. Kiểm tra kết nối mạng.'));
            document.head.appendChild(script);
          });
        }
        content = await parseDOCX(file);
      } else if (fileNameLower.endsWith('.doc')) {
        alert('⚠️ File .doc (Office cũ) không được hỗ trợ.\nVui lòng lưu lại dưới dạng .docx rồi thử lại.');
        return;
      } else {
        alert('⚠️ Chỉ hỗ trợ file PDF (.pdf) hoặc Word (.docx)');
        return;
      }
      setFileContent(content.substring(0, 3000));
      setAiFileName(file.name);
      alert('✅ File "' + file.name + '" đã load! Auto-generate ngay nếu prompt đã nhập.');
      // Auto-generate nếu prompt đã có
      if (aiPrompt.trim()) {
        const capturedContent = content.substring(0, 3000);
        setTimeout(() => generateTestCases(capturedContent), 300);
      }
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)) || 'Lỗi không xác định';
      alert('❌ ' + msg);
    } finally {
      setAiGenLoading(false);
    }
  }

  async function generateTestCases(contentOverride) {
    const sourceContent = (typeof contentOverride === 'string' ? contentOverride : fileContent).trim();
    const promptText = aiPrompt.trim();

    if (!sourceContent) { alert('Vui lòng import file trước!'); return; }
    if (!promptText) { alert('Vui lòng nhập yêu cầu/prompt!'); return; }
    if (!aiGeminiKey.trim()) { alert('Vui lòng nhập Gemini API key!'); return; }

    setAiGenLoading(true);
    try {
      // Prompt rõ ràng, tách system khỏi content tài liệu
      const systemInstruction = `Bạn là QA engineer chuyên nghiệp. Nhiệm vụ: phân tích tài liệu và tạo test cases chi tiết.
    QUAN TRỌNG: Chỉ trả về JSON array thuần túy, KHÔNG có markdown, KHÔNG có text giải thích.
    Giới hạn tối đa 10 test cases, ưu tiên những case quan trọng nhất. Nội dung ngắn gọn, không lan man.
Format mỗi test case:
{
  "feature": "Tên feature/module (ngắn gọn)",
  "description": "Mô tả cụ thể những gì cần test (1-2 câu)",
  "testToPerform": "Bước 1: ... | Bước 2: ... | Bước 3: ... (các bước thực hiện cụ thể)",
  "testStatus": "Yes",
  "result": "Not Run",
  "note": ""
}`;

      const userMessage = `Tài liệu cần phân tích:
---
    ${sourceContent}
---

    Yêu cầu từ người dùng: ${promptText}

Hãy tạo test cases chi tiết cho tài liệu trên. Trả về JSON array.`;

      const fullPrompt = systemInstruction + '\n\n' + userMessage;

      const res = await fetch('/api/ai/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, apiKey: aiGeminiKey, max_output_tokens: 4000 }),
        signal: AbortSignal.timeout(60000),
      });

      const rawText = await res.text();
      let data;
      try { data = rawText ? JSON.parse(rawText) : null; }
      catch { throw new Error('Server trả về response không hợp lệ: ' + rawText.slice(0, 300)); }

      if (!res.ok) {
        const msg = typeof data?.error === 'string' ? data.error : (data?.error?.message || JSON.stringify(data?.error) || 'Lỗi không xác định');
        throw new Error('Gemini lỗi: ' + msg);
      }

      // Server có thể trả về nhiều format: output string, output.text hoặc candidates[0].output
      const rawOutput = typeof data?.output === 'string'
        ? data.output
        : (data?.output?.text || data?.candidates?.[0]?.output || data?.candidates?.[0]?.content?.parts?.[0]?.text || '');
      const text = String(rawOutput || '').trim();
      if (!text) throw new Error('Gemini không trả về nội dung. Thử lại hoặc kiểm tra API key.');

      const parsed = extractJSONArrayFromText(text);
      if (!parsed || !Array.isArray(parsed)) {
        throw new Error('Không parse được JSON. Response: ' + text.slice(0, 300));
      }

      // Normalize các field
      const normalized = parsed.map((tc) => ({
        feature:       tc.feature || tc.Feature || tc.module || '',
        description:   tc.description || tc.Description || tc.title || tc.name || '',
        testToPerform: tc.testToPerform || tc.steps || tc.action_steps || tc.test_to_perform || tc['Test Steps'] || '',
        testStatus:    'Yes',
        result:        'Not Run',
        note:          tc.note || tc.notes || tc.expected || tc.expected_result || '',
      })).filter((tc) => tc.description.trim());

      if (!normalized.length) throw new Error('Không có test case hợp lệ nào được tạo ra.');

      handleImport(normalized);
      setFileContent('');
      setAiFileName('');
      setAiProvider('Gemini');
      alert('✅ Generate thành công!\n' + normalized.length + ' test cases đã import.');
      setTimeout(() => setAiProvider(''), 3000);
    } catch (e) {
      const errMsg = (e instanceof Error ? e.message : String(e)) || 'Lỗi không xác định';
      console.error('Gemini failed:', errMsg);
      alert('❌ Gemini API lỗi:\n' + errMsg + '\n\nKiểm tra lại:\n• API key có đúng không?\n• Quota còn không?\n• Kết nối mạng ổn không?');
    } finally {
      setAiGenLoading(false);
    }
  }

  const handleSubmitJira = () => {
    const url = new URL('https://jira-mps.mto.zing.vn/secure/CreateIssue!default.jspa');
    url.searchParams.append('summary', jiraBug.summary);
    url.searchParams.append('description', jiraBug.description);
    url.searchParams.append('priority', jiraBug.priority);
    url.searchParams.append('type', jiraBug.type);
    window.open(url.toString(), '_blank');
    setShowJiraModal(false);
    setJiraBug({ summary: '', description: '', priority: 'Medium', type: 'Bug' });
  };

  const stats = {
    total: testCases.length,
    passed:     testCases.filter((t) => normalizeResult(t.result) === 'Passed').length,
    failed:     testCases.filter((t) => normalizeResult(t.result) === 'Failed').length,
    warning:    testCases.filter((t) => normalizeResult(t.result) === 'Warning').length,
    inProgress: testCases.filter((t) => normalizeResult(t.result) === 'In Progress').length,
    notRun:     testCases.filter((t) => normalizeResult(t.result) === 'Not Run').length,
  };
  const passRate = stats.total > 0 ? Math.round(stats.passed / stats.total * 100) : 0;

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;
  if (error)   return <div className="p-6"><div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div></div>;

  const displayProjectName = capitalizeDisplayName(projectName);
  const displayVersionName = capitalizeDisplayName(versionName);
  const displayBuildName = capitalizeDisplayName(buildName);
  const meta = { project: displayProjectName, version: displayVersionName, build: displayBuildName };

  const COLS = [
    { key: 'feature',     label: 'Feature (A)',               w: 120 },
    { key: 'description', label: 'Test Case Description (B)', w: 200 },
    { key: 'testToPerform', label: 'Test to Perform (C)',     w: 220 },
    { key: 'test_status', label: '?Test (D)', type: 'status', w: 100 },
    { key: 'result',      label: 'Result (E)', type: 'result', w: 120 },
    { key: 'issue',       label: 'Issue (F)',  type: 'issue',  w: 110 },
    { key: 'note',        label: 'Note (G)',                   w: 160 },
  ];

  return (
    <div className="p-6">
      <nav className="text-sm text-gray-500 mb-4">
        <Link to="/projects" className="hover:text-blue-600">Home</Link>
        <span className="mx-2">/</span>
        <Link to={'/projects/' + projectId} className="hover:text-blue-600">{displayProjectName}</Link>
        <span className="mx-2">/</span>
        <Link to={'/projects/' + projectId + '/versions/' + versionId} className="hover:text-blue-600">{displayVersionName}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">{displayBuildName}</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-4">{displayBuildName}</h1>

      {/* Stats */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { l: 'Passed',      v: stats.passed,     c: 'bg-green-100 text-green-700 border border-green-300' },
          { l: 'Failed',      v: stats.failed,     c: 'bg-red-100 text-red-700 border border-red-300' },
          { l: 'Warning',     v: stats.warning,    c: 'bg-orange-100 text-orange-700 border border-orange-300' },
          { l: 'In Progress', v: stats.inProgress, c: 'bg-yellow-100 text-yellow-700 border border-yellow-300' },
          { l: 'Not Run',     v: stats.notRun,     c: 'bg-slate-100 text-slate-700 border border-slate-300' },
        ].map((s) => <span key={s.l} className={'px-3 py-1 rounded-full text-sm font-semibold ' + s.c}>{s.l}: {s.v}</span>)}
      </div>

      {/* Action buttons - Tab style */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button 
          onClick={() => { setShowImport(v => !v); setShowAISection(false); }} 
          className={"px-4 py-2 rounded-lg font-medium text-sm " + (showImport ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-purple-100 hover:bg-purple-200 text-purple-700")}>
          📂 Import Excel/CSV
        </button>
        <button 
          onClick={() => { setShowAISection(true); setShowImport(false); }} 
          className={"px-4 py-2 rounded-lg font-medium text-sm " + (showAISection ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-emerald-100 hover:bg-emerald-200 text-emerald-700")}>
          🤖 AI Generate (PDF/DOCX)
        </button>
        <button onClick={handleOpenJira} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium text-sm">Send to Jira</button>
        <button onClick={() => setShowReport(true)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium text-sm">📊 Report</button>
        <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm">+ Add Test Case</button>
        <button onClick={() => exportToExcel(testCases, meta)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium text-sm">📊 Export Excel</button>
        <button onClick={() => exportCSV(testCases)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium text-sm">📁 Export CSV</button>
        <button onClick={handleDeleteAll} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium text-sm">🗑 Delete All</button>
      </div>

      {/* Import zone */}
      {showImport && (
        <div className="mb-4 bg-white rounded-xl shadow p-4">
          <ImportDropZone onParsed={handleImport} />
          {importLoading && <p className="text-blue-600 text-sm mt-2">Đang import...</p>}
        </div>
      )}

      {/* AI Generate zone (inline) */}
      {showAISection && (
        <div className="mb-4 bg-white rounded-xl shadow p-4">
          <h3 className="font-bold text-base mb-3" style={{ color: '#6366f1' }}>🤖 AI Generate Test Cases (Gemini)</h3>

          {/* Provider Status */}
          {aiProvider && (
            <div style={{ background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#1e40af', fontWeight: 600 }}>
              Đang dùng: {aiProvider}
            </div>
          )}

          {/* API Keys Section */}
          <div style={{ background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#0284c7', fontWeight: 600, marginBottom: 8 }}>📌 Gemini API Key (bắt buộc, 1 key duy nhất)</div>

            <div className="mb-2">
              <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 4 }}>Gemini API Key</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type={showAiGeminiKey ? 'text' : 'password'}
                  value={aiGeminiKey}
                  onChange={(e) => setAiGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  className="w-full border border-green-300 rounded px-2 py-1 text-xs bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowAiGeminiKey((v) => !v)}
                  style={{
                    padding: '0 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#475569',
                    fontSize: 11,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}>
                  {showAiGeminiKey ? 'Ẩn' : 'Hiện'}
                </button>
                <button
                  type="button"
                  onClick={() => setAiGeminiKey('')}
                  disabled={!aiGeminiKey}
                  style={{
                    padding: '0 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: aiGeminiKey ? '#fff' : '#f8fafc',
                    color: aiGeminiKey ? '#475569' : '#94a3b8',
                    fontSize: 11,
                    cursor: aiGeminiKey ? 'pointer' : 'not-allowed',
                  }}>
                  Xóa
                </button>
              </div>
            </div>

            <div style={{ fontSize: 10, color: '#64748b', marginTop: 8 }}>
              Key sẽ được lưu cục bộ trên trình duyệt này, không cần nhập lại mỗi lần.<br />
              📌 Lấy key tại: <a href="https://ai.google.dev/" target="_blank" rel="noreferrer" style={{ color: '#16a34a', fontWeight: 'bold' }}>Gemini (Free)</a>
            </div>
          </div>

          {/* File Upload */}
          <div className="mb-3">
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Upload File (PDF/DOCX max 20MB) *</label>
            <div
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.background = '#e0e7ff'; }}
              onDragLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.style.background = '#f8fafc'; if (e.dataTransfer.files[0]) handleAIFileUpload(e.dataTransfer.files[0]); }}
              onClick={() => aiInputRef.current?.click()}
              style={{ border: '2px dashed #cbd5e1', borderRadius: 10, padding: '12px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc', transition: 'all 0.2s' }}
            >
              <div style={{ fontSize: 18, marginBottom: 4 }}>📄</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Kéo file hoặc click để chọn</div>
              {aiFileName && <div style={{ fontSize: 11, color: '#15803d', marginTop: 6 }}>✅ {aiFileName}</div>}
              <input ref={aiInputRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) handleAIFileUpload(e.target.files[0]); e.target.value = ''; }} />
            </div>
          </div>

          {/* Prompt Input */}
          <div className="mb-3">
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Prompt *</label>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="VD: Tạo test cases cho tính năng login với email, password. Include: valid, empty fields, invalid format..."
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              style={{ fontSize: 12, resize: 'vertical' }}
            />
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>
              Prompt được lưu cục bộ trên trình duyệt này, vào lại tab vẫn giữ nguyên.
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex gap-2">
            <button
              onClick={generateTestCases}
              disabled={aiGenLoading || !fileContent || !aiPrompt.trim()}
              style={{
                background: aiGenLoading || !fileContent || !aiPrompt.trim() ? '#cbd5e1' : '#6366f1',
                color: '#fff',
                cursor: aiGenLoading || !fileContent || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
                padding: '8px 16px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                border: 'none'
              }}
            >
              {aiGenLoading ? '⏳ Đang generate...' : '🚀 Generate Test Cases'}
            </button>
            {fileContent && (
              <button
                onClick={() => { setFileContent(''); setAiFileName(''); }}
                style={{ padding: '8px 12px', borderRadius: 6, fontSize: 12, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: '#1a1f36' }}>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase w-10">#</th>
                {COLS.map((c) => <th key={c.key} className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider" style={{ minWidth: c.w }}>{c.label}</th>)}
                <th className="px-3 py-3 text-xs font-semibold text-white uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {testCases.length === 0 ? (
                <tr><td colSpan={COLS.length + 2} className="px-6 py-16 text-center text-gray-400">
                  Chưa có test case. Bấm Import hoặc Add Test Case.
                </td></tr>
              ) : testCases.map((tc, idx) => (
                <tr key={tc.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
                  {COLS.map((col) => {
                    const isEditing = editCell?.id === tc.id && editCell?.field === col.key;
                    const tcStatus = tc.testStatus || tc.test_status || 'No';

                    if (col.type === 'result') {
                      const res = normalizeResult(tc.result || 'Not Run');
                      const locked = tcStatus === 'No';
                      return (
                        <td key={col.key} className="px-3 py-2">
                          <select value={res}
                            onChange={(e) => handleUpdateResult(tc, e.target.value)}
                            disabled={locked}
                            className={"border rounded px-2 py-1 text-sm font-medium " + getResultColor(res)}
                            style={{
                              opacity: locked ? 0.5 : 1,
                              cursor: locked ? 'not-allowed' : 'pointer',
                            }}>
                            {RESULTS.map((resultOption) => (
                              <option
                                key={resultOption}
                                value={resultOption}
                                style={{
                                  backgroundColor: RESULT_CFG[resultOption].bg,
                                  color: RESULT_CFG[resultOption].color,
                                  fontWeight: 700,
                                }}
                              >
                                {resultOption}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    }

                    if (col.type === 'status') return (
                      <td key={col.key} className="px-3 py-2">
                        <select value={tcStatus}
                          onChange={(e) => handleUpdateTestStatus(tc, e.target.value)}
                          className={'border rounded px-2 py-1 text-sm font-medium ' + getTestStatusColor(tcStatus)}>
                          {TEST_STATUS_OPTIONS.map((statusOption) => (
                            <option
                              key={statusOption}
                              value={statusOption}
                              style={{
                                backgroundColor: TEST_STATUS_CFG[statusOption].bg,
                                color: TEST_STATUS_CFG[statusOption].color,
                                fontWeight: 700,
                              }}
                            >
                              {statusOption}
                            </option>
                          ))}
                        </select>
                      </td>
                    );

                    if (col.type === 'issue') return (
                      <td key={col.key} className="px-3 py-2">
                        {isEditing ? (
                          <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)}
                            onBlur={saveEdit} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditCell(null); }}
                            className="w-full border border-blue-400 rounded px-2 py-1 text-xs outline-none" />
                        ) : tc.issue ? (
                          <span onClick={() => { setEditCell({ id: tc.id, field: 'issue' }); setEditVal(tc.issue); }}
                            style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace', fontSize: 11, cursor: 'text' }}>
                            {tc.issue}
                          </span>
                        ) : (
                          <span onClick={() => { setEditCell({ id: tc.id, field: 'issue' }); setEditVal(''); }}
                            className="text-blue-500 underline text-xs cursor-pointer">
                            + Add key
                          </span>
                        )}
                      </td>
                    );

                    const fieldKey = col.key === 'testToPerform' ? (tc.testToPerform !== undefined ? 'testToPerform' : 'test_to_perform') : col.key;
                    const cellVal = tc[col.key] || tc[fieldKey] || '';
                    return (
                      <td key={col.key} className="px-3 py-1">
                        {isEditing ? (
                          <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)}
                            onBlur={saveEdit} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditCell(null); }}
                            className="w-full border border-blue-400 rounded px-2 py-1 text-xs outline-none" style={{ minWidth: col.w - 20 }} />
                        ) : (
                          <div onClick={() => { setEditCell({ id: tc.id, field: col.key }); setEditVal(cellVal); }}
                            className="cell-editable px-2 py-1 rounded text-xs min-h-[24px] cursor-text" title="Click để sửa">
                            {cellVal || <span className="text-gray-300">—</span>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 whitespace-nowrap flex gap-1">
                    {normalizeResult(tc.result) === 'Failed' && (
                      <button onClick={() => window.open('https://jira-mps.mto.zing.vn/secure/CreateIssue!default.jspa', '_blank')}
                        className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-600 border border-orange-300 hover:bg-orange-200 font-medium">🐛 Jira</button>
                    )}
                    <button onClick={() => handleDelete(tc.id)}
                      className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add TC Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Test Case" onConfirm={handleAddTC} confirmText="Add">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Feature</label>
            <input value={newTC.feature} onChange={(e) => setNewTC((p) => ({ ...p, feature: e.target.value }))} placeholder="e.g. Login" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Case Description *</label>
            <textarea value={newTC.description} onChange={(e) => setNewTC((p) => ({ ...p, description: e.target.value }))} placeholder="Mô tả test case" rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test to Perform</label>
            <textarea value={newTC.testToPerform} onChange={(e) => setNewTC((p) => ({ ...p, testToPerform: e.target.value }))} placeholder="Các bước thực hiện" rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </Modal>

      {showReport && <ReportModal testCases={testCases} meta={meta} onClose={() => setShowReport(false)} />}

      {/* Jira Modal */}
      {showJiraModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 500, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.25)' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg,#0052cc,#003da5)', padding: '18px 24px', color: '#fff', flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>🐛 Tạo Bug Jira</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{meta.project} — {meta.version}</div>
            </div>

            <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
              <div className="space-y-4">
                {/* Summary */}
                <div>
                  <label style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 6, fontWeight: 600 }}>Summary *</label>
                  <input value={jiraBug.summary} onChange={(e) => setJiraBug((p) => ({ ...p, summary: e.target.value }))} placeholder="Tiêu đề bug" 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" style={{ fontSize: 13 }} />
                </div>

                {/* Description */}
                <div>
                  <label style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 6, fontWeight: 600 }}>Description</label>
                  <textarea value={jiraBug.description} onChange={(e) => setJiraBug((p) => ({ ...p, description: e.target.value }))} placeholder="Mô tả chi tiết lỗi..."
                    rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2" style={{ fontSize: 13, resize: 'vertical' }} />
                </div>

                {/* Priority */}
                <div>
                  <label style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 6, fontWeight: 600 }}>Priority</label>
                  <select value={jiraBug.priority} onChange={(e) => setJiraBug((p) => ({ ...p, priority: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" style={{ fontSize: 13 }}>
                    <option value="Lowest">Lowest</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Highest">Highest</option>
                  </select>
                </div>

                {/* Type */}
                <div>
                  <label style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 6, fontWeight: 600 }}>Type</label>
                  <select value={jiraBug.type} onChange={(e) => setJiraBug((p) => ({ ...p, type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" style={{ fontSize: 13 }}>
                    <option value="Bug">Bug</option>
                    <option value="Task">Task</option>
                    <option value="Story">Story</option>
                    <option value="Epic">Epic</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => { setShowJiraModal(false); setJiraBug({ summary: '', description: '', priority: 'Medium', type: 'Bug' }); }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Hủy</button>
              <button onClick={handleSubmitJira} disabled={!jiraBug.summary.trim()} style={{ background: !jiraBug.summary.trim() ? '#cbd5e1' : '#0052cc', color: '#fff', cursor: !jiraBug.summary.trim() ? 'not-allowed' : 'pointer' }} className="px-4 py-2 rounded-lg text-sm font-medium">Tạo Bug</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
