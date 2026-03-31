import { Router } from 'express';
import db from '../db.js';
import { getOwnerScope } from '../owner-scope.js';

const router = Router();

// GET /dashboard - Aggregated dashboard data
router.get('/dashboard', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    // Per-project summary with version-level pass/fail counts
    const projects = scope.isAdmin
      ? db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all()
      : db.prepare('SELECT * FROM projects WHERE owner_key = ? ORDER BY created_at DESC').all(scope.ownerKey);

    const projectSummaries = projects.map((project) => {
      const versions = db.prepare('SELECT * FROM versions WHERE project_id = ? ORDER BY created_at DESC').all(project.id);

      const versionDetails = versions.map((version) => {
        const stats = db.prepare(`
          SELECT
            COUNT(tc.id) AS total,
            SUM(CASE WHEN lower(trim(coalesce(tc.result,''))) IN ('passed','pass') THEN 1 ELSE 0 END) AS passed,
            SUM(CASE WHEN lower(trim(coalesce(tc.result,''))) IN ('failed','fail') THEN 1 ELSE 0 END) AS failed,
            SUM(CASE WHEN lower(trim(coalesce(tc.result,''))) IN ('warning','warn') THEN 1 ELSE 0 END) AS warning,
            SUM(CASE WHEN tc.id IS NOT NULL AND lower(trim(coalesce(tc.result,''))) NOT IN (
              'passed','pass','failed','fail','warning','warn',
              'in progress','in-progress','in_progress','inprogress'
            ) THEN 1 ELSE 0 END) AS not_run
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
          warning: stats.warning || 0,
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
    const activeBuilds = scope.isAdmin
      ? db.prepare(`
          SELECT
            b.id AS build_id,
            b.name AS build_name,
            b.created_at,
            v.id AS version_id,
            v.name AS version_name,
            p.id AS project_id,
            p.name AS project_name,
            COUNT(tc.id) AS total,
            SUM(CASE WHEN lower(trim(coalesce(tc.result,''))) IN ('passed','pass') THEN 1 ELSE 0 END) AS passed,
            SUM(CASE WHEN lower(trim(coalesce(tc.result,''))) IN ('failed','fail') THEN 1 ELSE 0 END) AS failed,
            SUM(CASE WHEN lower(trim(coalesce(tc.result,''))) IN ('warning','warn') THEN 1 ELSE 0 END) AS warning,
            SUM(CASE WHEN tc.id IS NOT NULL AND lower(trim(coalesce(tc.result,''))) NOT IN ('passed','pass','failed','fail','warning','warn','in progress','in-progress','in_progress','inprogress') THEN 1 ELSE 0 END) AS not_run,
            SUM(CASE WHEN lower(trim(coalesce(tc.result,''))) IN ('in progress','in-progress','in_progress','inprogress') THEN 1 ELSE 0 END) AS in_progress
          FROM builds b
          JOIN versions v ON v.id = b.version_id
          JOIN projects p ON p.id = v.project_id
          LEFT JOIN test_cases tc ON tc.build_id = b.id
          GROUP BY b.id
          ORDER BY b.created_at DESC
        `).all()
      : db.prepare(`
          SELECT
            b.id AS build_id,
            b.name AS build_name,
            b.created_at,
            v.id AS version_id,
            v.name AS version_name,
            p.id AS project_id,
            p.name AS project_name,
            COUNT(tc.id) AS total,
            SUM(CASE WHEN lower(trim(coalesce(tc.result,''))) IN ('passed','pass') THEN 1 ELSE 0 END) AS passed,
            SUM(CASE WHEN lower(trim(coalesce(tc.result,''))) IN ('failed','fail') THEN 1 ELSE 0 END) AS failed,
            SUM(CASE WHEN lower(trim(coalesce(tc.result,''))) IN ('warning','warn') THEN 1 ELSE 0 END) AS warning,
            SUM(CASE WHEN tc.id IS NOT NULL AND lower(trim(coalesce(tc.result,''))) NOT IN ('passed','pass','failed','fail','warning','warn','in progress','in-progress','in_progress','inprogress') THEN 1 ELSE 0 END) AS not_run,
            SUM(CASE WHEN lower(trim(coalesce(tc.result,''))) IN ('in progress','in-progress','in_progress','inprogress') THEN 1 ELSE 0 END) AS in_progress
          FROM builds b
          JOIN versions v ON v.id = b.version_id
          JOIN projects p ON p.id = v.project_id
          LEFT JOIN test_cases tc ON tc.build_id = b.id
          WHERE p.owner_key = ?
          GROUP BY b.id
          ORDER BY b.created_at DESC
        `).all(scope.ownerKey);

    const checklists = activeBuilds.map((build) => {
      const resultCounts = [
        { key: 'Passed', value: build.passed || 0 },
        { key: 'Failed', value: build.failed || 0 },
        { key: 'Warning', value: build.warning || 0 },
        { key: 'Not Run', value: build.not_run || 0 },
        { key: 'In Progress', value: build.in_progress || 0 },
      ];

      // Pick the most frequent result in this build.
      resultCounts.sort((a, b) => {
        if (b.value !== a.value) return b.value - a.value;
        const priority = ['Failed', 'Warning', 'Not Run', 'In Progress', 'Passed'];
        return priority.indexOf(a.key) - priority.indexOf(b.key);
      });

      let status = 'PENDING';
      if ((build.total || 0) > 0) {
        const dominantResult = resultCounts[0]?.key || 'Not Run';
        if (dominantResult === 'Failed') status = 'HAS BUGS';
        if (dominantResult === 'Warning') status = 'HAS BUGS';
        if (dominantResult === 'Passed') status = 'PASSED';
        if (dominantResult === 'In Progress') status = 'IN PROGRESS';
      }

      const executed = build.total > 0 ? ((build.total - build.not_run) / build.total) * 100 : 0;

      return {
        build_id: build.build_id,
        build_name: build.build_name,
        project_id: build.project_id,
        project_name: build.project_name,
        version_id: build.version_id,
        version_name: build.version_name,
        status,
        execution_percentage: Math.round(executed * 100) / 100,
        total: build.total,
        passed: build.passed,
        failed: build.failed,
        warning: build.warning,
        not_run: build.not_run,
        in_progress: build.in_progress,
      };
    });

    res.json({ projects: projectSummaries, checklists });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /build-trend?version_id=X - Pass rate per build for a version (for trend chart)
router.get('/build-trend', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const { version_id } = req.query;
    if (!version_id) return res.status(400).json({ error: 'version_id is required' });

    const rows = scope.isAdmin
      ? db.prepare(`
          SELECT
            b.id AS build_id,
            b.name AS build_name,
            b.created_at,
            COUNT(tc.id) AS total,
            SUM(CASE WHEN lower(trim(coalesce(tc.result,''))) IN ('passed','pass') THEN 1 ELSE 0 END) AS passed,
            SUM(CASE WHEN lower(trim(coalesce(tc.result,''))) IN ('failed','fail') THEN 1 ELSE 0 END) AS failed,
            SUM(CASE WHEN lower(trim(coalesce(tc.result,''))) IN ('warning','warn') THEN 1 ELSE 0 END) AS warning,
            SUM(CASE WHEN tc.id IS NOT NULL AND lower(trim(coalesce(tc.result,''))) NOT IN ('passed','pass','failed','fail','warning','warn','in progress','in-progress','in_progress','inprogress') THEN 1 ELSE 0 END) AS not_run
          FROM builds b
          LEFT JOIN test_cases tc ON tc.build_id = b.id
          WHERE b.version_id = ?
          GROUP BY b.id
          ORDER BY b.created_at ASC
        `).all(version_id)
      : db.prepare(`
          SELECT
            b.id AS build_id,
            b.name AS build_name,
            b.created_at,
            COUNT(tc.id) AS total,
            SUM(CASE WHEN lower(trim(coalesce(tc.result,''))) IN ('passed','pass') THEN 1 ELSE 0 END) AS passed,
            SUM(CASE WHEN lower(trim(coalesce(tc.result,''))) IN ('failed','fail') THEN 1 ELSE 0 END) AS failed,
            SUM(CASE WHEN lower(trim(coalesce(tc.result,''))) IN ('warning','warn') THEN 1 ELSE 0 END) AS warning,
            SUM(CASE WHEN tc.id IS NOT NULL AND lower(trim(coalesce(tc.result,''))) NOT IN ('passed','pass','failed','fail','warning','warn','in progress','in-progress','in_progress','inprogress') THEN 1 ELSE 0 END) AS not_run
          FROM builds b
          JOIN versions v ON v.id = b.version_id
          JOIN projects p ON p.id = v.project_id
          LEFT JOIN test_cases tc ON tc.build_id = b.id
          WHERE b.version_id = ? AND p.owner_key = ?
          GROUP BY b.id
          ORDER BY b.created_at ASC
        `).all(version_id, scope.ownerKey);

    const trend = rows.map((r) => ({
      build_id: r.build_id,
      build_name: r.build_name,
      total: r.total || 0,
      passed: r.passed || 0,
      failed: r.failed || 0,
      warning: r.warning || 0,
      not_run: r.not_run || 0,
      pass_rate: r.total > 0 ? Math.round((r.passed / r.total) * 1000) / 10 : 0,
    }));

    res.json(trend);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
