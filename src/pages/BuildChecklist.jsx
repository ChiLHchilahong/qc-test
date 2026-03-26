import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getTestCases,
  getProjects,
  getVersions,
  getBuilds,
  createTestCase,
  updateTestCase,
  deleteTestCase,
  sendBugsToJira,
  exportCSV,
} from '../api/client';
import ChecklistTable from '../components/ChecklistTable';
import Modal from '../components/Modal';

export default function BuildChecklist() {
  const { projectId, versionId, buildId } = useParams();

  const [testCases, setTestCases] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [versionName, setVersionName] = useState('');
  const [buildName, setBuildName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add TC modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTC, setNewTC] = useState({ feature: '', description: '', testToPerform: '' });

  const fetchTestCases = useCallback(() => {
    setLoading(true);
    Promise.all([
      getTestCases(buildId),
      getProjects(),
      getVersions(projectId),
      getBuilds(versionId),
    ])
      .then(([testCases, projects, versions, builds]) => {
        setTestCases(Array.isArray(testCases) ? testCases : []);
        const project = projects.find((p) => String(p.id) === String(projectId));
        setProjectName(project?.name || `Project ${projectId}`);
        const version = versions.find((v) => String(v.id) === String(versionId));
        setVersionName(version?.name || `Version ${versionId}`);
        const build = builds.find((b) => String(b.id) === String(buildId));
        setBuildName(build?.name || `Build ${buildId}`);
      })
      .catch((err) => setError(err.message || 'Failed to load test cases'))
      .finally(() => setLoading(false));
  }, [buildId, projectId, versionId]);

  useEffect(() => {
    fetchTestCases();
  }, [fetchTestCases]);

  // Stats — test_status = Yes/To Do/undefined, result = Not Run/Passed/Failed
  const stats = {
    total: testCases.length,
    yes: testCases.filter((tc) => tc.test_status === 'Yes').length,
    toDo: testCases.filter((tc) => tc.test_status === 'To Do').length,
    undefined: testCases.filter(
      (tc) => !tc.test_status || tc.test_status === 'undefined'
    ).length,
    notRun: testCases.filter((tc) => tc.result === 'Not Run' || !tc.result).length,
    passed: testCases.filter((tc) => tc.result === 'Passed').length,
    failed: testCases.filter((tc) => tc.result === 'Failed').length,
  };

  const handleUpdateTestCase = (id, updates) => {
    updateTestCase(id, updates).then(() => fetchTestCases());
  };

  const handleDeleteTestCase = (id) => {
    deleteTestCase(id).then(() => fetchTestCases());
  };

  const handleAddTestCase = () => {
    if (!newTC.feature.trim() || !newTC.description.trim()) return;
    createTestCase(buildId, {
      feature: newTC.feature.trim(),
      description: newTC.description.trim(),
      testToPerform: newTC.testToPerform.trim(),
    }).then(() => {
      setShowAddModal(false);
      setNewTC({ feature: '', description: '', testToPerform: '' });
      fetchTestCases();
    });
  };

  const handleSendToJira = () => {
    sendBugsToJira(buildId)
      .then(() => alert('Bugs sent to Jira successfully.'))
      .catch(() => alert('Failed to send bugs to Jira.'));
  };

  const handleExportCSV = () => {
    exportCSV(buildId).catch(() => alert('Failed to export CSV.'));
  };

  const handleAutoReport = () => {
    const lines = [
      `=== Auto Report: ${buildName} ===`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      `Total Test Cases: ${stats.total}`,
      `Test Status — Yes: ${stats.yes}, To Do: ${stats.toDo}, Undefined: ${stats.undefined}`,
      `Result — Passed: ${stats.passed}, Failed: ${stats.failed}, Not Run: ${stats.notRun}`,
      `Pass Rate: ${stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : 0}%`,
      '',
    ];

    const failedTCs = testCases.filter((tc) => tc.result === 'Failed');

    if (failedTCs.length > 0) {
      lines.push('--- Failed Test Cases ---');
      failedTCs.forEach((tc, i) => {
        lines.push(`${i + 1}. [${tc.feature}] ${tc.description}`);
        lines.push(`   Test Status: ${tc.test_status || 'undefined'}`);
        lines.push(`   Issue: ${tc.issue || 'N/A'}`);
        lines.push('');
      });
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${buildName.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link to="/projects" className="hover:text-blue-600 transition-colors">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/projects/${projectId}`} className="hover:text-blue-600 transition-colors">
          {projectName}
        </Link>
        <span className="mx-2">/</span>
        <Link
          to={`/projects/${projectId}/versions/${versionId}`}
          className="hover:text-blue-600 transition-colors"
        >
          {versionName}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">{buildName}</span>
      </nav>

      {/* Title */}
      <h1 className="text-2xl font-bold text-gray-900 mb-4">{buildName}</h1>

      {/* Stats Bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
          undefined: {stats.undefined}
        </span>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
          Yes: {stats.yes}
        </span>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-200 text-gray-700">
          Not Run: {stats.notRun}
        </span>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
          To Do: {stats.toDo}
        </span>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700">
          Passed: {stats.passed}
        </span>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
          Failed: {stats.failed}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={handleSendToJira}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Send to Jira
        </button>
        <button
          onClick={handleAutoReport}
          className="bg-red-400 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Auto Report
        </button>
        <button
          onClick={handleExportCSV}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Export CSV
        </button>
        <button
          disabled
          className="bg-gray-800 text-white px-4 py-2 rounded-lg font-medium opacity-50 cursor-not-allowed"
        >
          AI Parser
        </button>
      </div>

      {/* Checklist Table */}
      <ChecklistTable
        testCases={testCases}
        onUpdateTestCase={handleUpdateTestCase}
        onDeleteTestCase={handleDeleteTestCase}
      />

      {/* Add Test Case Button */}
      <div className="mt-4">
        <button
          onClick={() => {
            setNewTC({ feature: '', description: '', testToPerform: '' });
            setShowAddModal(true);
          }}
          className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 text-gray-500 hover:text-blue-600 py-3 rounded-lg font-medium transition-colors"
        >
          + Add Test Case
        </button>
      </div>

      {/* Add TC Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Test Case"
        onConfirm={handleAddTestCase}
        confirmText="Add"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Feature</label>
            <input
              type="text"
              value={newTC.feature}
              onChange={(e) => setNewTC((prev) => ({ ...prev, feature: e.target.value }))}
              placeholder="e.g. Login, Dashboard"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Test Case Description
            </label>
            <textarea
              value={newTC.description}
              onChange={(e) => setNewTC((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the test case"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test to Perform</label>
            <textarea
              value={newTC.testToPerform}
              onChange={(e) => setNewTC((prev) => ({ ...prev, testToPerform: e.target.value }))}
              placeholder="Steps to perform the test"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
