import { Command } from 'commander';
import chalk from 'chalk';
import db from '../db.js';
import { getProfile } from '../config.js';
import { getActiveWorkout, startWorkout, endWorkout, getExerciseByName, logSets } from '../state.js';

export function registerSessionCommands(program) {
  
  program
    .command('start [templateName]')
    .option('--empty', 'Start an empty freestyle session')
    .description('Start a new workout session')
    .action((templateName, options) => {
      const opts = program.opts();
      const isJson = opts.json;
      
      try {
        const profile = getProfile(opts.profile);
        let templateId = null;

        if (templateName && !options.empty) {
          const template = db.prepare('SELECT id FROM templates WHERE profile_id = ? AND name = ? COLLATE NOCASE').get(profile.id, templateName);
          if (!template) {
            throw new Error(`Template '${templateName}' not found for profile '${profile.name}'.`);
          }
          templateId = template.id;
        }

        const workoutId = startWorkout(profile.id, templateId);
        
        if (isJson) {
          console.log(JSON.stringify({ success: true, workoutId, profile: profile.name }));
        } else {
          console.log(chalk.green(`✓ Workout started for ${profile.name}!`));
        }
      } catch (err) {
        if (isJson) console.log(JSON.stringify({ error: err.message }));
        else console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  program
    .command('log <exercise> <weight> <reps>')
    .description('Log a set (or multiple sets) for an exercise')
    .action((exerciseName, weightStr, repsStr) => {
      const opts = program.opts();
      const isJson = opts.json;
      
      try {
        const profile = getProfile(opts.profile);
        const workout = getActiveWorkout(profile.id);
        
        if (!workout) {
          throw new Error('No active workout found. Start one with `workout start`.');
        }

        const exercise = getExerciseByName(exerciseName);
        const weight = parseFloat(weightStr);
        if (isNaN(weight)) {
          throw new Error('Weight must be a number.');
        }

        // Parse reps. Either single number "8" or multiple "8,8,7"
        const repsArray = repsStr.split(',').map(r => parseInt(r.trim(), 10));
        if (repsArray.some(isNaN)) {
          throw new Error('Reps must be a number or comma-separated numbers (e.g., 8,8,7).');
        }

        const setsToLog = repsArray.map(r => ({ weight, reps: r }));
        logSets(workout.id, exercise.id, setsToLog);

        if (isJson) {
          console.log(JSON.stringify({ success: true, loggedSets: setsToLog }));
        } else {
          console.log(chalk.green(`✓ Logged ${setsToLog.length} set(s) of ${exercise.name} @ ${weight}kg.`));
        }
      } catch (err) {
        if (isJson) console.log(JSON.stringify({ error: err.message }));
        else console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  program
    .command('note <note_or_exercise> [note]')
    .description('Add a note to the session or a specific exercise')
    .action((noteOrExercise, noteContent) => {
      const opts = program.opts();
      const isJson = opts.json;
      
      try {
        const profile = getProfile(opts.profile);
        const workout = getActiveWorkout(profile.id);
        
        if (!workout) throw new Error('No active workout found.');

        if (!noteContent) {
          // It's a session note
          db.prepare("UPDATE workouts SET notes = COALESCE(notes || '\n', '') || ? WHERE id = ?").run(noteOrExercise, workout.id);
          if (isJson) console.log(JSON.stringify({ success: true, type: 'session' }));
          else console.log(chalk.green('✓ Session note added.'));
        } else {
          // It's an exercise note
          const exercise = getExerciseByName(noteOrExercise);
          // Find the latest max set number for this exercise to attach note? Or attach to all missing?
          // Actually, let's attach the note to the most recently logged set of this exercise for this workout
          const latestSet = db.prepare('SELECT id FROM workout_sets WHERE workout_id = ? AND exercise_id = ? ORDER BY id DESC LIMIT 1').get(workout.id, exercise.id);
          
          if (!latestSet) {
             throw new Error(`You haven't logged any sets for '${exercise.name}' in this session to attach a note to.`);
          }
          
          db.prepare("UPDATE workout_sets SET notes = COALESCE(notes || '\n', '') || ? WHERE id = ?").run(noteContent, latestSet.id);
          if (isJson) console.log(JSON.stringify({ success: true, type: 'exercise_set' }));
          else console.log(chalk.green(`✓ Note added to last set of ${exercise.name}.`));
        }
      } catch (err) {
        if (isJson) console.log(JSON.stringify({ error: err.message }));
        else console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  program
    .command('done')
    .description('Finish the active workout session')
    .action(() => {
      const opts = program.opts();
      const isJson = opts.json;
      try {
        const profile = getProfile(opts.profile);
        const workout = getActiveWorkout(profile.id);
        if (!workout) throw new Error('No active workout found.');
        
        endWorkout(workout.id, 'completed');
        
        if (isJson) console.log(JSON.stringify({ success: true, status: 'completed' }));
        else console.log(chalk.green('✓ Workout session completed! Great job.'));
      } catch(err) {
        if (isJson) console.log(JSON.stringify({ error: err.message }));
        else console.error(chalk.red(`✗ ${err.message}`));
      }
    });

  program
    .command('cancel')
    .description('Discard the active workout session')
    .action(() => {
      const opts = program.opts();
      const isJson = opts.json;
      try {
        const profile = getProfile(opts.profile);
        const workout = getActiveWorkout(profile.id);
        if (!workout) throw new Error('No active workout found.');
        
        endWorkout(workout.id, 'cancelled');
        
        if (isJson) console.log(JSON.stringify({ success: true, status: 'cancelled' }));
        else console.log(chalk.yellow('⚠ Workout session cancelled.'));
      } catch(err) {
        if (isJson) console.log(JSON.stringify({ error: err.message }));
        else console.error(chalk.red(`✗ ${err.message}`));
      }
    });

  program
    .command('swap <oldExercise> <newExercise>')
    .description('Swap an exercise in the current session')
    .action((oldExerciseName, newExerciseName) => {
      const opts = program.opts();
      const isJson = opts.json;
      try {
        const profile = getProfile(opts.profile);
        const workout = getActiveWorkout(profile.id);
        if (!workout) throw new Error('No active workout found.');

        const oldExercise = getExerciseByName(oldExerciseName);
        const newExercise = getExerciseByName(newExerciseName);

        const info = db.prepare('UPDATE workout_sets SET exercise_id = ? WHERE workout_id = ? AND exercise_id = ?').run(newExercise.id, workout.id, oldExercise.id);
        
        if (isJson) console.log(JSON.stringify({ success: true, swappedSets: info.changes }));
        else console.log(chalk.green(`✓ Swapped ${oldExercise.name} for ${newExercise.name} (${info.changes} sets updated).`));
      } catch(err) {
        if (isJson) console.log(JSON.stringify({ error: err.message }));
        else console.error(chalk.red(`✗ ${err.message}`));
      }
    });

  program
    .command('undo [exercise]')
    .description('Remove the last logged set')
    .action((exerciseName) => {
      const opts = program.opts();
      const isJson = opts.json;
      try {
        const profile = getProfile(opts.profile);
        const workout = getActiveWorkout(profile.id);
        if (!workout) throw new Error('No active workout found.');

        let lastSet;
        if (exerciseName) {
          const exercise = getExerciseByName(exerciseName);
          lastSet = db.prepare('SELECT id FROM workout_sets WHERE workout_id = ? AND exercise_id = ? ORDER BY id DESC LIMIT 1').get(workout.id, exercise.id);
        } else {
          lastSet = db.prepare('SELECT id FROM workout_sets WHERE workout_id = ? ORDER BY id DESC LIMIT 1').get(workout.id);
        }

        if (!lastSet) throw new Error('No sets to undo.');

        db.prepare('DELETE FROM workout_sets WHERE id = ?').run(lastSet.id);
        
        if (isJson) console.log(JSON.stringify({ success: true, undoSetId: lastSet.id }));
        else console.log(chalk.green('✓ Last set undone.'));
      } catch(err) {
        if (isJson) console.log(JSON.stringify({ error: err.message }));
        else console.error(chalk.red(`✗ ${err.message}`));
      }
    });

  program
    .command('edit <exercise> <set_number> [weight] [reps]')
    .option('--reps <r>', 'Edit reps')
    .option('--rir <rir>', 'Edit RIR')
    .description('Edit a logged set (1-indexed based on the sets for that exercise in the session)')
    .action((exerciseName, setNumStr, weightStr, repsStr, options) => {
      const opts = program.opts();
      const isJson = opts.json;
      try {
        const profile = getProfile(opts.profile);
        const workout = getActiveWorkout(profile.id);
        if (!workout) throw new Error('No active workout found.');

        const exercise = getExerciseByName(exerciseName);
        const setNum = parseInt(setNumStr, 10);

        const targetSet = db.prepare('SELECT id, weight, reps, rir FROM workout_sets WHERE workout_id = ? AND exercise_id = ? AND set_number = ?').get(workout.id, exercise.id, setNum);

        if (!targetSet) throw new Error(`Set ${setNum} not found for ${exercise.name}.`);

        const newWeight = weightStr ? parseFloat(weightStr) : targetSet.weight;
        const newReps = (options.reps ? parseInt(options.reps, 10) : (repsStr ? parseInt(repsStr, 10) : targetSet.reps));
        const newRir = options.rir ? parseInt(options.rir, 10) : targetSet.rir;
        
        db.prepare('UPDATE workout_sets SET weight = ?, reps = ?, rir = ? WHERE id = ?').run(newWeight, newReps, newRir, targetSet.id);
        
        if (isJson) console.log(JSON.stringify({ success: true, updatedSetId: targetSet.id }));
        else console.log(chalk.green(`✓ Updated set ${setNum} of ${exercise.name} to ${newWeight}kg x ${newReps} reps.`));
      } catch(err) {
        if (isJson) console.log(JSON.stringify({ error: err.message }));
        else console.error(chalk.red(`✗ ${err.message}`));
      }
    });

  program
    .command('delete <exercise> <set_number>')
    .description('Delete a specific set completely')
    .action((exerciseName, setNumStr) => {
      const opts = program.opts();
      const isJson = opts.json;
      try {
        const profile = getProfile(opts.profile);
        const workout = getActiveWorkout(profile.id);
        if (!workout) throw new Error('No active workout found.');

        const exercise = getExerciseByName(exerciseName);
        const setNum = parseInt(setNumStr, 10);

        const targetSet = db.prepare('SELECT id FROM workout_sets WHERE workout_id = ? AND exercise_id = ? AND set_number = ?').get(workout.id, exercise.id, setNum);

        if (!targetSet) throw new Error(`Set ${setNum} not found for ${exercise.name}.`);

        db.prepare('DELETE FROM workout_sets WHERE id = ?').run(targetSet.id);
        
        if (isJson) console.log(JSON.stringify({ success: true, deletedSetId: targetSet.id }));
        else console.log(chalk.green(`✓ Deleted set ${setNum} of ${exercise.name}.`));
      } catch(err) {
        if (isJson) console.log(JSON.stringify({ error: err.message }));
        else console.error(chalk.red(`✗ ${err.message}`));
      }
    });
}
