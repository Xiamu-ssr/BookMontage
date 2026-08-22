import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const projectRoot = resolve(import.meta.dirname, '..');
export const dataRoot = resolve(process.env.BOOKMONTAGE_HOME || join(projectRoot, '.bookmontage'));
const isProjectLibrary = dataRoot === join(projectRoot, '.bookmontage');
export const dbPath = join(dataRoot, 'library.sqlite');
export const assetRoot = join(dataRoot, 'assets');
export const cacheRoot = join(dataRoot, 'cache');

export function logicalId(id) { return id.slice(0, -4); }
export function versionOf(id) { return Number(id.slice(-4)); }
export function makeId(prefix = randomUUID().replaceAll('-', '')) { return `${prefix}0001`; }

export function initialize() {
  mkdirSync(assetRoot, { recursive: true });
  mkdirSync(cacheRoot, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS item (
      id TEXT PRIMARY KEY CHECK(length(id) = 36),
      type TEXT NOT NULL,
      parent TEXT REFERENCES item(id),
      data TEXT NOT NULL CHECK(json_valid(data))
    );
    CREATE TABLE IF NOT EXISTS link (
      source TEXT NOT NULL REFERENCES item(id),
      target TEXT NOT NULL REFERENCES item(id),
      kind TEXT NOT NULL,
      PRIMARY KEY(source, target, kind)
    );
    CREATE INDEX IF NOT EXISTS idx_item_parent ON item(parent);
    CREATE INDEX IF NOT EXISTS idx_item_type ON item(type);
    CREATE INDEX IF NOT EXISTS idx_link_target_kind ON link(target, kind);
    PRAGMA optimize;
  `);
  db.close();
  ensurePublicLinks();
  return dbPath;
}

export function openStore() {
  initialize();
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  return db;
}

export function ensurePublicLinks() {
  if (!isProjectLibrary) return;
  const generated = join(projectRoot, 'public', 'generated');
  mkdirSync(generated, { recursive: true });
  const assetsLink = join(projectRoot, 'public', 'book-assets');
  for (const [link, target] of [[assetsLink, assetRoot]]) {
    try { lstatSync(link); continue; } catch { /* missing entry, including a not-yet-created link */ }
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(relative(dirname(link), target), link);
  }
}

export function putItem(db, item) {
  if (!item.id || !/^[0-9a-f]{32}[0-9]{4}$/.test(item.id)) throw new Error(`Invalid id: ${item.id}`);
  const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
  db.prepare('INSERT INTO item (id, type, parent, data) VALUES (?, ?, ?, ?)').run(item.id, item.type, item.parent || null, JSON.stringify(data));
}

export function putLink(db, link) {
  db.prepare('INSERT OR IGNORE INTO link (source, target, kind) VALUES (?, ?, ?)').run(link.source, link.target, link.kind);
}

export function importBundle(file) {
  const bundle = JSON.parse(readFileSync(resolve(file), 'utf8'));
  const db = openStore();
  db.exec('BEGIN IMMEDIATE;');
  try {
    for (const item of bundle.items || []) putItem(db, item);
    for (const link of bundle.links || []) putLink(db, link);
    db.exec('COMMIT;');
  } catch (error) {
    db.exec('ROLLBACK;');
    db.close();
    throw error;
  }
  db.close();
  return exportSnapshot();
}

export function allItems(db) {
  return db.prepare('SELECT id, type, parent, data FROM item ORDER BY rowid').all().map(row => ({ ...row, data: JSON.parse(row.data) }));
}

export function allLinks(db) { return db.prepare('SELECT source, target, kind FROM link ORDER BY rowid').all(); }

export function exportSnapshot() {
  const db = openStore();
  const snapshot = { format: 1, items: allItems(db), links: allLinks(db) };
  db.close();
  const target = join(cacheRoot, 'library.json');
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  writeFileSync(target, serialized);
  ensurePublicLinks();
  if (isProjectLibrary) {
    const publicSnapshot = join(projectRoot, 'public', 'generated', 'library.json');
    try { if (lstatSync(publicSnapshot).isSymbolicLink()) rmSync(publicSnapshot); } catch { /* first export */ }
    writeFileSync(publicSnapshot, serialized);
  }
  return target;
}

export function findItem(db, selector) {
  const exact = db.prepare('SELECT id, type, parent, data FROM item WHERE id = ?').get(selector);
  if (exact) return { ...exact, data: JSON.parse(exact.data) };
  const rows = allItems(db).filter(row => row.data.slug === selector || row.data.path === selector);
  if (rows.length === 1) return rows[0];
  if (rows.length > 1) throw new Error(`Selector is ambiguous: ${selector}`);
  throw new Error(`Item not found: ${selector}`);
}

export function reviseItem(selector, dataFile) {
  const db = openStore();
  const current = findItem(db, selector);
  const prefix = logicalId(current.id);
  const latest = db.prepare('SELECT id FROM item WHERE substr(id, 1, 32) = ? ORDER BY id DESC LIMIT 1').get(prefix);
  const nextVersion = versionOf(latest.id) + 1;
  if (nextVersion > 9999) throw new Error('Version space exhausted');
  const id = `${prefix}${String(nextVersion).padStart(4, '0')}`;
  const patch = JSON.parse(readFileSync(resolve(dataFile), 'utf8'));
  putItem(db, { id, type: current.type, parent: current.parent, data: { ...current.data, ...patch } });
  const outbound = db.prepare('SELECT target,kind FROM link WHERE source=?').all(current.id);
  for (const link of outbound) putLink(db, { source:id, target:link.target, kind:link.kind });
  db.close();
  exportSnapshot();
  return id;
}

export function verifyStore() {
  const db = openStore();
  const items = allItems(db);
  const links = allLinks(db);
  const ids = new Set(items.map(item => item.id));
  const latest = new Map();
  for (const item of items) {
    const prefix = logicalId(item.id);
    if (!latest.has(prefix) || item.id > latest.get(prefix)) latest.set(prefix, item.id);
  }
  const errors = [];
  const warnings = [];
  for (const item of items) {
    if (item.parent && !ids.has(item.parent)) errors.push(`dangling parent: ${item.id} -> ${item.parent}`);
    if (['asset','clip','film'].includes(item.type)) {
      const file = item.data.file ? join(dataRoot, item.data.file) : null;
      if (!file || !existsSync(file)) errors.push(`missing file: ${item.id}`);
    }
  }
  for (const link of links) {
    if (!ids.has(link.source) || !ids.has(link.target)) errors.push(`dangling link: ${link.source} -> ${link.target}`);
    const newer = latest.get(logicalId(link.target));
    if (link.kind === 'depends' && newer && newer !== link.target) warnings.push(`stale dependency: ${link.source} uses ${link.target}; latest is ${newer}`);
  }
  db.close();
  return { errors, warnings, counts: { items: items.length, links: links.length } };
}

export function resetForTests() {
  if (existsSync(dataRoot)) rmSync(dataRoot, { recursive: true, force: true });
}
