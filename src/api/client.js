import axios from 'axios';

const isLocal = window.location.hostname === 'localhost';

const api = axios.create({
  baseURL: isLocal ? 'http://localhost:3001' : '',
  headers: { 'Content-Type': 'application/json' },
});

// ─── TEST CASE ─────────────────────────
export const getTestCases = async (buildId) => {
  const res = await api.get('/api/testcases', { params: { buildId } });
  return res.data;
};

export const createTestCase = async (buildId, data) => {
  const res = await api.post('/api/testcases', { buildId, ...data });
  return res.data;
};

export const updateTestCase = async (id, data) => {
  const res = await api.put(`/api/testcases/${id}`, data);
  return res.data;
};

export const deleteTestCase = async (id) => {
  await api.delete(`/api/testcases/${id}`);
};

export const importTestCases = async (buildId, rows) => {
  const testCases = rows.map((r) => ({
    buildId,
    feature: r[0] || '',
    description: r[1] || r[2] || '',
    testToPerform: r[3] || '',
    testStatus: r[4] || 'Yes',
    result: r[5] || 'Not Run',
    issue: r[6] || '',
    note: r[7] || '',
  }));
  
  const promises = testCases.map((tc) => createTestCase(tc.buildId, tc));
  return Promise.all(promises);
};

// ─── PROJECT ─────────────────────────
export const getProjects = async () => {
  const res = await api.get('/api/projects');
  return res.data;
};

export const createProject = async (data) => {
  const res = await api.post('/api/projects', { name: data.name });
  return res.data;
};

export const updateProject = async (id, data) => {
  const res = await api.put(`/api/projects/${id}`, data);
  return res.data;
};

export const deleteProject = async (id) => {
  await api.delete(`/api/projects/${id}`);
};

// ─── VERSION ─────────────────────────
export const getVersions = async (projectId) => {
  const res = await api.get('/api/versions', { params: { projectId } });
  return res.data;
};

export const createVersion = async (projectId, data) => {
  const res = await api.post('/api/versions', { projectId, name: data.name });
  return res.data;
};

export const updateVersion = async (id, data) => {
  const res = await api.put(`/api/versions/${id}`, data);
  return res.data;
};

export const deleteVersion = async (id) => {
  await api.delete(`/api/versions/${id}`);
};

// ─── BUILD ─────────────────────────
export const getBuilds = async (versionId) => {
  const res = await api.get('/api/builds', { params: { versionId } });
  return res.data;
};

export const createBuild = async (versionId, data) => {
  const res = await api.post('/api/builds', { versionId, name: data.name });
  return res.data;
};

export const updateBuild = async (id, data) => {
  const res = await api.put(`/api/builds/${id}`, data);
  return res.data;
};

export const deleteBuild = async (id) => {
  await api.delete(`/api/builds/${id}`);
};

export const copyBuild = async (id) => {
  const res = await api.post(`/api/builds/${id}/copy`, { name: '' });
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

// ─── DASHBOARD ─────────────────────────
export const getDashboard = async () => {
  const projects = await getProjects();
  return {
    projects,
    stats: {},
  };
};