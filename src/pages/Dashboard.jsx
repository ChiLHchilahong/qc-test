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
    <div className="p-6 space-y-10">
      {/* Project Health Analytics */}
      <section>
        <h1 className="text-2xl font-bold text-gray-900">Project Health Analytics</h1>
        <p className="text-gray-500 mt-1">Detailed Pass/Fail metrics per version</p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-xl shadow p-4">
              <HealthChart projectName={project.name} versions={project.versions} />
            </div>
          ))}
        </div>

        {projects.length === 0 && (
          <p className="text-gray-400 mt-6 text-center">No project data available.</p>
        )}
      </section>

      {/* Active Checklists */}
      <section>
        <h1 className="text-2xl font-bold text-gray-900">Active Checklists</h1>

        <div className="flex gap-4 mt-6 overflow-x-auto pb-4">
          {activeChecklists.map((checklist) => (
            <div key={checklist.id} className="min-w-[300px] flex-shrink-0">
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
