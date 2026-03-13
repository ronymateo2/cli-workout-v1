import { Command } from 'commander';
import db from '../db.js';
import Table from 'cli-table3';
import chalk from 'chalk';
export const profileCmd = new Command('profile').description('Manage multi-user profiles');
profileCmd
    .command('list')
    .description('List all profiles')
    .action(() => {
    const isJson = profileCmd.parent.opts().json;
    const profiles = db.prepare('SELECT * FROM profiles ORDER BY name ASC').all();
    if (isJson) {
        console.log(JSON.stringify(profiles, null, 2));
        return;
    }
    if (profiles.length === 0) {
        console.log(chalk.yellow('No profiles found.'));
        return;
    }
    const table = new Table({
        head: ['ID', 'Name', 'Created At'],
        style: { head: ['cyan'] }
    });
    profiles.forEach(p => table.push([p.id, p.name, p.created_at]));
    console.log(table.toString());
});
profileCmd
    .command('create <name>')
    .description('Create a new profile')
    .action((name) => {
    const isJson = profileCmd.parent.opts().json;
    try {
        const stmt = db.prepare('INSERT INTO profiles (name) VALUES (?)');
        const info = stmt.run(name);
        const res = { success: true, id: info.lastInsertRowid, name };
        if (isJson) {
            console.log(JSON.stringify(res, null, 2));
        }
        else {
            console.log(chalk.green(`✓ Profile '${name}' created successfully.`));
        }
    }
    catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            const errObj = { error: `Profile '${name}' already exists.` };
            if (isJson)
                console.log(JSON.stringify(errObj));
            else
                console.error(chalk.red(`✗ ${errObj.error}`));
            process.exit(1);
        }
        throw err;
    }
});
profileCmd
    .command('delete <name>')
    .description('Delete a profile')
    .action((name) => {
    const isJson = profileCmd.parent.opts().json;
    // Check if it exists
    const existing = db.prepare('SELECT * FROM profiles WHERE name = ? COLLATE NOCASE').get(name);
    if (!existing) {
        const errObj = { error: `Profile '${name}' not found.` };
        if (isJson)
            console.log(JSON.stringify(errObj));
        else
            console.error(chalk.red(`✗ ${errObj.error}`));
        process.exit(1);
    }
    // Delete it
    db.prepare('DELETE FROM profiles WHERE id = ?').run(existing.id);
    const res = { success: true, deleted: existing.name };
    if (isJson) {
        console.log(JSON.stringify(res, null, 2));
    }
    else {
        console.log(chalk.green(`✓ Profile '${existing.name}' deleted successfully.`));
    }
});
