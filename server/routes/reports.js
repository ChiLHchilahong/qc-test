import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /dashboard - Aggregated dashboard data
router.get('/dashboard', (req, res) => {
  try {
    // Per-project summary with version-level pass/fail counts
    const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();

    const projectSummaries = projects.map((project) => {
      const versions = db.prepare('SELECT * FROM versions WHERE project_id = ? ORDER BY created_at DESC').all(project.id);

      const versionDetails = versions.map((version) => {
        const stats = db.prepare(`
          SELECT
            COUNT(tc.id) AS total,
            SUM(CASE WHEN tc.result = 'Passed' THEN 1 ELSE 0 END) AS passed,
            SUM(CASE WHEN tc.result = 'Failed' THEN 1 ELSE 0 END) AS failed,
            SUM(CASE WHEN tc.result = 'Not Run' THEN 1 ELSE 0 END) AS not_run
          FROM test_cases tc
          JOIN builds b ON b.id = tc.build_id
          WHERE b.version_id = ?
        `).get(version.id);

        return {
          id: version.id,
          name: version.name,
          total: stats.total || 0,
          passed: stats.passed || 0,
          failed: stats.failed || 0,
          not_run: stats.not_run || 0,
        };
      });

      return {
        id: project.id,
        name: project.name,
        version_count: versions.length,
        versions: versionDetails,
      };
    });

    // Active checklists: builds with status and execution percentage
    const activeBuilds = db.prepare(`
      SELECT
        b.id AS build_id,
        b.name AS build_name,
        b.created_at,
        v.name AS version_name,
        p.name AS project_name,
        COUNT(tc.id) AS total,
        SUM(CASE WHEN tc.result = 'Passed' THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN tc.result = 'Failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN tc.result = 'Not Run' THEN 1 ELSE 0 END) AS not_run
      FROM builds b
      JOIN versions v ON v.id = b.version_id
      JOIN projects p ON p.id = v.project_id
      LEFT JOIN test_cases tc ON tc.build_id = b.id
      GROUP BY b.id
      HAVING total > 0
      ORDER BY b.created_at DESC
    `).all();

    const checklists = activeBuilds.map((build) => {
      let status;
      if (build.not_run === build.total) {
        status = 'PENDING';
      } else if (build.failed > 0) {
        status = 'HAS BUGS';
      } else if (build.passed === build.total) {
        status = 'PASSED';
      } else {
        status = 'IN PROGRESS';
      }

      const executed = build.total > 0 ? ((build.total - build.not_run) / build.total) * 100 : 0;

      return {
        build_id: build.build_id,
        build_name: build.build_name,
        project_name: build.project_name,
        version_name: build.version_name,
        status,
        execution_percentage: Math.round(executed * 100) / 100,
        total: build.total,
        passed: build.passed,
        failed: build.failed,
        not_run: build.not_run,
      };
    });

    res.json({ projects: projectSummaries, checklists });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
