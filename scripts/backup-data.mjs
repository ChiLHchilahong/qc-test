import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

function timestampForFolder() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

function runGit(command) {
  try {
    return execSync(command, { cwd: projectRoot, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

async function copyIfExists(sourcePath, targetPath) {
  try {
    await fs.access(sourcePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const timestamp = timestampForFolder();
  const backupRoot = path.join(projectRoot, 'backups');
  const backupDir = path.join(backupRoot, timestamp);

  const sourceDataDir = path.join(projectRoot, 'data');
  await fs.access(sourceDataDir);

  await fs.mkdir(backupDir, { recursive: true });
  await fs.cp(sourceDataDir, path.join(backupDir, 'data'), { recursive: true });

  const envCopied = await copyIfExists(
    path.join(projectRoot, '.env'),
    path.join(backupDir, 'env', '.env')
  );
  const envExampleCopied = await copyIfExists(
    path.join(projectRoot, '.env.example'),
    path.join(backupDir, 'env', '.env.example')
  );

  const metadata = {
    createdAt: new Date().toISOString(),
    backupFolder: path.relative(projectRoot, backupDir),
    sourceDataFolder: 'data',
    copied: {
      data: true,
      env: envCopied,
      envExample: envExampleCopied,
    },
    git: {
      branch: runGit('git rev-parse --abbrev-ref HEAD'),
      commit: runGit('git rev-parse HEAD'),
      statusShort: runGit('git status --short'),
    },
  };

  await fs.writeFile(
    path.join(backupDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf8'
  );

  const summary = [
    `Backup created: ${path.relative(projectRoot, backupDir)}`,
    'Included:',
    '- data/ (full folder)',
    `- .env (${envCopied ? 'copied' : 'not found'})`,
    `- .env.example (${envExampleCopied ? 'copied' : 'not found'})`,
    '',
    'Restore quick steps:',
    `1) Stop app`,
    `2) Copy ${path.join(path.relative(projectRoot, backupDir), 'data')} -> data`,
    `3) Start app again`,
  ].join('\n');

  await fs.writeFile(path.join(backupDir, 'BACKUP_INFO.txt'), summary, 'utf8');

  console.log(summary);
}

main().catch((error) => {
  console.error('Backup failed:', error.message);
  process.exit(1);
});
