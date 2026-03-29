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

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/projects', projectsRouter);
app.use('/api/versions', versionsRouter);
app.use('/api/builds', buildsRouter);
app.use('/api/testcases', testcasesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/jira', jiraRouter);

// ── AI proxy route (Gemini 2.0 Flash) ─────────────────────
app.post('/api/ai/gemini', async (req, res) => {
  try {
    const { prompt, apiKey, max_output_tokens = 2000 } = req.body || {};
    const key = apiKey || process.env.GEMINI_API_KEY;

    if (!key || !prompt) {
      return res.status(400).json({ error: 'Missing prompt or API key' });
    }

    // Dùng Gemini 2.0 Flash (model mới nhất, miễn phí)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: max_output_tokens,
          temperature: 0.3,
        }
      })
    });

    const text = await response.text();

    if (!response.ok) {
      let parsedError;
      try { parsedError = JSON.parse(text); }
      catch { parsedError = { message: text || `HTTP ${response.status}` }; }
      console.error('Gemini error:', parsedError);
      return res.status(response.status).json({ error: parsedError });
    }

    let data;
    try { data = JSON.parse(text); }
    catch { return res.status(502).json({ error: 'Invalid JSON from Gemini', raw: text.slice(0, 500) }); }

    // Extract text from Gemini v1beta response format
    const outputText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!outputText) {
      console.error('Gemini empty output:', JSON.stringify(data).slice(0, 500));
      return res.status(502).json({ error: 'Gemini returned empty content', raw: data });
    }

    // Return in format client expects: { candidates: [{ output: text }] }
    return res.json({
      candidates: [{ output: outputText }],
      output: { text: outputText }
    });

  } catch (e) {
    console.error('Gemini proxy error:', e);
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
  console.log(`QC Suite running on port ${PORT}`);
});
