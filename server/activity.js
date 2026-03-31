import db from './db.js';

/**
 * Log an activity event.
 * @param {object} params
 * @param {string} params.action       - e.g. 'create', 'update', 'delete', 'sign_off'
 * @param {string} params.entity_type  - e.g. 'bug', 'test_plan', 'build', 'project'
 * @param {number} [params.entity_id]
 * @param {string} [params.entity_label]
 * @param {string} [params.actor]      - username
 * @param {string} [params.detail]     - free-text context
 */
export function logActivity({ action, entity_type, entity_id, entity_label, actor, detail }) {
  try {
    db.prepare(`
      INSERT INTO activity_log (action, entity_type, entity_id, entity_label, actor, detail)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      action || '',
      entity_type || '',
      entity_id ?? null,
      entity_label || '',
      actor || '',
      detail || '',
    );
  } catch (_) {
    // Non-critical — never crash the main request
  }
}
