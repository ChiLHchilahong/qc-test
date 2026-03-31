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
import authRouter from './routes/auth.js';
import testPlansRouter from './routes/test-plans.js';

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
app.use('/api/auth', authRouter);
app.use('/api/test-plans', testPlansRouter);

// ── AI proxy route (Gemini 2.0 Flash) ─────────────────────
app.post('/api/ai/gemini', async (req, res) => {
  try {
    const { prompt, apiKey, max_output_tokens = 2000 } = req.body || {};
    const key = apiKey || process.env.GEMINI_API_KEY;

    if (!key || !prompt) {
      return res.status(400).json({ error: 'Missing prompt or API key' });
    }

    // Thử lần lượt các model còn được docs hiện tại hỗ trợ cho generateContent.
    const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
    const MAX_RETRY_PER_MODEL = 2;
    let lastRetryableError = null;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const model of MODELS) {
      for (let attempt = 1; attempt <= MAX_RETRY_PER_MODEL; attempt++) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: max_output_tokens,
              temperature: 0.3,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    feature: { type: 'STRING' },
                    description: { type: 'STRING' },
                    testToPerform: { type: 'STRING' },
                    testStatus: { type: 'STRING' },
                    result: { type: 'STRING' },
                    note: { type: 'STRING' },
                  },
                  propertyOrdering: ['feature', 'description', 'testToPerform', 'testStatus', 'result', 'note']
                }
              }
            }
          })
        });

        const text = await response.text();

        // 503 thường là tạm thời: retry model hiện tại với backoff ngắn.
        if (response.status === 503 && attempt < MAX_RETRY_PER_MODEL) {
          console.warn(`${model} overloaded (503), retry ${attempt}/${MAX_RETRY_PER_MODEL}...`);
          await sleep(800 * attempt);
          continue;
        }

        // Model không tồn tại/quota hết/quá tải kéo dài → thử model tiếp theo.
        if (response.status === 404 || response.status === 429 || response.status === 503) {
          console.warn(`${model} unavailable (${response.status}), trying next model...`);
          try { lastRetryableError = JSON.parse(text); } catch { lastRetryableError = { message: text }; }
          break;
        }

        if (!response.ok) {
          let parsedError;
          try { parsedError = JSON.parse(text); }
          catch { parsedError = { message: text || `HTTP ${response.status}` }; }
          console.error(`Gemini ${model} error:`, parsedError);
          return res.status(response.status).json({ error: parsedError });
        }

        let data;
        try { data = JSON.parse(text); }
        catch { return res.status(502).json({ error: 'Invalid JSON from Gemini', raw: text.slice(0, 500) }); }

        const outputText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!outputText) {
          console.error(`Gemini ${model} empty output:`, JSON.stringify(data).slice(0, 500));
          return res.status(502).json({ error: 'Gemini returned empty content', raw: data });
        }

        console.log(`Gemini OK — model: ${model}`);
        return res.json({ candidates: [{ output: outputText }], output: outputText, model });
      }
    }

    // Tất cả models đều hết quota
    return res.status(429).json({
      error: `Không gọi được model Gemini nào trong danh sách fallback (${MODELS.join(', ')}). Có thể key đã hết quota hoặc project chưa được cấp quyền dùng model hiện tại.`,
      detail: lastRetryableError,
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
