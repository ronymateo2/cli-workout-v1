#!/usr/bin/env node
import { program } from 'commander';
import fs from 'fs';
import { profileCmd } from '../src/commands/profile.js';
import { exercisesCmd } from '../src/commands/exercises.js';
import { registerSessionCommands } from '../src/commands/session.js';
import { templatesCmd } from '../src/commands/templates.js';
import { registerStatsCommands } from '../src/commands/stats.js';
import { injuryCmd } from '../src/commands/injury.js';
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
program
    .name('workout')
    .description('Workout CLI for logging and tracking workouts')
    .version(pkg.version)
    .option('-p, --profile <name>', 'Specify the user profile to use')
    .option('-j, --json', 'Output results as JSON');
program.addCommand(profileCmd);
program.addCommand(exercisesCmd);
program.addCommand(templatesCmd);
program.addCommand(injuryCmd);
registerSessionCommands(program);
registerStatsCommands(program);
program.parse(process.argv);
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
