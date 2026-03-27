import axios from 'axios';

const isLocal = window.location.hostname === 'localhost';

const api = axios.create({
  baseURL: isLocal ? 'http://localhost:3001' : '',
  headers: { 'Content-Type': 'application/json' },
});

// ── LOCAL STORAGE ─────────────────────────────
const LS_PROJECT = 'qc_projects';
const LS_VERSION = 'qc_versions';

const getLS = (key) => JSON.parse(localStorage.getItem(key) || '[]');
const setLS = (key, data) => localStorage.setItem(key, JSON.stringify(data));

// ── PROJECTS ─────────────────────────────
export const getProjects = async () => {
  try {
    if (isLocal) return (await api.get('/projects')).data;
  } catch {}
  return getLS(LS_PROJECT);
};

export const createProject = async (data) => {
  try {
    if (isLocal) return (await api.post('/projects', data)).data;
  } catch {}

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
  try {
    if (isLocal) return (await api.put(`/projects/${id}`, data)).data;
  } catch {}

  const list = getLS(LS_PROJECT);
  const updated = list.map((i) => (i.id === id ? { ...i, ...data } : i));
  setLS(LS_PROJECT, updated);
  return true;
};

export const deleteProject = async (id) => {
  try {
    if (isLocal) return (await api.delete(`/projects/${id}`)).data;
  } catch {}

  const list = getLS(LS_PROJECT).filter((i) => i.id !== id);
  setLS(LS_PROJECT, list);
  return true;
};

// ── VERSIONS ─────────────────────────────
export const getVersions = async (projectId) => {
  const list = getLS(LS_VERSION);
  return list.filter((v) => v.projectId === Number(projectId));
};

export const createVersion = async (projectId, data) => {
  const list = getLS(LS_VERSION);
  const newItem = {
    id: Date.now(),
    projectId: Number(projectId),
    name: data.name,
  };
  const updated = [...list, newItem];
  setLS(LS_VERSION, updated);
  return newItem;
};

export const updateVersion = async (id, data) => {
  const list = getLS(LS_VERSION);
  const updated = list.map((v) =>
    v.id === id ? { ...v, ...data } : v
  );
  setLS(LS_VERSION, updated);
  return true;
};

export const deleteVersion = async (id) => {
  const list = getLS(LS_VERSION).filter((v) => v.id !== id);
  setLS(LS_VERSION, list);
  return true;
};

// ── DASHBOARD ─────────────────────────────
export const getDashboard = async () => {
  const projects = getLS(LS_PROJECT);
  const versions = getLS(LS_VERSION);

  return {
    projects,
    stats: {
      totalProjects: projects.length,
      totalVersions: versions.length,
    },
  };
};