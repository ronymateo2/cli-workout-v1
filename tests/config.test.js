import { jest } from '@jest/globals';
import db, { resetDb } from '../src/db.js';
import { getProfile } from '../src/config.js';

describe('config module tests', () => {
  afterAll(() => {
    resetDb();
  });

  beforeEach(() => {
    resetDb();
  });

  test('getProfile should throw error if no profiles exist', () => {
    expect(() => getProfile()).toThrow(/No profiles exist/);
  });

  test('getProfile should return the only profile if no name provided', () => {
    db.prepare('INSERT INTO profiles (name) VALUES (?)').run('mike');
    const profile = getProfile();
    expect(profile.name).toBe('mike');
  });

  test('getProfile should throw error if multiple profiles exist and no name provided', () => {
    db.prepare('INSERT INTO profiles (name) VALUES (?)').run('mike');
    db.prepare('INSERT INTO profiles (name) VALUES (?)').run('sarah');
    expect(() => getProfile()).toThrow(/Multiple profiles exist/);
  });

  test('getProfile should return profile by name', () => {
    db.prepare('INSERT INTO profiles (name) VALUES (?)').run('mike');
    db.prepare('INSERT INTO profiles (name) VALUES (?)').run('sarah');
    const profile = getProfile('sarah');
    expect(profile.name).toBe('sarah');
  });

  test('getProfile should throw error if named profile not found', () => {
    db.prepare('INSERT INTO profiles (name) VALUES (?)').run('mike');
    expect(() => getProfile('nonexistent')).toThrow(/Profile 'nonexistent' not found/);
  });
});
