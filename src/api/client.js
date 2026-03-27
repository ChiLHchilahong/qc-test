import axios from 'axios';

// ⚠️ FIX: detect environment
const isLocal = window.location.hostname === 'localhost';

const api = axios.create({
  baseURL: isLocal ? 'http://localhost:3001' : '', // nếu deploy thì fallback localStorage
  headers: { 'Content-Type': 'application/json' },
});

// ── LOCAL STORAGE FALLBACK ──────────────────────────────
const LS_KEY = 'qc_projects';

const getLocalProjects = () => {
  return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
};

const saveLocalProjects = (data) => {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
};

// ── Projects ──────────────────────────────────────────────
export const getProjects = async () => {
  try {
    if (isLocal) {
      const res = await api.get('/projects');
      return res.data;
    }
  } catch (e) {}

  // fallback
  return getLocalProjects();
};

export const createProject = async (data) => {
  try {
    if (isLocal) {
      const res = await api.post('/projects', data);
      return res.data;
    }
  } catch (e) {}

  // fallback local
  const current = getLocalProjects();
  const newProject = {
    id: Date.now(),
    name: data.name,
    created: new Date().toLocaleDateString(),
  };

  const updated = [...current, newProject];
  saveLocalProjects(updated);

  return newProject;
};

export const updateProject = async (id, data) => {
  try {
    if (isLocal) {
      const res = await api.put(`/projects/${id}`, data);
      return res.data;
    }
  } catch (e) {}

  const current = getLocalProjects();
  const updated = current.map((p) =>
    p.id === id ? { ...p, ...data } : p
  );
  saveLocalProjects(updated);
  return true;
};

export const deleteProject = async (id) => {
  try {
    if (isLocal) {
      const res = await api.delete(`/projects/${id}`);
      return res.data;
    }
  } catch (e) {}

  const current = getLocalProjects();
  const updated = current.filter((p) => p.id !== id);
  saveLocalProjects(updated);
  return true;
};
// ── Dashboard ─────────────────────────────────────────────
export const getDashboard = async () => {
  try {
    if (window.location.hostname === 'localhost') {
      const res = await api.get('/reports/dashboard');
      return res.data;
    }
  } catch (e) {}

  // fallback local fake data
  return {
    projects: [],
    stats: {
      total: 0,
      passed: 0,
      failed: 0,
    },
  };
};