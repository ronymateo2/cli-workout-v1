import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const isTest = process.env.NODE_ENV === 'test';
const dbPath = isTest ? ':memory:' : path.join(os.homedir(), '.workout-cli.db');

// Ensure database parent directory exists just in case
if (!isTest) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      muscles TEXT NOT NULL,
      type TEXT NOT NULL,
      equipment TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      UNIQUE(profile_id, name)
    );

    CREATE TABLE IF NOT EXISTS template_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      sets_config TEXT NOT NULL, -- e.g., "4x8"
      sort_order INTEGER NOT NULL,
      FOREIGN KEY(template_id) REFERENCES templates(id) ON DELETE CASCADE,
      FOREIGN KEY(exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      template_id INTEGER,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      status TEXT CHECK(status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
      notes TEXT,
      FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY(template_id) REFERENCES templates(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS workout_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      weight REAL,
      reps INTEGER,
      rir INTEGER,
      set_number INTEGER NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
      FOREIGN KEY(exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS injuries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      body_region TEXT NOT NULL,
      severity TEXT CHECK(severity IN ('mild', 'moderate', 'severe')) NOT NULL DEFAULT 'mild',
      description TEXT,
      affected_exercises TEXT,
      start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      recovery_date DATETIME,
      status TEXT CHECK(status IN ('active', 'recovered')) DEFAULT 'active',
      notes TEXT,
      FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
  `);
}

initDb();

export function resetDb() {
  if (process.env.NODE_ENV === 'test') {
    db.exec(`
      DROP TABLE IF EXISTS injuries;
      DROP TABLE IF EXISTS workout_sets;
      DROP TABLE IF EXISTS workouts;
      DROP TABLE IF EXISTS template_exercises;
      DROP TABLE IF EXISTS templates;
      DROP TABLE IF EXISTS exercises;
      DROP TABLE IF EXISTS profiles;
    `);
    initDb();
  }
}

export default db;
