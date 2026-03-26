import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// ── Projects ──────────────────────────────────────────────
export const getProjects = async () => {
  const res = await api.get('/projects');
  return res.data;
};

export const createProject = async (data) => {
  const res = await api.post('/projects', data);
  return res.data;
};

export const updateProject = async (id, data) => {
  const res = await api.put(`/projects/${id}`, data);
  return res.data;
};

export const deleteProject = async (id) => {
  const res = await api.delete(`/projects/${id}`);
  return res.data;
};

// ── Versions ──────────────────────────────────────────────
export const getVersions = async (projectId) => {
  const res = await api.get('/versions', { params: { projectId } });
  return res.data;
};

export const createVersion = async (projectId, data) => {
  const res = await api.post('/versions', { projectId, ...data });
  return res.data;
};

export const updateVersion = async (projectId, id, data) => {
  const res = await api.put(`/versions/${id}`, data);
  return res.data;
};

export const deleteVersion = async (projectId, id) => {
  const res = await api.delete(`/versions/${id}`);
  return res.data;
};

// ── Builds ────────────────────────────────────────────────
export const getBuilds = async (versionId) => {
  const res = await api.get('/builds', { params: { versionId } });
  return res.data;
};

export const createBuild = async (versionId, data) => {
  const res = await api.post('/builds', { versionId, ...data });
  return res.data;
};

export const copyBuild = async (id) => {
  const res = await api.post(`/builds/${id}/copy`);
  return res.data;
};

export const updateBuild = async (id, data) => {
  const res = await api.put(`/builds/${id}`, data);
  return res.data;
};

export const deleteBuild = async (id) => {
  const res = await api.delete(`/builds/${id}`);
  return res.data;
};

// ── Test Cases ────────────────────────────────────────────
export const getTestCases = async (buildId) => {
  const res = await api.get('/testcases', { params: { buildId } });
  return res.data;
};

export const createTestCase = async (buildId, data) => {
  const res = await api.post('/testcases', { buildId, ...data });
  return res.data;
};

export const updateTestCase = async (id, data) => {
  const res = await api.put(`/testcases/${id}`, data);
  return res.data;
};

export const bulkUpdateTestCases = async (ids, updates) => {
  const res = await api.put('/testcases/bulk', { ids, updates });
  return res.data;
};

export const deleteTestCase = async (id) => {
  const res = await api.delete(`/testcases/${id}`);
  return res.data;
};

export const importTestCases = async (buildId, testCases) => {
  const res = await api.post('/testcases/import', { buildId, testCases });
  return res.data;
};

// ── Reports ───────────────────────────────────────────────
export const getDashboard = async () => {
  const res = await api.get('/reports/dashboard');
  return res.data;
};

// ── Jira Integration ─────────────────────────────────────
export const createJiraIssue = async (data) => {
  const res = await api.post('/jira/create-issue', data);
  return res.data;
};

export const sendBugsToJira = async (buildId) => {
  const res = await api.post('/jira/send-bugs', { buildId });
  return res.data;
};

export const getJiraIssue = async (key) => {
  const res = await api.get(`/jira/issue/${key}`);
  return res.data;
};

export const getJiraConfig = async () => {
  const res = await api.get('/jira/config');
  return res.data;
};

export const updateJiraConfig = async (data) => {
  const res = await api.post('/jira/config', data);
  return res.data;
};

// ── Export ─────────────────────────────────────────────────
export const exportCSV = async (buildId) => {
  const testCases = await getTestCases(buildId);
  const rows = testCases.map((tc) => tc);

  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h] ?? '';
          const escaped = String(val).replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `build-${buildId}-testcases.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export default api;
