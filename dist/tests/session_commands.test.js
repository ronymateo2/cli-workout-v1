import { jest } from '@jest/globals';
import { Command } from 'commander';
import db, { resetDb } from '../src/db.js';
import { registerSessionCommands } from '../src/commands/session.js';
describe('session commands tests', () => {
    let program;
    let logSpy;
    let errorSpy;
    let exitSpy;
    beforeEach(() => {
        resetDb();
        program = new Command();
        program.option('-j, --json', 'output json');
        program.option('-p, --profile <name>', 'profile');
        registerSessionCommands(program);
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`process.exit called with ${code}`);
        });
        // Setup a default profile and exercise
        db.prepare('INSERT INTO profiles (name) VALUES (?)').run('mike');
        db.prepare('INSERT INTO exercises (name, muscles, type, equipment) VALUES (?, ?, ?, ?)').run('Bench Press', 'chest', 'compound', 'barbell');
    });
    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
        exitSpy.mockRestore();
    });
    test('start command should create a workout', async () => {
        await program.parseAsync(['node', 'workout', '--profile', 'mike', '--json', 'start', '--empty']);
        const workout = db.prepare("SELECT * FROM workouts WHERE profile_id = (SELECT id FROM profiles WHERE name = 'mike')").get();
        expect(workout).toBeDefined();
        expect(workout.status).toBe('active');
    });
    test('log command should add sets', async () => {
        db.prepare("INSERT INTO workouts (profile_id, status) VALUES (1, 'active')").run();
        await program.parseAsync(['node', 'workout', '--profile', 'mike', '--json', 'log', 'Bench Press', '100', '10,10']);
        const sets = db.prepare('SELECT * FROM workout_sets').all();
        expect(sets.length).toBe(2);
        expect(sets[0].weight).toBe(100);
    });
    test('done command should complete workout', async () => {
        db.prepare("INSERT INTO workouts (profile_id, status) VALUES (1, 'active')").run();
        await program.parseAsync(['node', 'workout', '--profile', 'mike', '--json', 'done']);
        const workout = db.prepare('SELECT status FROM workouts').get();
        expect(workout.status).toBe('completed');
    });
    test('undo command should remove last set', async () => {
        db.prepare("INSERT INTO workouts (profile_id, status) VALUES (1, 'active')").run();
        db.prepare('INSERT INTO workout_sets (workout_id, exercise_id, weight, reps, set_number) VALUES (1, 1, 100, 10, 1)').run();
        await program.parseAsync(['node', 'workout', '--profile', 'mike', '--json', 'undo']);
        const count = db.prepare('SELECT COUNT(*) as count FROM workout_sets').get().count;
        expect(count).toBe(0);
    });
});
