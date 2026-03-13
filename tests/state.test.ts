import { jest } from '@jest/globals';
import db, { resetDb } from '../src/db.js';
import { getActiveWorkout, startWorkout, endWorkout, logSets, getExerciseByName } from '../src/state.js';

describe('state module tests', () => {
  let profileId;
  let exDbRdlId;

  beforeAll(() => {
    // Setup initial necessary data in db
    const pInfo = db.prepare('INSERT INTO profiles (name) VALUES (?)').run('testuser');
    profileId = pInfo.lastInsertRowid;

    const eInfo = db.prepare('INSERT INTO exercises (name, muscles, type, equipment) VALUES (?, ?, ?, ?)').run('Dumbbell RDL', 'hamstrings,glutes', 'compound', 'dumbbell');
    exDbRdlId = eInfo.lastInsertRowid;
  });

  afterAll(() => {
    resetDb();
  });

  beforeEach(() => {
    // Clear out workouts and sets before each test (but keep profile and exercises)
    db.prepare('DELETE FROM workout_sets').run();
    db.prepare('DELETE FROM workouts').run();
  });

  test('getActiveWorkout should return null when no workout is active', () => {
    expect(getActiveWorkout(profileId)).toBeUndefined();
  });

  test('startWorkout should create a new active workout', () => {
    const workoutId = startWorkout(profileId);
    expect(workoutId).toBeGreaterThan(0);

    const active = getActiveWorkout(profileId);
    expect(active).toBeDefined();
    expect(active.id).toBe(workoutId);
    expect(active.status).toBe('active');
  });

  test('startWorkout should throw an error if one already started', () => {
    startWorkout(profileId);
    expect(() => startWorkout(profileId)).toThrow(/already have an active workout/i);
  });

  test('endWorkout should mark workout as completed', () => {
    const workoutId = startWorkout(profileId);
    endWorkout(workoutId, 'completed');

    expect(getActiveWorkout(profileId)).toBeUndefined();
    
    // verify in db directly
    const w = db.prepare('SELECT status FROM workouts WHERE id = ?').get(workoutId) as any;
    expect(w.status).toBe('completed');
  });

  test('getExerciseByName should fetch the correct exercise', () => {
    const ex = getExerciseByName('Dumbbell RDL');
    expect(ex).toBeDefined();
    expect(ex.id).toBe(exDbRdlId);
    
    expect(() => getExerciseByName('Nonexistent')).toThrow(/not found in the library/i);
  });

  test('logSets should insert sets matching the active workout', () => {
    const workoutId = startWorkout(profileId);
    
    const sets = [
      { weight: 50, reps: 10 },
      { weight: 55, reps: 8 },
    ];
    
    logSets(workoutId, exDbRdlId, sets);

    const logged = db.prepare('SELECT * FROM workout_sets WHERE workout_id = ? ORDER BY set_number ASC').all(workoutId) as any[];
    expect(logged.length).toBe(2);
    expect(logged[0].weight).toBe(50);
    expect(logged[0].reps).toBe(10);
    expect(logged[0].set_number).toBe(1);

    expect(logged[1].weight).toBe(55);
    expect(logged[1].reps).toBe(8);
    expect(logged[1].set_number).toBe(2);
  });
});
