import db from './db.js';
export function getActiveWorkout(profileId) {
    return db.prepare(`
    SELECT * FROM workouts 
    WHERE profile_id = ? AND status = 'active'
    ORDER BY start_time DESC LIMIT 1
  `).get(profileId);
}
export function startWorkout(profileId, templateId = null) {
    const existing = getActiveWorkout(profileId);
    if (existing) {
        throw new Error('You already have an active workout. Use `workout done` or `workout cancel` to finish it.');
    }
    const info = db.prepare('INSERT INTO workouts (profile_id, template_id) VALUES (?, ?)').run(profileId, templateId);
    return info.lastInsertRowid;
}
export function endWorkout(workoutId, status = 'completed') {
    db.prepare("UPDATE workouts SET end_time = CURRENT_TIMESTAMP, status = ? WHERE id = ?").run(status, workoutId);
}
export function getExerciseByName(name) {
    const exercise = db.prepare('SELECT * FROM exercises WHERE name = ? COLLATE NOCASE').get(name);
    if (!exercise) {
        throw new Error(`Exercise '${name}' not found in the library. Add it first using \`workout exercises add \"${name}\" --muscles ...\``);
    }
    return exercise;
}
export function logSets(workoutId, exerciseId, sets) {
    // sets is an array of {weight, reps, rir, notes}
    const maxSetRow = db.prepare('SELECT MAX(set_number) as max_set FROM workout_sets WHERE workout_id = ? AND exercise_id = ?').get(workoutId, exerciseId);
    let startingSet = (maxSetRow.max_set || 0) + 1;
    const insertSet = db.prepare('INSERT INTO workout_sets (workout_id, exercise_id, weight, reps, rir, set_number, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertMany = db.transaction((setsToLog) => {
        for (const s of setsToLog) {
            insertSet.run(workoutId, exerciseId, s.weight, s.reps, s.rir || null, startingSet++, s.notes || null);
        }
    });
    insertMany(sets);
}
