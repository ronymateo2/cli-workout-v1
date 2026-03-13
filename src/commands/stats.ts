import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import db from '../db.js';
import { getProfile } from '../config.js';
import { analyzeProgression, generateRecommendation } from '../analyzer.js';

export function registerStatsCommands(program) {

  program
    .command('last')
    .description('View the last completed workout')
    .action(() => {
      const isJson = program.opts().json;
      try {
        const profile = getProfile(program.opts().profile);
        const lastWorkout = db.prepare(`
          SELECT * FROM workouts 
          WHERE profile_id = ? AND status = 'completed' 
          ORDER BY end_time DESC LIMIT 1
        `).get(profile.id) as any;

        if (!lastWorkout) {
          console.log(chalk.yellow(`No completed workouts found for ${profile.name}.`));
          return;
        }

        const sets = db.prepare(`
          SELECT e.name, ws.set_number, ws.weight, ws.reps, ws.rir, ws.notes
          FROM workout_sets ws
          JOIN exercises e ON ws.exercise_id = e.id
          WHERE ws.workout_id = ?
          ORDER BY ws.id ASC
        `).all(lastWorkout.id) as any[];

        if (isJson) {
           console.log(JSON.stringify({ workout: lastWorkout, sets }, null, 2));
           return;
        }

        console.log(chalk.cyan.bold(`\nLast Workout for ${profile.name} (Started: ${lastWorkout.start_time})`));
        if (lastWorkout.notes) console.log(chalk.dim(`Notes: ${lastWorkout.notes}`));
        
        const table = new Table({ head: ['Exercise', 'Set', 'Weight', 'Reps', 'Notes'], style: { head: ['cyan'] }});
        sets.forEach(s => table.push([s.name, s.set_number, s.weight || '-', s.reps, s.notes || '']));
        console.log(table.toString());

      } catch(err) {
        if (isJson) console.log(JSON.stringify({ error: err.message }));
        else console.error(chalk.red(`✗ ${err.message}`));
      }
    });

  program
    .command('history <exercise>')
    .description('View history for an exercise')
    .action((exerciseName) => {
      const isJson = program.opts().json;
      try {
        const profile = getProfile(program.opts().profile);
        const exercise = db.prepare('SELECT id FROM exercises WHERE name = ? COLLATE NOCASE').get(exerciseName) as any;
        if (!exercise) throw new Error(`Exercise '${exerciseName}' not found.`);

        const history = db.prepare(`
          SELECT w.start_time as date, ws.weight, ws.reps, ws.set_number
          FROM workout_sets ws
          JOIN workouts w ON ws.workout_id = w.id
          WHERE w.profile_id = ? AND ws.exercise_id = ? AND w.status = 'completed'
          ORDER BY w.start_time DESC, ws.set_number ASC
          LIMIT 50
        `).all(profile.id, exercise.id) as any[];

        if (isJson) {
          console.log(JSON.stringify({ history }, null, 2));
          return;
        }

        if (history.length === 0) {
          console.log(chalk.yellow(`No history found for ${exerciseName}.`));
          return;
        }

        const table = new Table({ head: ['Date', 'Set', 'Weight', 'Reps'], style: { head: ['cyan'] }});
        history.forEach(h => table.push([h.date.split(' ')[0], h.set_number, h.weight || '-', h.reps]));
        console.log(table.toString());
      } catch(err) {
        if (isJson) console.log(JSON.stringify({ error: err.message }));
        else console.error(chalk.red(`✗ ${err.message}`));
      }
    });

  program
    .command('pr [exercise]')
    .description('View Personal Records')
    .action((exerciseName) => {
      const isJson = program.opts().json;
      try {
        const profile = getProfile(program.opts().profile);
        
        let query = `
          SELECT e.name, MAX(ws.weight) as pr_weight
          FROM workout_sets ws
          JOIN workouts w ON ws.workout_id = w.id
          JOIN exercises e ON ws.exercise_id = e.id
          WHERE w.profile_id = ? AND w.status = 'completed' AND ws.weight IS NOT NULL
        `;
        let params = [profile.id];

        if (exerciseName) {
           const exercise = db.prepare('SELECT id FROM exercises WHERE name = ? COLLATE NOCASE').get(exerciseName) as any;
           if (!exercise) throw new Error(`Exercise '${exerciseName}' not found.`);
           query += ` AND ws.exercise_id = ? GROUP BY e.id`;
           params.push(exercise.id);
        } else {
           query += ` GROUP BY e.id ORDER BY e.name ASC`;
        }

        const prs = db.prepare(query).all(...params) as any[];

        if (isJson) {
          console.log(JSON.stringify(prs, null, 2));
          return;
        }

        if (prs.length === 0) {
          console.log(chalk.yellow('No PRs found. Log some sets with weights!'));
          return;
        }

        const table = new Table({ head: ['Exercise', 'PR Weight'], style: { head: ['cyan'] }});
        prs.forEach(p => table.push([p.name, `${p.pr_weight}kg`]));
        console.log(table.toString());
      } catch(err) {
         if (isJson) console.log(JSON.stringify({ error: err.message }));
         else console.error(chalk.red(`✗ ${err.message}`));
      }
    });

  program
    .command('volume')
    .option('--week', 'Weekly volume')
    .description('View volume stats')
    .action((options) => {
      // Basic mockup for weekly volume
      console.log(chalk.cyan('Weekly volume tracking is under construction.'));
    });

  program
    .command('progression <exercise>')
    .description('View progression over time for an exercise')
    .action((exerciseName) => {
      const isJson = program.opts().json;
      try {
        const profile = getProfile(program.opts().profile);
        const exercise = db.prepare('SELECT id, name, muscles FROM exercises WHERE name = ? COLLATE NOCASE').get(exerciseName) as any;
        if (!exercise) throw new Error(`Exercise '${exerciseName}' not found.`);

        // ── Check for active injuries that affect this exercise ──
        const activeInjuries = db.prepare(`
          SELECT * FROM injuries 
          WHERE profile_id = ? AND status = 'active'
        `).all(profile.id) as any[];

        const relevantInjuries = activeInjuries.filter(inj => {
          if (inj.affected_exercises) {
            const affected = inj.affected_exercises.split(',').map(e => e.trim().toLowerCase());
            if (affected.some(a => exercise.name.toLowerCase().includes(a) || a.includes(exercise.name.toLowerCase()))) return true;
          }
          if (inj.body_region && exercise.muscles) {
            const muscles = exercise.muscles.toLowerCase().split(',').map(m => m.trim());
            if (muscles.some(m => inj.body_region.toLowerCase().includes(m) || m.includes(inj.body_region.toLowerCase()))) return true;
          }
          return false;
        });

        // Fetch all chronological sets
        const historySets = db.prepare(`
          SELECT DATE(w.start_time) as date, ws.weight, ws.reps, ws.set_number
          FROM workout_sets ws
          JOIN workouts w ON ws.workout_id = w.id
          WHERE w.profile_id = ? AND ws.exercise_id = ? AND w.status = 'completed' AND ws.weight IS NOT NULL
          ORDER BY w.start_time ASC, ws.set_number ASC
        `).all(profile.id, exercise.id) as any[];

        if (historySets.length === 0) {
          if (isJson) console.log(JSON.stringify({ error: `Not enough data for ${exercise.name}` }));
          else console.log(chalk.yellow(`No completed volume data found for ${exercise.name} yet. Go log some sets!`));
          return;
        }

        // Run scientific analysis
        const analyzed = analyzeProgression(historySets);
        let recommendation = generateRecommendation(analyzed);

        // Override recommendation if injury is active
        if (relevantInjuries.length > 0) {
          const injuryNames = relevantInjuries.map(i => `${i.body_region} (${i.severity})`).join(', ');
          recommendation = `🚨 ACTIVE INJURY WARNING: You have ${relevantInjuries.length} active injury(s) affecting this exercise: ${injuryNames}. ` +
            `Do NOT follow standard progressive overload. ` +
            (relevantInjuries.some(i => i.severity === 'severe')
              ? `STOP this exercise until cleared by a medical professional.`
              : relevantInjuries.some(i => i.severity === 'moderate')
                ? `Reduce weight by 30-50%, limit range of motion, and prioritize pain-free movement. Consider substituting with a safer alternative.`
                : `Proceed with caution. Reduce weight by 10-20%, focus on controlled tempo, and stop immediately if you feel any pain.`);
        }

        if (isJson) {
           console.log(JSON.stringify({ 
             exercise: exercise.name, 
             progression: analyzed, 
             recommendation,
             activeInjuries: relevantInjuries
           }, null, 2));
           return;
        }

        console.log(chalk.cyan.bold(`\nScientific Progression Tracker: ${exercise.name}`));

        // Show injury warning banner
        if (relevantInjuries.length > 0) {
          console.log(chalk.bgRed.white.bold('\n ⚠️  ACTIVE INJURY DETECTED '));
          relevantInjuries.forEach(inj => {
            const sevColor = inj.severity === 'severe' ? chalk.red : inj.severity === 'moderate' ? chalk.hex('#FF8800') : chalk.yellow;
            console.log(sevColor(`  • ${inj.body_region} — ${inj.severity}${inj.description ? ': ' + inj.description : ''}`));
          });
          console.log('');
        }

        const table = new Table({ head: ['Date', 'Max e1RM', 'Total Volume (kg)'], style: { head: ['cyan'] }});
        analyzed.forEach(a => table.push([
           a.date, 
           `${a.maxE1rm.toFixed(1)}kg`, 
           `${a.volumeLoad.toFixed(1)}kg`
        ]));
        
        console.log(table.toString());
        
        console.log(chalk.bold('\n💡 AI Recommendation:'));
        console.log(chalk.dim(recommendation) + '\n');
        
      } catch(err) {
        if (isJson) console.log(JSON.stringify({ error: err.message }));
        else console.error(chalk.red(`✗ ${err.message}`));
      }
    });
}
