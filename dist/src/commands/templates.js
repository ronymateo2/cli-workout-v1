import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import db from '../db.js';
import { getProfile } from '../config.js';
import { getExerciseByName } from '../state.js';
export const templatesCmd = new Command('templates').description('Manage workout templates');
templatesCmd
    .command('list')
    .description('List all templates for the current profile')
    .action(() => {
    const isJson = templatesCmd.parent.opts().json;
    try {
        const profile = getProfile(templatesCmd.parent.opts().profile);
        const templates = db.prepare('SELECT * FROM templates WHERE profile_id = ? ORDER BY name ASC').all(profile.id);
        if (isJson) {
            console.log(JSON.stringify(templates, null, 2));
        }
        else {
            if (templates.length === 0) {
                console.log(chalk.yellow(`No templates found for ${profile.name}.`));
                return;
            }
            const table = new Table({ head: ['ID', 'Template Name'], style: { head: ['cyan'] } });
            templates.forEach(t => table.push([t.id, t.name]));
            console.log(table.toString());
        }
    }
    catch (err) {
        if (isJson)
            console.log(JSON.stringify({ error: err.message }));
        else
            console.error(chalk.red(`✗ ${err.message}`));
    }
});
templatesCmd
    .command('show <name>')
    .description('Show exercises in a template')
    .action((name) => {
    const isJson = templatesCmd.parent.opts().json;
    try {
        const profile = getProfile(templatesCmd.parent.opts().profile);
        const template = db.prepare('SELECT id FROM templates WHERE profile_id = ? AND name = ? COLLATE NOCASE').get(profile.id, name);
        if (!template)
            throw new Error(`Template '${name}' not found.`);
        const exercises = db.prepare(`
        SELECT e.name as exercise_name, te.sets_config 
        FROM template_exercises te
        JOIN exercises e ON te.exercise_id = e.id
        WHERE te.template_id = ?
        ORDER BY te.sort_order ASC
      `).all(template.id);
        if (isJson) {
            console.log(JSON.stringify({ name, exercises }, null, 2));
        }
        else {
            console.log(chalk.cyan.bold(`\nTemplate: ${name}`));
            const table = new Table({ head: ['Exercise', 'Sets x Reps'], style: { head: ['cyan'] } });
            exercises.forEach(e => table.push([e.exercise_name, e.sets_config]));
            console.log(table.toString());
        }
    }
    catch (err) {
        if (isJson)
            console.log(JSON.stringify({ error: err.message }));
        else
            console.error(chalk.red(`✗ ${err.message}`));
    }
});
templatesCmd
    .command('create <name>')
    .requiredOption('--exercises <list>', 'Comma separated list of exercise:config (e.g. "bench-press:4x8,ohp:3x8")')
    .description('Create a new template')
    .action((name, options) => {
    const isJson = templatesCmd.parent.opts().json;
    try {
        const profile = getProfile(templatesCmd.parent.opts().profile);
        const insertTemplate = db.transaction((profId, tName, exercisesConfigStr) => {
            const info = db.prepare('INSERT INTO templates (profile_id, name) VALUES (?, ?)').run(profId, tName);
            const tId = info.lastInsertRowid;
            const configs = exercisesConfigStr.split(',').map(c => c.trim());
            let sortOrder = 0;
            for (const configStr of configs) {
                const [exName, setConf] = configStr.split(':');
                if (!exName || !setConf)
                    throw new Error(`Invalid format for exercise config: ${configStr}. Use "exerciseName:4x8"`);
                const ex = getExerciseByName(exName);
                db.prepare('INSERT INTO template_exercises (template_id, exercise_id, sets_config, sort_order) VALUES (?, ?, ?, ?)').run(tId, ex.id, setConf, sortOrder++);
            }
            return tId;
        });
        const templateId = insertTemplate(profile.id, name, options.exercises);
        if (isJson)
            console.log(JSON.stringify({ success: true, templateId, name }));
        else
            console.log(chalk.green(`✓ Template '${name}' created successfully.`));
    }
    catch (err) {
        if (isJson)
            console.log(JSON.stringify({ error: err.message }));
        else
            console.error(chalk.red(`✗ ${err.message}`));
    }
});
