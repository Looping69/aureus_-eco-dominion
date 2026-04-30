import { spawnSync } from 'node:child_process';

const npmCli = process.env.npm_execpath;

const steps = [
    ['test'],
    ['run', 'build'],
];

for (const args of steps) {
    const command = npmCli ? process.execPath : 'npm';
    const commandArgs = npmCli ? [npmCli, ...args] : args;
    const result = spawnSync(command, commandArgs, {
        stdio: 'inherit',
    });

    if (result.error) {
        console.error(result.error.message);
        process.exit(1);
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}
