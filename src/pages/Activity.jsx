import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getActivity } from '../api/client';

const ACTION_CFG = {
  create:       { label: 'Created',      bg: 'bg-emerald-100', color: 'text-emerald-700' },
  update:       { label: 'Updated',      bg: 'bg-blue-100',    color: 'text-blue-700' },
  delete:       { label: 'Deleted',      bg: 'bg-red-100',     color: 'text-red-700' },
  bulk_status:  { label: 'Bulk Update',  bg: 'bg-purple-100',  color: 'text-purple-700' },
  sign_off:     { label: 'Signed Off',   bg: 'bg-amber-100',   color: 'text-amber-700' },
};

const ENTITY_LABELS = { bug: 'Bug', test_plan: 'Test Plan', build: 'Build', project: 'Project' };

function getEntityPath(row) {
  if (row.entity_type === 'bug' && row.entity_id) return `/bugs/${row.entity_id}`;
  if (row.entity_type === 'test_plan' && row.entity_id) return `/test-plans/${row.entity_id}`;
  return null;
}

const ENTITY_TYPES = ['', 'bug', 'test_plan', 'build', 'project'];

export default function Activity() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (filterType) params.entity_type = filterType;
      const data = await getActivity(params);
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-sm text-gray-500 mt-1">Recent actions across the QC Suite</p>
        </div>
        <button onClick={fetchLogs} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Refresh
        </button>
      </div>

      {/* Filter */}
      <div className="mb-4 flex gap-3">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t ? ENTITY_LABELS[t] || t : 'All Types'}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ backgroundColor: '#1a1f36' }}>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase w-16">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase w-28">Action</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase w-24">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Entity</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase w-28">Actor</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Detail</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase w-40">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-16 text-center text-gray-400">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-16 text-center text-gray-400">No activity yet.</td></tr>
            ) : rows.map((row, idx) => {
              const cfg = ACTION_CFG[row.action] || { label: row.action, bg: 'bg-gray-100', color: 'text-gray-600' };
              const path = getEntityPath(row);
              return (
                <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-2 text-xs text-gray-400">{row.id}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500 capitalize">{ENTITY_LABELS[row.entity_type] || row.entity_type}</td>
                  <td className="px-4 py-2">
                    {path ? (
                      <Link to={path} className="font-medium text-gray-800 hover:text-blue-600 hover:underline">
                        {row.entity_label || `#${row.entity_id}`}
                      </Link>
                    ) : (
                      <span className="text-gray-700">{row.entity_label || (row.entity_id ? `#${row.entity_id}` : '—')}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">{row.actor || '—'}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{row.detail || '—'}</td>
                  <td className="px-4 py-2 text-xs text-gray-400 whitespace-nowrap">
                    {row.created_at ? String(row.created_at).replace('T', ' ').slice(0, 19) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
