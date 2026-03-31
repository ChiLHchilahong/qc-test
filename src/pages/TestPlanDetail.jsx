import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getProjects,
  getVersions,
  getTestPlanById,
  updateTestPlan,
  signOffTestPlan,
  deleteTestPlan,
} from '../api/client';
import Modal from '../components/Modal';

const PLAN_STATUSES = ['Draft', 'Ready', 'In Progress', 'Blocked', 'Ready for Sign-off', 'Closed'];

export default function TestPlanDetail() {
  const { planId } = useParams();
  const navigate = useNavigate();

  const [plan, setPlan] = useState(null);
  const [projects, setProjects] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [signOffNote, setSignOffNote] = useState('');

  const [form, setForm] = useState({
    name: '',
    projectId: '',
    versionId: '',
    status: 'Draft',
    assignee: '',
    objective: '',
    scopeIn: '',
    scopeOut: '',
    entryCriteria: '',
    exitCriteria: '',
    plannedStartDate: '',
    plannedEndDate: '',
    actualEndDate: '',
  });

  const hydrate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planData, projectRows] = await Promise.all([
        getTestPlanById(planId),
        getProjects(),
      ]);

      setPlan(planData);
      setProjects(Array.isArray(projectRows) ? projectRows : []);

      const versionRows = planData?.project_id ? await getVersions(planData.project_id) : [];
      setVersions(Array.isArray(versionRows) ? versionRows : []);

      setForm({
        name: planData?.name || '',
        projectId: String(planData?.project_id || ''),
        versionId: planData?.version_id ? String(planData.version_id) : '',
        status: planData?.status || 'Draft',
        assignee: planData?.assignee || '',
        objective: planData?.objective || '',
        scopeIn: planData?.scope_in || '',
        scopeOut: planData?.scope_out || '',
        entryCriteria: planData?.entry_criteria || '',
        exitCriteria: planData?.exit_criteria || '',
        plannedStartDate: planData?.planned_start_date || '',
        plannedEndDate: planData?.planned_end_date || '',
        actualEndDate: planData?.actual_end_date || '',
      });
      setSignOffNote(planData?.sign_off_note || '');
    } catch (err) {
      setError(err?.message || 'Failed to load test plan detail');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const projectName = useMemo(() => {
    const project = projects.find((p) => String(p.id) === String(form.projectId));
    return project?.name || plan?.project_name || '-';
  }, [projects, form.projectId, plan]);
  const executionSummary = plan?.execution_summary || null;

  const handleProjectChange = async (value) => {
    setForm((prev) => ({ ...prev, projectId: value, versionId: '' }));
    if (!value) {
      setVersions([]);
      return;
    }

    const rows = await getVersions(value);
    setVersions(Array.isArray(rows) ? rows : []);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        status: form.status,
        assignee: form.assignee,
        objective: form.objective,
        scopeIn: form.scopeIn,
        scopeOut: form.scopeOut,
        entryCriteria: form.entryCriteria,
        exitCriteria: form.exitCriteria,
        plannedStartDate: form.plannedStartDate || null,
        plannedEndDate: form.plannedEndDate || null,
        actualEndDate: form.actualEndDate || null,
        versionId: form.versionId ? Number(form.versionId) : null,
      };
      await updateTestPlan(planId, payload);
      await hydrate();
    } catch (err) {
      setError(err?.message || 'Failed to save test plan');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOff = async () => {
    setSaving(true);
    setError(null);
    try {
      await signOffTestPlan(planId, { note: signOffNote, status: 'Closed' });
      await hydrate();
    } catch (err) {
      setError(err?.message || 'Failed to sign off test plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteTestPlan(planId);
    navigate('/test-plans', { replace: true });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <nav className="mb-4 text-sm text-gray-500">
        <Link to="/test-plans" className="transition-colors hover:text-blue-600">Test Plans</Link>
        <span className="mx-2">/</span>
        <span className="font-medium text-gray-900">{plan?.name || 'Detail'}</span>
      </nav>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{plan?.name || 'Test Plan'}</h1>
          <p className="text-sm text-gray-500">Project: {projectName}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{form.status}</span>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
          >
            Delete
          </button>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Plan Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Project</label>
              <select
                value={form.projectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                disabled
              >
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Version (optional)</label>
              <select
                value={form.versionId}
                onChange={(e) => setForm((prev) => ({ ...prev, versionId: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="">No specific version</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {PLAN_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Assignee</label>
              <input
                value={form.assignee}
                onChange={(e) => setForm((prev) => ({ ...prev, assignee: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="QA Lead"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Objective</label>
            <textarea
              value={form.objective}
              onChange={(e) => setForm((prev) => ({ ...prev, objective: e.target.value }))}
              className="h-24 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Scope In</label>
              <textarea
                value={form.scopeIn}
                onChange={(e) => setForm((prev) => ({ ...prev, scopeIn: e.target.value }))}
                className="h-24 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Scope Out</label>
              <textarea
                value={form.scopeOut}
                onChange={(e) => setForm((prev) => ({ ...prev, scopeOut: e.target.value }))}
                className="h-24 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Entry Criteria</label>
              <textarea
                value={form.entryCriteria}
                onChange={(e) => setForm((prev) => ({ ...prev, entryCriteria: e.target.value }))}
                className="h-24 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Exit Criteria</label>
              <textarea
                value={form.exitCriteria}
                onChange={(e) => setForm((prev) => ({ ...prev, exitCriteria: e.target.value }))}
                className="h-24 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Planned Start</label>
              <input
                type="date"
                value={form.plannedStartDate || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, plannedStartDate: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Planned End</label>
              <input
                type="date"
                value={form.plannedEndDate || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, plannedEndDate: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Actual End</label>
              <input
                type="date"
                value={form.actualEndDate || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, actualEndDate: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <aside className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h2 className="text-base font-semibold text-slate-900">Execution Summary</h2>
            {form.versionId ? (
              <>
                <p className="mt-1 text-xs text-slate-600">Live numbers from the linked version checklist.</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-white p-2"><span className="text-slate-500">Builds</span><div className="font-semibold text-slate-900">{executionSummary?.build_count ?? 0}</div></div>
                  <div className="rounded-lg bg-white p-2"><span className="text-slate-500">Total TC</span><div className="font-semibold text-slate-900">{executionSummary?.total ?? 0}</div></div>
                  <div className="rounded-lg bg-white p-2"><span className="text-slate-500">Passed</span><div className="font-semibold text-emerald-700">{executionSummary?.passed ?? 0}</div></div>
                  <div className="rounded-lg bg-white p-2"><span className="text-slate-500">Failed</span><div className="font-semibold text-rose-700">{executionSummary?.failed ?? 0}</div></div>
                  <div className="rounded-lg bg-white p-2"><span className="text-slate-500">Warning</span><div className="font-semibold text-orange-700">{executionSummary?.warning ?? 0}</div></div>
                  <div className="rounded-lg bg-white p-2"><span className="text-slate-500">Not Run</span><div className="font-semibold text-slate-700">{executionSummary?.not_run ?? 0}</div></div>
                  <div className="rounded-lg bg-white p-2"><span className="text-slate-500">In Progress</span><div className="font-semibold text-amber-700">{executionSummary?.in_progress ?? 0}</div></div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-white p-2"><span className="text-slate-500">Pass Rate</span><div className="font-bold text-indigo-700">{executionSummary?.pass_rate ?? 0}%</div></div>
                  <div className="rounded-lg bg-white p-2"><span className="text-slate-500">Execution</span><div className="font-bold text-indigo-700">{executionSummary?.execution_rate ?? 0}%</div></div>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Total = Passed + Failed + Warning + In Progress + Not Run
                </p>
                <Link
                  to={`/projects/${form.projectId}/versions/${form.versionId}`}
                  className="mt-3 inline-block text-xs font-semibold text-blue-700 hover:text-blue-800"
                >
                  Open linked version
                </Link>
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-600">Link this plan to a version to see execution summary.</p>
            )}
          </div>

          <h2 className="text-lg font-semibold text-gray-900">Sign-off</h2>
          <p className="text-sm text-gray-600">Finalize this test plan when quality gate is complete.</p>

          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
            <p><span className="font-medium text-gray-700">Signed by:</span> {plan?.sign_off_by || '-'}</p>
            <p><span className="font-medium text-gray-700">Last update:</span> {plan?.updated_at || '-'}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Sign-off Note</label>
            <textarea
              value={signOffNote}
              onChange={(e) => setSignOffNote(e.target.value)}
              className="h-28 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Release quality summary"
            />
          </div>

          <button
            onClick={handleSignOff}
            disabled={saving}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Processing...' : 'Sign Off (Close Plan)'}
          </button>
        </aside>
      </section>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Test Plan"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Delete this test plan permanently? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="rounded-lg bg-rose-600 px-4 py-2 font-medium text-white hover:bg-rose-700"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
