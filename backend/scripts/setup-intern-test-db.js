#!/usr/bin/env node
/*
 * Build an isolated games test database (crwdctrl_test) for the intern:
 *  - copies College Games + Campus Hunt setup collections from the live database
 *  - replaces personal data (names, phones, emails, team passwords) with dummy values
 *  - creates a database user limited to crwdctrl_test (where the host allows it)
 * The connection string is written to a private file on this PC, never printed.
 * Run from backend/:  node scripts/setup-intern-test-db.js
 * Set TEST_MONGODB_URI to write into a separate test server instead of the live cluster.
 */
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const TEST_DB = 'crwdctrl_test';
const TEST_USER = 'intern_games';
const OUTPUT_FILE = path.join(process.env.USERPROFILE || 'C:/Users/KARAN', 'crwdctrl-intern-test-db.txt');
const TEST_TEAM_PASSWORD = 'test1234';

const PERSONAL_KEY = /(phone|mobile|whatsapp|email|contact|aadhaar|address|dob|dateOfBirth|rollNo|roll_number|instagram)/i;
const NAME_KEY = /^(name|fullName|captainName|leaderName|participantName|playerName|memberName|userName|displayName)$/i;
const SECRET_KEY = /password|^pin$|^pinHash$|token$|secret|^otp/i;

function anonymize(value, key = '', counter = { n: 0 }, inPeopleArray = false) {
  if (Array.isArray(value)) return value.map((item) => anonymize(item, key, counter, /member|player|participant|team|captain|people/i.test(key) || inPeopleArray));
  if (value && typeof value === 'object' && !(value instanceof Date) && !value._bsontype) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = anonymize(v, k, counter, inPeopleArray);
    return out;
  }
  if (typeof value !== 'string' || !value) return value;
  if (SECRET_KEY.test(key)) return key.toLowerCase().includes('hash') ? bcrypt.hashSync(TEST_TEAM_PASSWORD, 8) : TEST_TEAM_PASSWORD;
  if (/email/i.test(key)) { counter.n += 1; return `tester${counter.n}@example.com`; }
  if (PERSONAL_KEY.test(key)) { counter.n += 1; return /phone|mobile|whatsapp/i.test(key) ? `90000${String(counter.n).padStart(5, '0')}` : 'Test value'; }
  if (NAME_KEY.test(key) && (inPeopleArray || /captain|leader|participant|player|member|user/i.test(key))) { counter.n += 1; return `Test Person ${counter.n}`; }
  return value;
}

function testConnectionString(liveUri, password) {
  const url = new URL(liveUri.replace(/^mongodb(\+srv)?:/, 'https:'));
  url.username = TEST_USER;
  url.password = encodeURIComponent(password);
  url.pathname = `/${TEST_DB}`;
  const scheme = liveUri.startsWith('mongodb+srv:') ? 'mongodb+srv:' : 'mongodb:';
  return `${scheme}${url.toString().slice('https:'.length)}`;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const live = mongoose.connection.db;
  if (live.databaseName === TEST_DB) throw new Error('Live database name equals the test database name; refusing');
  const targetUri = process.env.TEST_MONGODB_URI?.trim();
  let targetClient = null;
  if (targetUri) {
    const { MongoClient } = require('mongodb');
    targetClient = new MongoClient(targetUri, { serverSelectionTimeoutMS: 15000 });
    await targetClient.connect();
  }
  const test = (targetClient || mongoose.connection.client).db(TEST_DB);

  require('../src/modules/campus-hunt/models').registerModels();
  require('../src/modules/college-platform/models');
  const wanted = [
    'CampusHuntEvent', 'CampusHuntRound', 'CampusHuntRoute', 'CampusHuntStartingPoint', 'CampusHuntChallenge',
    'CampusHuntCheckpoint', 'CampusHuntFinaleMissionConfig', 'CampusHuntTeam',
    'College', 'CollegeGame', 'GameRegistration', 'GameResult', 'GamePreRegistration', 'HostGameRequest',
  ];
  const summary = [];
  for (const modelName of wanted) {
    const Model = mongoose.models[modelName];
    if (!Model) { summary.push(`${modelName}: model not found, skipped`); continue; }
    const name = Model.collection.collectionName;
    const docs = await live.collection(name).find({}).toArray();
    const counter = { n: 0 };
    const cleaned = docs.map((doc) => anonymize(doc, '', counter));
    await test.collection(name).deleteMany({});
    if (cleaned.length) await test.collection(name).insertMany(cleaned, { ordered: false });
    summary.push(`${name}: ${cleaned.length} copied`);
  }
  console.log(summary.join('\n'));

  const password = crypto.randomBytes(12).toString('base64url');
  try {
    try { await test.command({ dropUser: TEST_USER }); } catch { /* user may not exist yet */ }
    await test.command({ createUser: TEST_USER, pwd: password, roles: [{ role: 'readWrite', db: TEST_DB }] });
    fs.writeFileSync(OUTPUT_FILE, `CrwdCtrl intern test database (games only, dummy personal data)\n\nMONGODB_URI=${testConnectionString(targetUri || process.env.MONGODB_URI, password)}\n\nCampus Hunt test team password: ${TEST_TEAM_PASSWORD}\nThis login can only read/write the ${TEST_DB} database. Share privately, then delete this file.\n`);
    console.log(`\nTest database user created. Connection string saved to ${OUTPUT_FILE}`);
  } catch (error) {
    console.log(`\nTest data copied, but this database host does not allow creating users from code (${error.codeName || error.message}).`);
    console.log(`Create user "${TEST_USER}" with readWrite on "${TEST_DB}" in the database dashboard.`);
  } finally {
    await targetClient?.close();
  }
}

main().catch((error) => { console.error(error.message || error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
