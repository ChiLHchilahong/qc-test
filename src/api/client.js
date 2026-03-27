import axios from 'axios';

const isLocal = window.location.hostname === 'localhost';

const api = axios.create({
  baseURL: isLocal ? 'http://localhost:3001' : '',
  headers: { 'Content-Type': 'application/json' },
});

// ── LOCAL STORAGE ─────────────────────────
const getLS = (key) => JSON.parse(localStorage.getItem(key) || '[]');
const setLS = (key, data) => localStorage.setItem(key, JSON.stringify(data));

const LS_PROJECT = 'qc_projects';
const LS_VERSION = 'qc_versions';
const LS_BUILD = 'qc_builds';
const LS_TC = 'qc_testcases';

// ── PROJECT ─────────────────────────
export const getProjects = async () => getLS(LS_PROJECT);

export const createProject = async (data) => {
  const list = getLS(LS_PROJECT);
  const newItem = {
    id: Date.now(),
    name: data.name,
    created: new Date().toLocaleDateString(),
  };
  const updated = [...list, newItem];
  setLS(LS_PROJECT, updated);
  return newItem;
};

export const updateProject = async (id, data) => {
  const list = getLS(LS_PROJECT);
  setLS(
    LS_PROJECT,
    list.map((p) => (p.id === id ? { ...p, ...data } : p))
  );
};

export const deleteProject = async (id) => {
  setLS(
    LS_PROJECT,
    getLS(LS_PROJECT).filter((p) => p.id !== id)
  );
};

// ── VERSION ─────────────────────────
export const getVersions = async (projectId) =>
  getLS(LS_VERSION).filter((v) => v.projectId === Number(projectId));

export const createVersion = async (projectId, data) => {
  const list = getLS(LS_VERSION);
  const newItem = {
    id: Date.now(),
    projectId: Number(projectId),
    name: data.name,
  };
  setLS(LS_VERSION, [...list, newItem]);
  return newItem;
};

export const updateVersion = async (id, data) => {
  setLS(
    LS_VERSION,
    getLS(LS_VERSION).map((v) =>
      v.id === id ? { ...v, ...data } : v
    )
  );
};

export const deleteVersion = async (id) => {
  setLS(
    LS_VERSION,
    getLS(LS_VERSION).filter((v) => v.id !== id)
  );
};

// ── BUILD ─────────────────────────
export const getBuilds = async (versionId) =>
  getLS(LS_BUILD).filter((b) => b.versionId === Number(versionId));

export const createBuild = async (versionId, data) => {
  const list = getLS(LS_BUILD);
  const newItem = {
    id: Date.now(),
    versionId: Number(versionId),
    name: data.name,
  };
  setLS(LS_BUILD, [...list, newItem]);
  return newItem;
};

export const updateBuild = async (id, data) => {
  setLS(
    LS_BUILD,
    getLS(LS_BUILD).map((b) =>
      b.id === id ? { ...b, ...data } : b
    )
  );
};

export const deleteBuild = async (id) => {
  setLS(
    LS_BUILD,
    getLS(LS_BUILD).filter((b) => b.id !== id)
  );
};

export const copyBuild = async (id) => {
  const list = getLS(LS_BUILD);
  const original = list.find((b) => b.id === id);
  if (!original) return null;

  const newItem = {
    ...original,
    id: Date.now(),
    name: original.name + ' (Copy)',
  };

  setLS(LS_BUILD, [...list, newItem]);
  return newItem;
};

// ── TEST CASE ─────────────────────────
export const getTestCases = async (buildId) =>
  getLS(LS_TC).filter((t) => t.buildId === Number(buildId));

export const createTestCase = async (buildId, data) => {
  const list = getLS(LS_TC);
  const newItem = {
    id: Date.now(),
    buildId: Number(buildId),
    ...data,
  };
  setLS(LS_TC, [...list, newItem]);
  return newItem;
};

export const updateTestCase = async (id, data) => {
  setLS(
    LS_TC,
    getLS(LS_TC).map((t) =>
      t.id === id ? { ...t, ...data } : t
    )
  );
};

export const deleteTestCase = async (id) => {
  setLS(
    LS_TC,
    getLS(LS_TC).filter((t) => t.id !== id)
  );
};

export const importTestCases = async (buildId, testCases) => {
  const list = getLS(LS_TC);
  const mapped = testCases.map((t) => ({
    id: Date.now() + Math.random(),
    buildId: Number(buildId),
    ...t,
  }));
  setLS(LS_TC, [...list, ...mapped]);
};

// ── JIRA (FAKE) ─────────────────────────
export const createJiraIssue = async () => {
  alert('Fake Jira created ✅');
};

export const sendBugsToJira = async () => {
  alert('Sent bugs to Jira ✅');
};

// ── DASHBOARD ─────────────────────────
export const getDashboard = async () => {
  return {
    projects: getLS(LS_PROJECT),
    stats: {},
  };
};
// ── JIRA CONFIG ─────────────────────────
const LS_JIRA = 'qc_jira_config';

export const getJiraConfig = async () => {
  return JSON.parse(localStorage.getItem(LS_JIRA) || '{}');
};

export const updateJiraConfig = async (data) => {
  localStorage.setItem(LS_JIRA, JSON.stringify(data));
  return true;
};