import axios from 'axios';

const isLocal = window.location.hostname === 'localhost';

const api = axios.create({
  baseURL: isLocal ? 'http://localhost:3001' : '',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('qc_auth_session');
    const session = raw ? JSON.parse(raw) : null;
    const username = String(session?.username || '').trim();
    const isGuest = Boolean(session?.isGuest);
    const guestId = String(session?.guestId || '').trim();

    config.headers = config.headers || {};
    if (username) config.headers['x-qc-username'] = username;
    config.headers['x-qc-is-guest'] = isGuest ? 'true' : 'false';
    if (guestId) config.headers['x-qc-guest-id'] = guestId;
  } catch {
    // no-op: continue request without auth scope headers
  }
  return config;
});

const DATA_CHANGED_EVENT = 'qc:data-changed';

const notifyDataChanged = () => {
  const timestamp = String(Date.now());
  localStorage.setItem('qc:last-data-change', timestamp);
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
};

// ─── TEST CASE ─────────────────────────
export const getTestCases = async (buildId) => {
  const res = await api.get('/api/testcases', { params: { buildId } });
  return res.data;
};

export const createTestCase = async (buildId, data) => {
  const res = await api.post('/api/testcases', { buildId, ...data });
  notifyDataChanged();
  return res.data;
};

export const updateTestCase = async (id, data) => {
  const res = await api.put(`/api/testcases/${id}`, data);
  notifyDataChanged();
  return res.data;
};

export const deleteTestCase = async (id) => {
  await api.delete(`/api/testcases/${id}`);
  notifyDataChanged();
};

export const importTestCases = async (buildId, rows) => {
  const testCases = (Array.isArray(rows) ? rows : []).map((r) => {
    if (Array.isArray(r)) {
      return {
        feature: r[0] || '',
        description: r[1] || r[2] || '',
        testToPerform: r[3] || '',
        testStatus: r[4] || 'Yes',
        result: r[5] || 'Not Run',
        issue: r[6] || '',
        note: r[7] || '',
      };
    }

    return {
      feature: r.feature || '',
      description: r.description || '',
      testToPerform: r.testToPerform || r.test_to_perform || '',
      testStatus: r.testStatus || r.test_status || 'Yes',
      result: r.result || 'Not Run',
      issue: r.issue || '',
      note: r.note || '',
    };
  });

  const res = await api.post('/api/testcases/import', { buildId, testCases });
  notifyDataChanged();
  return res.data;
};

// ─── BUGS ─────────────────────────
export const getBugs = async (filters = {}) => {
  const res = await api.get('/api/bugs', { params: filters });
  return res.data;
};

export const createBug = async (data) => {
  const res = await api.post('/api/bugs', data);
  notifyDataChanged();
  return res.data;
};

export const updateBug = async (id, data) => {
  const res = await api.put(`/api/bugs/${id}`, data);
  notifyDataChanged();
  return res.data;
};

export const deleteBug = async (id) => {
  await api.delete(`/api/bugs/${id}`);
  notifyDataChanged();
};

export const bulkUpdateBugStatus = async (ids, status, resolution_note) => {
  const res = await api.post('/api/bugs/bulk-status', { ids, status, resolution_note });
  notifyDataChanged();
  return res.data;
};

// ─── PROJECT ─────────────────────────
export const getProjects = async () => {
  const res = await api.get('/api/projects');
  return res.data;
};

export const createProject = async (data) => {
  const res = await api.post('/api/projects', { name: data.name });
  notifyDataChanged();
  return res.data;
};

export const updateProject = async (id, data) => {
  const res = await api.put(`/api/projects/${id}`, data);
  notifyDataChanged();
  return res.data;
};

export const deleteProject = async (id) => {
  await api.delete(`/api/projects/${id}`);
  notifyDataChanged();
};

// ─── VERSION ─────────────────────────
export const getVersions = async (projectId) => {
  const res = await api.get('/api/versions', { params: { projectId } });
  return (Array.isArray(res.data) ? res.data : []).map((v) => ({
    ...v,
    buildCount: v.build_count ?? 0,
    createdAt: v.created_at,
  }));
};

export const createVersion = async (projectId, data) => {
  const res = await api.post('/api/versions', { projectId, name: data.name });
  notifyDataChanged();
  return res.data;
};

export const updateVersion = async (id, data) => {
  const res = await api.put(`/api/versions/${id}`, data);
  notifyDataChanged();
  return res.data;
};

export const deleteVersion = async (id) => {
  await api.delete(`/api/versions/${id}`);
  notifyDataChanged();
};

// ─── BUILD ─────────────────────────
export const getBuilds = async (versionId) => {
  const res = await api.get('/api/builds', { params: { versionId } });
  return (Array.isArray(res.data) ? res.data : []).map((b) => ({
    ...b,
    totalCases: b.total ?? 0,
    passedCases: b.passed ?? 0,
    failedCases: b.failed ?? 0,
    warningCases: b.warning ?? 0,
    inProgressCases: b.in_progress ?? 0,
    notRunCases: b.not_run ?? 0,
    createdAt: b.created_at,
  }));
};

export const createBuild = async (versionId, data) => {
  const res = await api.post('/api/builds', { versionId, name: data.name });
  notifyDataChanged();
  return res.data;
};

export const updateBuild = async (id, data) => {
  const res = await api.put(`/api/builds/${id}`, data);
  notifyDataChanged();
  return res.data;
};

export const deleteBuild = async (id) => {
  await api.delete(`/api/builds/${id}`);
  notifyDataChanged();
};

export const copyBuild = async (id) => {
  const res = await api.post(`/api/builds/${id}/copy`, { name: '' });
  notifyDataChanged();
  return res.data;
};

// ─── JIRA CONFIG ─────────────────────────
const LS_JIRA = 'qc_jira_config';

export const getJiraConfig = async () => {
  return JSON.parse(localStorage.getItem(LS_JIRA) || '{}');
};

export const updateJiraConfig = async (data) => {
  localStorage.setItem(LS_JIRA, JSON.stringify(data));
  return true;
};

// ─── JIRA (FAKE) ─────────────────────────
export const createJiraIssue = async () => {
  alert('Fake Jira created ✅');
};

export const sendBugsToJira = async () => {
  alert('Sent bugs to Jira ✅');
};

// ─── AUTH ─────────────────────────
export const getHasAnyAccount = async () => {
  const res = await api.get('/api/auth/has-accounts');
  return Boolean(res.data?.hasAnyAccount);
};

export const registerAccount = async (username, password) => {
  const res = await api.post('/api/auth/register', { username, password });
  return res.data;
};

export const loginAccount = async (username, password) => {
  const res = await api.post('/api/auth/login', { username, password });
  return res.data;
};

// ─── DASHBOARD ─────────────────────────
export const getDashboard = async () => {
  const res = await api.get('/api/reports/dashboard', {
    params: { _t: Date.now() },
    headers: { 'Cache-Control': 'no-cache' },
  });
  const payload = res.data || {};

  const projects = (Array.isArray(payload.projects) ? payload.projects : []).map((p) => ({
    ...p,
    versionCount: p.version_count ?? (Array.isArray(p.versions) ? p.versions.length : 0),
    versions: (Array.isArray(p.versions) ? p.versions : []).map((v) => ({
      id: v.id,
      name: v.name,
      total: v.total ?? 0,
      passed: v.passed ?? 0,
      failed: v.failed ?? 0,
      warning: v.warning ?? 0,
      notRun: v.not_run ?? 0,
    })),
  }));

  const checklists = (Array.isArray(payload.checklists) ? payload.checklists : []).map((c) => ({
    id: c.build_id,
    buildId: c.build_id,
    projectId: c.project_id,
    versionId: c.version_id,
    buildName: c.build_name,
    projectName: c.project_name,
    versionName: c.version_name,
    status: c.status,
    executionPercent: c.execution_percentage ?? 0,
    total: c.total ?? 0,
    passed: c.passed ?? 0,
    failed: c.failed ?? 0,
    warning: c.warning ?? 0,
    notRun: c.not_run ?? 0,
    inProgress: c.in_progress ?? 0,
  }));

  return {
    projects,
    checklists,
  };
};

// ─── TEST PLAN ─────────────────────────
export const getTestPlans = async (params = {}) => {
  const res = await api.get('/api/test-plans', { params });
  return Array.isArray(res.data) ? res.data : [];
};

export const getTestPlanById = async (id) => {
  const res = await api.get(`/api/test-plans/${id}`);
  return res.data;
};

export const createTestPlan = async (data) => {
  const res = await api.post('/api/test-plans', data);
  notifyDataChanged();
  return res.data;
};

export const updateTestPlan = async (id, data) => {
  const res = await api.put(`/api/test-plans/${id}`, data);
  notifyDataChanged();
  return res.data;
};

export const signOffTestPlan = async (id, data = {}) => {
  const res = await api.post(`/api/test-plans/${id}/sign-off`, data);
  notifyDataChanged();
  return res.data;
};

export const deleteTestPlan = async (id) => {
  await api.delete(`/api/test-plans/${id}`);
  notifyDataChanged();
};

export const importTestPlans = async (plans) => {
  const res = await api.post('/api/test-plans/import', { plans });
  notifyDataChanged();
  return res.data;
};

// ─── REPORTS ─────────────────────────
export const getBuildTrend = async (versionId) => {
  const res = await api.get('/api/reports/build-trend', { params: { version_id: versionId } });
  return Array.isArray(res.data) ? res.data : [];
};