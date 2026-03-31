import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboard } from '../api/client';
import HealthChart from '../components/HealthChart';
import ActiveChecklist from '../components/ActiveChecklist';

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [checklistTheme, setChecklistTheme] = useState('neon');

  const fetchDashboard = (withLoading = false) => {
    if (withLoading) setLoading(true);
    if (!withLoading) setSyncing(true);

    return getDashboard()
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
      .finally(() => {
        if (withLoading) setLoading(false);
        if (!withLoading) setSyncing(false);
      });
  };

  useEffect(() => {
    fetchDashboard(true);

    const onDataChanged = () => fetchDashboard(false);
    const onStorage = (e) => {
      if (e.key === 'qc:last-data-change') fetchDashboard(false);
    };

    window.addEventListener('qc:data-changed', onDataChanged);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('qc:data-changed', onDataChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('qc:checklist-theme', checklistTheme);
  }, [checklistTheme]);

  useEffect(() => {
    setChecklistTheme('neon');
    localStorage.setItem('qc:checklist-theme', 'neon');
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
      </div>
    );
  }

  const projects = data?.projects || [];
  const activeChecklists = data?.checklists || [];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 sm:space-y-12 max-[393px]:space-y-5">
      {/* Project Health Analytics */}
      <section>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-extrabold leading-tight tracking-[-0.01em] text-[#0d1d3b] sm:text-3xl md:text-[34px] max-[393px]:text-[22px]">
            Project Health Analytics
          </h1>
          {syncing && (
            <div className="inline-flex items-center gap-2 rounded-full border border-[#cfd8e6] bg-white/80 px-3 py-1 text-xs font-semibold text-[#5f708a]">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#aebbd0] border-t-[#4f6ef7]" />
              Syncing...
            </div>
          )}
        </div>
        <p className="mt-2 text-base text-[#63748e] sm:text-lg max-[393px]:text-sm">Detailed Pass/Fail metrics per version</p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:gap-6 xl:grid-cols-3 md:grid-cols-2">
          {projects.map((project) => (
            <HealthChart key={project.id} projectName={project.name} versions={project.versions} />
          ))}
        </div>

        {projects.length === 0 && (
          <p className="text-gray-400 mt-6 text-center">No project data available.</p>
        )}
      </section>

      {/* Active Checklists */}
      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-extrabold leading-tight tracking-[-0.01em] text-[#0d1d3b] sm:text-3xl md:text-[34px] max-[393px]:text-[22px]">
            Active Checklists
          </h2>
          <div className="inline-flex items-center gap-1 rounded-full border border-[#cfd8e6] bg-white/80 p-1">
            <button
              onClick={() => setChecklistTheme('neon')}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                checklistTheme === 'neon' ? 'bg-[#6d1ff2] text-white' : 'text-[#5f708a]'
              }`}
            >
              Neon
            </button>
            <button
              onClick={() => setChecklistTheme('enterprise')}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                checklistTheme === 'enterprise' ? 'bg-[#334155] text-white' : 'text-[#5f708a]'
              }`}
            >
              Enterprise
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
          {activeChecklists.map((checklist) => (
            <div
              key={checklist.id}
              className="cursor-pointer"
              onClick={() => {
                if (!checklist.projectId || !checklist.versionId || !checklist.buildId) return;
                navigate(`/projects/${checklist.projectId}/versions/${checklist.versionId}/builds/${checklist.buildId}`);
              }}
            >
              <ActiveChecklist checklist={checklist} themeVariant={checklistTheme} />
            </div>
          ))}
        </div>

        {activeChecklists.length === 0 && (
          <p className="text-gray-400 mt-6 text-center">No active checklists.</p>
        )}
      </section>
    </div>
  );
}
