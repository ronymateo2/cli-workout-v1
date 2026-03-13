import db from './db.js';

export function getProfile(profileName) {
  // If no profile provided, try to find the only one, or fail.
  if (!profileName) {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM profiles').get();
    if (countRow.count === 0) {
      throw new Error("No profiles exist. Create one using `workout profile create <name>`.");
    } else if (countRow.count === 1) {
      return db.prepare('SELECT * FROM profiles LIMIT 1').get();
    } else {
      throw new Error("Multiple profiles exist. Specify which one using `--profile <name>`.");
    }
  }

  const profile = db.prepare('SELECT * FROM profiles WHERE name = ? COLLATE NOCASE').get(profileName);
  if (!profile) {
    throw new Error(`Profile '${profileName}' not found.`);
  }
  return profile;
}
