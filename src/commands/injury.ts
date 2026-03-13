import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import db from '../db.js';
import { getProfile } from '../config.js';

export const injuryCmd = new Command('injury').description('Track and manage injuries per profile');

injuryCmd
  .command('add <body_region>')
  .description('Log a new injury (e.g., workout injury add "left knee")')
  .option('-s, --severity <level>', 'Severity: mild, moderate, severe', 'mild')
  .option('-d, --description <text>', 'Describe the injury')
  .option('-e, --exercises <list>', 'Comma-separated list of affected exercises')
  .option('-n, --notes <text>', 'Additional notes (rehab plan, etc.)')
  .action((bodyRegion, options) => {
    const isJson = injuryCmd.parent.opts().json;
    try {
      const profile = getProfile(injuryCmd.parent.opts().profile);

      const severity = options.severity.toLowerCase();
      if (!['mild', 'moderate', 'severe'].includes(severity)) {
        throw new Error("Severity must be 'mild', 'moderate', or 'severe'.");
      }

      const info = db.prepare(`
        INSERT INTO injuries (profile_id, body_region, severity, description, affected_exercises, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        profile.id,
        bodyRegion.toLowerCase(),
        severity,
        options.description || null,
        options.exercises ? options.exercises.toLowerCase() : null,
        options.notes || null
      );

      const res = { success: true, id: info.lastInsertRowid, bodyRegion, severity };
      if (isJson) {
        console.log(JSON.stringify(res, null, 2));
      } else {
        const severityColors = { mild: chalk.yellow, moderate: chalk.hex('#FF8800'), severe: chalk.red };
        const colorFn = severityColors[severity] || chalk.yellow;
        console.log(chalk.green(`✓ Injury logged: ${colorFn(bodyRegion)} (${severity})`));
        if (options.exercises) {
          console.log(chalk.dim(`  Affected exercises: ${options.exercises}`));
        }
      }
    } catch (err) {
      if (isJson) console.log(JSON.stringify({ error: err.message }));
      else console.error(chalk.red(`✗ ${err.message}`));
    }
  });

injuryCmd
  .command('list')
  .description('List all injuries for the current profile')
  .option('-a, --all', 'Include recovered injuries')
  .action((options) => {
    const isJson = injuryCmd.parent.opts().json;
    try {
      const profile = getProfile(injuryCmd.parent.opts().profile);

      let query = 'SELECT * FROM injuries WHERE profile_id = ?';
      if (!options.all) query += " AND status = 'active'";
      query += ' ORDER BY start_date DESC';

      const injuries = db.prepare(query).all(profile.id) as any[];

      if (isJson) {
        console.log(JSON.stringify(injuries, null, 2));
        return;
      }

      if (injuries.length === 0) {
        console.log(chalk.green('No active injuries. Keep it up! 💪'));
        return;
      }

      console.log(chalk.cyan.bold(`\nInjuries for ${profile.name}:`));
      const table = new Table({
        head: ['ID', 'Region', 'Severity', 'Status', 'Affected Exercises', 'Since', 'Notes'],
        style: { head: ['cyan'] },
        colWidths: [5, 15, 10, 10, 22, 12, 20]
      });

      const severityColors = { mild: chalk.yellow, moderate: chalk.hex('#FF8800'), severe: chalk.red };

      injuries.forEach(i => {
        const colorFn = severityColors[i.severity] || chalk.white;
        const statusIcon = i.status === 'active' ? chalk.red('🔴 active') : chalk.green('🟢 recovered');
        table.push([
          i.id,
          colorFn(i.body_region),
          colorFn(i.severity),
          statusIcon,
          i.affected_exercises || '-',
          i.start_date ? i.start_date.split(' ')[0] : '-',
          i.notes || '-',
        ]);
      });
      console.log(table.toString());
    } catch (err) {
      if (isJson) console.log(JSON.stringify({ error: err.message }));
      else console.error(chalk.red(`✗ ${err.message}`));
    }
  });

injuryCmd
  .command('recover <id>')
  .description('Mark an injury as recovered')
  .action((idStr) => {
    const isJson = injuryCmd.parent.opts().json;
    try {
      const profile = getProfile(injuryCmd.parent.opts().profile);
      const id = parseInt(idStr, 10);

      const injury = db.prepare('SELECT * FROM injuries WHERE id = ? AND profile_id = ?').get(id, profile.id) as any;
      if (!injury) throw new Error(`Injury #${id} not found for this profile.`);
      if (injury.status === 'recovered') throw new Error(`Injury #${id} is already marked as recovered.`);

      db.prepare("UPDATE injuries SET status = 'recovered', recovery_date = CURRENT_TIMESTAMP WHERE id = ?").run(id);

      if (isJson) {
        console.log(JSON.stringify({ success: true, id, status: 'recovered' }));
      } else {
        console.log(chalk.green(`✓ Injury '${injury.body_region}' marked as recovered! 🎉`));
      }
    } catch (err) {
      if (isJson) console.log(JSON.stringify({ error: err.message }));
      else console.error(chalk.red(`✗ ${err.message}`));
    }
  });

injuryCmd
  .command('update <id>')
  .description('Update an existing injury')
  .option('-s, --severity <level>', 'Update severity')
  .option('-n, --notes <text>', 'Update notes')
  .option('-e, --exercises <list>', 'Update affected exercises')
  .action((idStr, options) => {
    const isJson = injuryCmd.parent.opts().json;
    try {
      const profile = getProfile(injuryCmd.parent.opts().profile);
      const id = parseInt(idStr, 10);

      const injury = db.prepare('SELECT * FROM injuries WHERE id = ? AND profile_id = ?').get(id, profile.id) as any;
      if (!injury) throw new Error(`Injury #${id} not found for this profile.`);

      if (options.severity) {
        const sev = options.severity.toLowerCase();
        if (!['mild', 'moderate', 'severe'].includes(sev)) throw new Error("Severity must be 'mild', 'moderate', or 'severe'.");
        db.prepare('UPDATE injuries SET severity = ? WHERE id = ?').run(sev, id);
      }
      if (options.notes) {
        db.prepare('UPDATE injuries SET notes = ? WHERE id = ?').run(options.notes, id);
      }
      if (options.exercises) {
        db.prepare('UPDATE injuries SET affected_exercises = ? WHERE id = ?').run(options.exercises.toLowerCase(), id);
      }

      if (isJson) console.log(JSON.stringify({ success: true, id }));
      else console.log(chalk.green(`✓ Injury #${id} updated.`));
    } catch (err) {
      if (isJson) console.log(JSON.stringify({ error: err.message }));
      else console.error(chalk.red(`✗ ${err.message}`));
    }
  });
