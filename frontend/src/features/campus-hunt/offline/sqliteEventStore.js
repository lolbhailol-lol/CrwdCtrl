/**
 * Encrypted SQLite for Offline Event Mode on Capacitor Android.
 * SQLCipher is the source of truth while the event is loaded.
 * Browser / web fallback stays on IndexedDB (see offlineDb.js).
 */

import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { OFFLINE_SQLITE_DB, OFFLINE_SQLITE_VERSION } from './constants';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS kv (
  store TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (store, key)
);
CREATE TABLE IF NOT EXISTS play_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_code TEXT,
  action TEXT NOT NULL,
  payload TEXT,
  created_at INTEGER NOT NULL
);
`;

let connection = null;
let db = null;
let encrypted = false;

function randomPassphrase() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isSqliteAvailable() {
  return Capacitor.isNativePlatform();
}

export function isSqliteEncrypted() {
  return encrypted;
}

async function ensureEncryptionSecret(sqlite) {
  try {
    const inConfig = await sqlite.isInConfigEncryption();
    if (!inConfig?.result) return false;
    const stored = await sqlite.isSecretStored();
    if (!stored?.result) {
      await sqlite.setEncryptionSecret(randomPassphrase());
    }
    return true;
  } catch {
    return false;
  }
}

export async function openOfflineSqlite() {
  if (db) return db;
  if (!isSqliteAvailable()) {
    throw new Error('SQLite is only available in the CrwdCtrl Android app');
  }

  const sqlite = new SQLiteConnection(CapacitorSQLite);
  connection = sqlite;

  try {
    await sqlite.checkConnectionsConsistency();
  } catch {
    /* native side may have no connections yet */
  }

  encrypted = await ensureEncryptionSecret(sqlite);
  const mode = encrypted ? 'secret' : 'no-encryption';

  const isConn = (await sqlite.isConnection(OFFLINE_SQLITE_DB, false))?.result;
  if (isConn) {
    db = await sqlite.retrieveConnection(OFFLINE_SQLITE_DB, false);
  } else {
    db = await sqlite.createConnection(
      OFFLINE_SQLITE_DB,
      encrypted,
      mode,
      OFFLINE_SQLITE_VERSION,
      false,
    );
  }

  await db.open();
  await db.execute(SCHEMA);
  return db;
}

export async function sqliteGet(store, key) {
  const conn = await openOfflineSqlite();
  const res = await conn.query(
    'SELECT value FROM kv WHERE store = ? AND key = ? LIMIT 1',
    [store, key],
  );
  const row = res?.values?.[0];
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

export async function sqliteSet(store, key, value) {
  const conn = await openOfflineSqlite();
  await conn.run(
    'INSERT OR REPLACE INTO kv (store, key, value, updated_at) VALUES (?, ?, ?, ?)',
    [store, key, JSON.stringify(value), Date.now()],
  );
  return value;
}

export async function sqliteDelete(store, key) {
  const conn = await openOfflineSqlite();
  await conn.run('DELETE FROM kv WHERE store = ? AND key = ?', [store, key]);
  return true;
}

export async function sqliteAppendPlayLog({ teamCode, action, payload }) {
  const conn = await openOfflineSqlite();
  await conn.run(
    'INSERT INTO play_log (team_code, action, payload, created_at) VALUES (?, ?, ?, ?)',
    [teamCode || '', action, payload ? JSON.stringify(payload) : null, Date.now()],
  );
}

export async function sqliteStorageInfo() {
  try {
    await openOfflineSqlite();
    return {
      backend: 'sqlite',
      encrypted,
      native: true,
    };
  } catch {
    return { backend: 'unavailable', encrypted: false, native: true };
  }
}
