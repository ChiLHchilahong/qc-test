import React, { useState, useEffect } from 'react';
import { getDashboard } from '../api/client';
import HealthChart from '../components/HealthChart';
import ActiveChecklist from '../components/ActiveChecklist';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDashboard()
      .then((res) => setData(res))
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
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
    <div className="mx-auto max-w-[1600px] space-y-12">
      {/* Project Health Analytics */}
      <section>
        <h1 className="text-[42px] font-extrabold leading-tight tracking-[-0.01em] text-[#0d1d3b]">
          Project Health Analytics
        </h1>
        <p className="mt-2 text-lg text-[#63748e]">Detailed Pass/Fail metrics per version</p>

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3 md:grid-cols-2">
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
        <h2 className="text-[42px] font-extrabold leading-tight tracking-[-0.01em] text-[#0d1d3b]">
          Active Checklists
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {activeChecklists.map((checklist) => (
            <div key={checklist.id}>
              <ActiveChecklist checklist={checklist} />
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
