import { jest } from '@jest/globals';
import { Command } from 'commander';
import db, { resetDb } from '../src/db.js';
import { injuryCmd } from '../src/commands/injury.js';

describe('injury commands tests', () => {
  let program;
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    resetDb();
    program = new Command();
    program.option('-j, --json', 'output json');
    program.option('-p, --profile <name>', 'profile');
    program.addCommand(injuryCmd);

    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    db.prepare('INSERT INTO profiles (name) VALUES (?)').run('mike');
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('injury add', () => {
    test('should add an injury to the profile', async () => {
      await program.parseAsync(['node', 'workout', '--profile', 'mike', '--json', 'injury', 'add', 'left knee', '-s', 'moderate', '-d', 'MCL sprain', '-e', 'squat,leg press']);
      
      const injury = db.prepare("SELECT * FROM injuries WHERE body_region = 'left knee'").get();
      expect(injury).toBeDefined();
      expect(injury.severity).toBe('moderate');
      expect(injury.description).toBe('MCL sprain');
      expect(injury.affected_exercises).toBe('squat,leg press');
      expect(injury.status).toBe('active');
    });

    test('should default severity to mild', async () => {
      await program.parseAsync(['node', 'workout', '--profile', 'mike', '--json', 'injury', 'add', 'right shoulder']);
      
      const injury = db.prepare("SELECT * FROM injuries WHERE body_region = 'right shoulder'").get();
      expect(injury).toBeDefined();
      expect(injury.severity).toBe('mild');
    });
  });

  describe('injury list', () => {
    test('should list only active injuries by default', async () => {
      db.prepare("INSERT INTO injuries (profile_id, body_region, severity, status) VALUES (1, 'left knee', 'moderate', 'active')").run();
      db.prepare("INSERT INTO injuries (profile_id, body_region, severity, status) VALUES (1, 'right wrist', 'mild', 'recovered')").run();

      await program.parseAsync(['node', 'workout', '--profile', 'mike', '--json', 'injury', 'list']);
      
      expect(logSpy).toHaveBeenCalled();
      const output = JSON.parse(logSpy.mock.calls[0][0]);
      expect(output.length).toBe(1);
      expect(output[0].body_region).toBe('left knee');
    });

    test('should list all injuries with --all flag', async () => {
      db.prepare("INSERT INTO injuries (profile_id, body_region, severity, status) VALUES (1, 'left knee', 'moderate', 'active')").run();
      db.prepare("INSERT INTO injuries (profile_id, body_region, severity, status) VALUES (1, 'right wrist', 'mild', 'recovered')").run();

      await program.parseAsync(['node', 'workout', '--profile', 'mike', '--json', 'injury', 'list', '--all']);
      
      expect(logSpy).toHaveBeenCalled();
      const output = JSON.parse(logSpy.mock.calls[0][0]);
      expect(output.length).toBe(2);
    });
  });

  describe('injury recover', () => {
    test('should mark an injury as recovered', async () => {
      db.prepare("INSERT INTO injuries (profile_id, body_region, severity, status) VALUES (1, 'left knee', 'moderate', 'active')").run();
      const injury = db.prepare('SELECT id FROM injuries LIMIT 1').get();

      await program.parseAsync(['node', 'workout', '--profile', 'mike', '--json', 'injury', 'recover', String(injury.id)]);
      
      const updated = db.prepare('SELECT * FROM injuries WHERE id = ?').get(injury.id);
      expect(updated.status).toBe('recovered');
      expect(updated.recovery_date).toBeDefined();
    });

    test('should error if injury not found', async () => {
      await program.parseAsync(['node', 'workout', '--profile', 'mike', '--json', 'injury', 'recover', '999']);
      
      expect(logSpy).toHaveBeenCalled();
      const output = JSON.parse(logSpy.mock.calls[0][0]);
      expect(output.error).toContain('not found');
    });
  });

  describe('injury update', () => {
    test('should update severity and notes', async () => {
      db.prepare("INSERT INTO injuries (profile_id, body_region, severity, status) VALUES (1, 'left knee', 'mild', 'active')").run();
      const injury = db.prepare('SELECT id FROM injuries LIMIT 1').get();

      await program.parseAsync(['node', 'workout', '--profile', 'mike', '--json', 'injury', 'update', String(injury.id), '-s', 'severe', '-n', 'swelling increased']);
      
      const updated = db.prepare('SELECT * FROM injuries WHERE id = ?').get(injury.id);
      expect(updated.severity).toBe('severe');
      expect(updated.notes).toBe('swelling increased');
    });
  });
});
