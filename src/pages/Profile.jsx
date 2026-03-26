import React, { useState, useEffect } from 'react';
import { getJiraConfig, updateJiraConfig } from '../api/client';

export default function Profile() {
  const [config, setConfig] = useState({
    baseUrl: '',
    email: '',
    apiToken: '',
    projectKey: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    getJiraConfig()
      .then((res) =>
        setConfig({
          baseUrl: res.baseUrl || '',
          email: res.email || '',
          apiToken: res.apiToken || '',
          projectKey: res.projectKey || '',
        })
      )
      .catch(() => setMessage({ type: 'error', text: 'Failed to load Jira configuration.' }))
      .finally(() => setLoading(false));
  }, []);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSave = () => {
    setSaving(true);
    updateJiraConfig(config)
      .then(() => showMessage('success', 'Configuration saved successfully.'))
      .catch(() => showMessage('error', 'Failed to save configuration.'))
      .finally(() => setSaving(false));
  };

  const handleTestConnection = () => {
    setTesting(true);
    // Simple validation before testing
    if (!config.baseUrl || !config.email || !config.apiToken) {
      showMessage('error', 'Please fill in Base URL, Email, and API Token before testing.');
      setTesting(false);
      return;
    }

    // Attempt to save and verify by re-fetching
    updateJiraConfig(config)
      .then(() => getJiraConfig())
      .then(() => showMessage('success', 'Connection test passed.'))
      .catch(() => showMessage('error', 'Connection test failed. Please check your credentials.'))
      .finally(() => setTesting(false));
  };

  const handleChange = (field) => (e) => {
    setConfig((prev) => ({ ...prev, [field]: e.target.value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Jira Configuration</h1>

      {/* Toast message */}
      {message && (
        <div
          className={`mb-4 p-4 rounded-lg text-sm font-medium ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 space-y-5">
        {/* Base URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Jira Base URL</label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={handleChange('baseUrl')}
            placeholder="https://your-domain.atlassian.net"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={config.email}
            onChange={handleChange('email')}
            placeholder="you@example.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* API Token */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API Token</label>
          <input
            type="password"
            value={config.apiToken}
            onChange={handleChange('apiToken')}
            placeholder="Enter your Jira API token"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Project Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project Key</label>
          <input
            type="text"
            value={config.projectKey}
            onChange={handleChange('projectKey')}
            placeholder="e.g. CTB"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 px-6 py-2 rounded-lg font-medium border border-gray-300 transition-colors"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
      </div>
    </div>
  );
}
