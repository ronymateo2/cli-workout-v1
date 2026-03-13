import { Command } from 'commander';
import db from '../db.js';
import Table from 'cli-table3';
import chalk from 'chalk';

export const exercisesCmd = new Command('exercises').description('Manage the exercise library');

exercisesCmd
  .command('list')
  .description('List all available exercises')
  .option('-m, --muscle <name>', 'Filter by muscle group')
  .action((options) => {
    const isJson = exercisesCmd.parent.opts().json;
    
    let query = 'SELECT * FROM exercises';
    let params = [];
    if (options.muscle) {
      query += ' WHERE muscles LIKE ?';
      params.push(`%${options.muscle}%`);
    }
    query += ' ORDER BY name ASC';
    
    const exercises = db.prepare(query).all(...params);

    if (isJson) {
      console.log(JSON.stringify(exercises, null, 2));
      return;
    }

    if (exercises.length === 0) {
      console.log(chalk.yellow('No exercises found.'));
      return;
    }

    const table = new Table({
      head: ['ID', 'Name', 'Muscles', 'Type', 'Equipment'],
      style: { head: ['cyan'] }
    });

    exercises.forEach(e => table.push([e.id, e.name, e.muscles, e.type, e.equipment]));
    console.log(table.toString());
  });

exercisesCmd
  .command('add <name>')
  .description('Add a new exercise to the library')
  .requiredOption('-m, --muscles <muscles>', 'Comma separated list of muscles')
  .requiredOption('-t, --type <type>', 'Type of exercise (e.g. compound, isolation)')
  .requiredOption('-e, --equipment <equipment>', 'Equipment used (e.g. barbell, dumbbell, cable, machine, bodyweight, kettlebell, band, other)')
  .action((name, options) => {
    const isJson = exercisesCmd.parent.opts().json;
    try {
      // Normalize values
      const type = options.type.toLowerCase();
      const equipment = options.equipment.toLowerCase();
      const muscles = options.muscles.toLowerCase();
      
      const stmt = db.prepare('INSERT INTO exercises (name, muscles, type, equipment) VALUES (?, ?, ?, ?)');
      const info = stmt.run(name, muscles, type, equipment);
      
      const res = { success: true, id: info.lastInsertRowid, name, muscles, type, equipment };
      if (isJson) {
        console.log(JSON.stringify(res, null, 2));
      } else {
        console.log(chalk.green(`✓ Exercise '${name}' added successfully.`));
      }
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        const errObj = { error: `Exercise '${name}' already exists.` };
        if (isJson) console.log(JSON.stringify(errObj));
        else console.error(chalk.red(`✗ ${errObj.error}`));
        process.exit(1);
      }
      throw err;
    }
  });
