import { jest } from '@jest/globals';
import { Command } from 'commander';
import db, { resetDb } from '../src/db.js';
import { exercisesCmd } from '../src/commands/exercises.js';
import { profileCmd } from '../src/commands/profile.js';

describe('commands logic tests', () => {
  let logSpy;
  let errorSpy;
  let exitSpy;
  let program;

  beforeEach(() => {
    resetDb();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    
    program = new Command();
    program.option('-j, --json', 'json');
    program.addCommand(exercisesCmd);
    program.addCommand(profileCmd);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  describe('exercise commands', () => {
    test('add exercise should insert into db', async () => {
      try {
        await program.parseAsync(['node', 'workout', 'exercises', 'add', 'Bench Press', '-m', 'chest', '-t', 'compound', '-e', 'barbell']);
      } catch (e) {
        if (e.message !== 'process.exit called') throw e;
      }
      
      const ex = db.prepare('SELECT * FROM exercises WHERE name = ?').get('Bench Press');
      expect(ex).toBeDefined();
      expect(ex.muscles).toBe('chest');
    });

    test('list exercises should output results', async () => {
      db.prepare('INSERT INTO exercises (name, muscles, type, equipment) VALUES (?, ?, ?, ?)').run('Push Up', 'chest', 'compound', 'bodyweight');
      
      await program.parseAsync(['node', 'workout', '--json', 'exercises', 'list']);
      
      expect(logSpy).toHaveBeenCalled();
      const output = JSON.parse(logSpy.mock.calls[0][0]);
      expect(output[0].name).toBe('Push Up');
    });
  });

  describe('profile commands', () => {
    test('create profile should insert into db', async () => {
      await program.parseAsync(['node', 'workout', 'profile', 'create', 'sarah']);
      
      const profile = db.prepare('SELECT * FROM profiles WHERE name = ?').get('sarah');
      expect(profile).toBeDefined();
    });

    test('delete profile should remove from db', async () => {
      db.prepare('INSERT INTO profiles (name) VALUES (?)').run('old');
      
      await program.parseAsync(['node', 'workout', 'profile', 'delete', 'old']);
      
      const profile = db.prepare('SELECT * FROM profiles WHERE name = ?').get('old');
      expect(profile).toBeUndefined();
    });
  });
});
