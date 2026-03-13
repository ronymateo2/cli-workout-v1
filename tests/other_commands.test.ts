import { jest } from '@jest/globals';
import { Command } from 'commander';
import db, { resetDb } from '../src/db.js';
import { templatesCmd } from '../src/commands/templates.js';
import { registerStatsCommands } from '../src/commands/stats.js';

describe('templates and stats commands tests', () => {
  let program;
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    resetDb();
    program = new Command();
    program.option('-j, --json', 'output json');
    program.option('-p, --profile <name>', 'profile');
    program.addCommand(templatesCmd);
    registerStatsCommands(program);

    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    db.prepare('INSERT INTO profiles (name) VALUES (?)').run('mike');
    db.prepare('INSERT INTO exercises (name, muscles, type, equipment) VALUES (?, ?, ?, ?)').run('Bench Press', 'chest', 'compound', 'barbell');
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('templates', () => {
    test('create template should work', async () => {
      await program.parseAsync(['node', 'workout', '--profile', 'mike', '--json', 'templates', 'create', 'Push', '--exercises', 'Bench Press:4x8']);
      
      const template = db.prepare("SELECT * FROM templates WHERE name = 'Push'").get() as any;
      expect(template).toBeDefined();
      
      const te = db.prepare('SELECT * FROM template_exercises WHERE template_id = ?').get(template.id) as any;
      expect(te.sets_config).toBe('4x8');
    });

    test('list templates should output json', async () => {
      db.prepare('INSERT INTO templates (profile_id, name) VALUES (?, ?)').run(1, 'Push');
      
      await program.parseAsync(['node', 'workout', '--profile', 'mike', '--json', 'templates', 'list']);
      expect(logSpy).toHaveBeenCalled();
      const output = JSON.parse(logSpy.mock.calls[0][0]);
      expect(output[0].name).toBe('Push');
    });
  });

  describe('stats', () => {
    test('pr command should return max weight', async () => {
      db.prepare("INSERT INTO workouts (profile_id, status) VALUES (1, 'completed')").run();
      db.prepare('INSERT INTO workout_sets (workout_id, exercise_id, weight, reps, set_number) VALUES (1, 1, 100, 10, 1)').run();
      db.prepare('INSERT INTO workout_sets (workout_id, exercise_id, weight, reps, set_number) VALUES (1, 1, 110, 5, 2)').run();

      await program.parseAsync(['node', 'workout', '--profile', 'mike', '--json', 'pr']);
      expect(logSpy).toHaveBeenCalled();
      const output = JSON.parse(logSpy.mock.calls[0][0]);
      expect(output[0].pr_weight).toBe(110);
    });

    test('last command should return latest workout', async () => {
      db.prepare("INSERT INTO workouts (profile_id, status, end_time) VALUES (1, 'completed', '2024-01-01 10:00:00')").run();
      
      await program.parseAsync(['node', 'workout', '--profile', 'mike', '--json', 'last']);
      expect(logSpy).toHaveBeenCalled();
      const output = JSON.parse(logSpy.mock.calls[0][0]);
      expect(output.workout).toBeDefined();
    });
  });
});
