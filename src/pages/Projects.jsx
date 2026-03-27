import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Projects() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔥 FAKE API (đảm bảo luôn có data)
  useEffect(() => {
    setTimeout(() => {
      const fakeData = [
        { id: 1, name: "QC Tool Demo", version: "1.0" },
        { id: 2, name: "Game Test Build", version: "0.9" }
      ];

      setProjects(fakeData); // luôn là array ✅
      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Projects</h1>

      {/* 🔥 KHÔNG BAO GIỜ CRASH */}
      {(Array.isArray(projects) ? projects : []).length === 0 ? (
        <div>No projects</div>
      ) : (
        <div className="grid gap-4">
          {(Array.isArray(projects) ? projects : []).map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="p-4 border rounded cursor-pointer hover:bg-gray-50"
            >
              <h3 className="font-bold">{p.name}</h3>
              <p className="text-sm text-gray-500">Version: {p.version}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}