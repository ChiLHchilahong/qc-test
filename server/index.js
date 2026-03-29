import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import projectsRouter from './routes/projects.js';
import versionsRouter from './routes/versions.js';
import buildsRouter from './routes/builds.js';
import testcasesRouter from './routes/testcases.js';
import reportsRouter from './routes/reports.js';
import jiraRouter from './routes/jira.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/projects', projectsRouter);
app.use('/api/versions', versionsRouter);
app.use('/api/builds', buildsRouter);
app.use('/api/testcases', testcasesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/jira', jiraRouter);

// AI route proxy Gemini to avoid CORS from client
app.post('/api/ai/gemini', async (req, res) => {
  try {
    const { prompt, apiKey, max_output_tokens = 2000 } = req.body || {};
    const key = apiKey || process.env.GEMINI_API_KEY;

    if (!key || !prompt) {
      return res.status(400).json({ error: 'Missing prompt or API key' });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generate?key=${encodeURIComponent(key)}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: { text: prompt }, max_output_tokens })
    });

    const text = await response.text();

    if (!response.ok) {
      let parsedError;
      try {
        parsedError = JSON.parse(text);
      } catch (err) {
        parsedError = text || `HTTP ${response.status}`;
      }
      return res.status(response.status).json({ error: parsedError });
    }

    if (!text || !text.trim()) {
      return res.status(502).json({ error: 'Empty response from Gemini API' });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      return res.status(502).json({ error: 'Invalid JSON from Gemini API', raw: text.slice(0, 1000) });
    }

    return res.json(data);
  } catch (e) {
    console.error('Gemini proxy failed:', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

// Serve static files in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`QC Suite server running on port ${PORT}`);
});
