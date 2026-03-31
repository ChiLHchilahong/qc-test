import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'qc-suite.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Enable foreign key constraints
db.pragma('foreign_keys = ON');

// Create tables on startup
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    owner_key TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS builds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS test_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    build_id INTEGER NOT NULL,
    feature TEXT,
    description TEXT,
    test_to_perform TEXT,
    test_status TEXT DEFAULT 'To Do',
    result TEXT DEFAULT 'Not Run',
    issue TEXT,
    note TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (build_id) REFERENCES builds(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS test_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    version_id INTEGER,
    owner_key TEXT,
    name TEXT NOT NULL,
    objective TEXT DEFAULT '',
    scope_in TEXT DEFAULT '',
    scope_out TEXT DEFAULT '',
    entry_criteria TEXT DEFAULT '',
    exit_criteria TEXT DEFAULT '',
    status TEXT DEFAULT 'Draft',
    min_pass_rate INTEGER DEFAULT 80,
    max_failed INTEGER DEFAULT 0,
    max_not_run_percent INTEGER DEFAULT 20,
    assignee TEXT DEFAULT '',
    planned_start_date TEXT,
    planned_end_date TEXT,
    actual_end_date TEXT,
    sign_off_by TEXT DEFAULT '',
    sign_off_note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE SET NULL
  );
`);

const projectColumns = db.prepare('PRAGMA table_info(projects)').all();
const hasOwnerKey = projectColumns.some((c) => c.name === 'owner_key');
if (!hasOwnerKey) {
  db.exec('ALTER TABLE projects ADD COLUMN owner_key TEXT');
}

db.prepare("UPDATE projects SET owner_key = 'user:admin' WHERE owner_key IS NULL OR owner_key = ''").run();

const testPlanColumns = db.prepare('PRAGMA table_info(test_plans)').all();
const hasMinPassRate = testPlanColumns.some((c) => c.name === 'min_pass_rate');
const hasMaxFailed = testPlanColumns.some((c) => c.name === 'max_failed');
const hasMaxNotRunPercent = testPlanColumns.some((c) => c.name === 'max_not_run_percent');
if (!hasMinPassRate) {
  db.exec('ALTER TABLE test_plans ADD COLUMN min_pass_rate INTEGER DEFAULT 80');
}
if (!hasMaxFailed) {
  db.exec('ALTER TABLE test_plans ADD COLUMN max_failed INTEGER DEFAULT 0');
}
if (!hasMaxNotRunPercent) {
  db.exec('ALTER TABLE test_plans ADD COLUMN max_not_run_percent INTEGER DEFAULT 20');
}
db.prepare('UPDATE test_plans SET min_pass_rate = 80 WHERE min_pass_rate IS NULL').run();
db.prepare('UPDATE test_plans SET max_failed = 0 WHERE max_failed IS NULL').run();
db.prepare('UPDATE test_plans SET max_not_run_percent = 20 WHERE max_not_run_percent IS NULL').run();

db.exec('CREATE INDEX IF NOT EXISTS idx_projects_owner_key ON projects(owner_key)');
db.exec('CREATE INDEX IF NOT EXISTS idx_test_plans_owner_key ON test_plans(owner_key)');
db.exec('CREATE INDEX IF NOT EXISTS idx_test_plans_project_id ON test_plans(project_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_test_plans_version_id ON test_plans(version_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_test_plans_status ON test_plans(status)');

const defaultUsername = process.env.DEFAULT_LOGIN_USERNAME || 'admin';
const defaultPassword = process.env.DEFAULT_LOGIN_PASSWORD || '123456';
const existingDefaultUser = db.prepare('SELECT id FROM users WHERE lower(username) = lower(?)').get(defaultUsername);
if (!existingDefaultUser) {
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(defaultUsername, defaultPassword);
}

export default db;
