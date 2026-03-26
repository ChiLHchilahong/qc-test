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
