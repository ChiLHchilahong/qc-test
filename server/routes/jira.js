import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createIssue, getIssue } from '../jira-client.js';
import db from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '..', '.env');

const router = Router();

// POST /create-issue - Create a single Jira issue
router.post('/create-issue', async (req, res) => {
  try {
    const { summary, description, issueType } = req.body;
    if (!summary) {
      return res.status(400).json({ error: 'summary is required' });
    }

    const projectKey = process.env.JIRA_PROJECT_KEY || 'CTB';

    const issue = await createIssue({
      projectKey,
      summary,
      description: description || '',
      issueType: issueType || 'Bug',
    });

    res.status(201).json({
      key: issue.key,
      id: issue.id,
      self: issue.self,
      url: `${process.env.JIRA_BASE_URL}/browse/${issue.key}`,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.errors || err.message;
    res.status(status).json({ error: message });
  }
});

// POST /send-bugs - Create Jira issues for all failed test cases in a build
router.post('/send-bugs', async (req, res) => {
  try {
    const { buildId } = req.body;
    if (!buildId) {
      return res.status(400).json({ error: 'buildId is required' });
    }

    const build = db.prepare(`
      SELECT b.name AS build_name, v.name AS version_name, p.name AS project_name
      FROM builds b
      JOIN versions v ON v.id = b.version_id
      JOIN projects p ON p.id = v.project_id
      WHERE b.id = ?
    `).get(buildId);

    if (!build) {
      return res.status(404).json({ error: 'Build not found' });
    }

    const failedCases = db.prepare(
      "SELECT * FROM test_cases WHERE build_id = ? AND result = 'Failed' ORDER BY sort_order"
    ).all(buildId);

    if (failedCases.length === 0) {
      return res.json({ message: 'No failed test cases found', created: [] });
    }

    const projectKey = process.env.JIRA_PROJECT_KEY || 'CTB';
    const created = [];
    const errors = [];

    for (const tc of failedCases) {
      try {
        const summary = `[${build.project_name}][${build.version_name}][${build.build_name}] ${tc.feature || 'Test'}: ${tc.description || 'Failed test case'}`;
        const description = [
          `Project: ${build.project_name}`,
          `Version: ${build.version_name}`,
          `Build: ${build.build_name}`,
          `Feature: ${tc.feature || 'N/A'}`,
          `Description: ${tc.description || 'N/A'}`,
          `Test to perform: ${tc.test_to_perform || 'N/A'}`,
          `Issue: ${tc.issue || 'N/A'}`,
          `Note: ${tc.note || 'N/A'}`,
        ].join('\n');

        const issue = await createIssue({
          projectKey,
          summary: summary.substring(0, 255),
          description,
          issueType: 'Bug',
        });

        // Update test case with the Jira issue key
        db.prepare('UPDATE test_cases SET issue = ? WHERE id = ?').run(issue.key, tc.id);

        created.push({
          testCaseId: tc.id,
          key: issue.key,
          url: `${process.env.JIRA_BASE_URL}/browse/${issue.key}`,
        });
      } catch (err) {
        errors.push({
          testCaseId: tc.id,
          error: err.response?.data?.errors || err.message,
        });
      }
    }

    res.status(201).json({ created, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /issue/:key - Get issue details from Jira
router.get('/issue/:key', async (req, res) => {
  try {
    const issue = await getIssue(req.params.key);
    res.json({
      key: issue.key,
      summary: issue.fields?.summary,
      status: issue.fields?.status?.name,
      assignee: issue.fields?.assignee?.displayName || null,
      priority: issue.fields?.priority?.name || null,
      created: issue.fields?.created,
      updated: issue.fields?.updated,
      url: `${process.env.JIRA_BASE_URL}/browse/${issue.key}`,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.errors || err.message;
    res.status(status).json({ error: message });
  }
});

// GET /config - Return current Jira config (masked token)
router.get('/config', (req, res) => {
  try {
    const token = process.env.JIRA_API_TOKEN || '';
    const maskedToken = token ? `${token.substring(0, 4)}${'*'.repeat(Math.max(0, token.length - 4))}` : '';

    res.json({
      baseUrl: process.env.JIRA_BASE_URL || '',
      email: process.env.JIRA_EMAIL || '',
      apiToken: maskedToken,
      projectKey: process.env.JIRA_PROJECT_KEY || '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /config - Update Jira config (save to .env file)
router.post('/config', (req, res) => {
  try {
    const { baseUrl, email, apiToken, projectKey } = req.body;

    // Update process.env for immediate effect
    if (baseUrl !== undefined) process.env.JIRA_BASE_URL = baseUrl;
    if (email !== undefined) process.env.JIRA_EMAIL = email;
    if (apiToken !== undefined) process.env.JIRA_API_TOKEN = apiToken;
    if (projectKey !== undefined) process.env.JIRA_PROJECT_KEY = projectKey;

    // Write to .env file for persistence
    const envContent = [
      `PORT=${process.env.PORT || 3001}`,
      `JIRA_BASE_URL=${process.env.JIRA_BASE_URL || ''}`,
      `JIRA_EMAIL=${process.env.JIRA_EMAIL || ''}`,
      `JIRA_API_TOKEN=${process.env.JIRA_API_TOKEN || ''}`,
      `JIRA_PROJECT_KEY=${process.env.JIRA_PROJECT_KEY || ''}`,
    ].join('\n');

    fs.writeFileSync(envPath, envContent + '\n', 'utf-8');

    res.json({ success: true, message: 'Jira configuration updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
