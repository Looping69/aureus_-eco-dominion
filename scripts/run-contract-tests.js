import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const STABILIZATION_CONTRACTS = [
    'tests/first-loop-spine-contract.test.ts',
    'tests/starter-shop-contract.test.ts',
    'tests/narrative-panel-contract.test.ts',
    'tests/render-frame-contract.test.ts',
    'tests/render-quality-governor-contract.test.ts',
    'tests/low-end-render-workload-contract.test.ts',
    'tests/design-studio-contract.test.ts',
    'tests/game-definition-contract.test.ts',
    'tests/game-pack-boundary-contract.test.ts',
    'tests/game-definition-payload-schema-source-contract.test.ts',
    'tests/build-action-payload-schema-contract.test.ts',
    'tests/command-boundary-contract.test.ts',
    'tests/deterministic-network-layer-contract.test.ts',
    'tests/lockstep-command-buffer-contract.test.ts',
    'tests/lockstep-state-bridge-contract.test.ts',
    'tests/state-manager-lockstep-contract.test.ts',
    'tests/lockstep-replay-contract.test.ts',
    'tests/contracts-lifecycle-sim.test.ts',
    'tests/construction-placement-sim.test.ts',
    'tests/utility-readability-sim.test.ts',
    'tests/utility-allocation-sim.test.ts',
    'tests/infrastructure-line-sim.test.ts',
    'tests/resource-grid-solver-sim.test.ts',
    'tests/resource-grid-schema-contract.test.ts',
    'tests/agent-role-schema-contract.test.ts',
    'tests/combat-perimeter-schema-contract.test.ts',
    'tests/combat-world-registration-contract.test.ts',
    'tests/combat-aggression-stance-contract.test.ts',
    'tests/overseer-local-qwen-contract.test.ts',
    'tests/app-helper-extraction-contract.test.ts',
    'tests/hud-redesign-contract.test.ts',
    'tests/fps-ability-hud-contract.test.ts',
    'tests/contract-tracker-hud-contract.test.ts',
    'tests/underground-hud-drawer-contract.test.ts',
    'tests/controls-rail-safety-contract.test.ts',
];

const testFiles = STABILIZATION_CONTRACTS.filter((file) => existsSync(path.join(repoRoot, file)));

if (testFiles.length !== STABILIZATION_CONTRACTS.length) {
    const missing = STABILIZATION_CONTRACTS.filter((file) => !existsSync(path.join(repoRoot, file)));
    console.error(`Missing stabilization contract test(s): ${missing.join(', ')}`);
    process.exit(1);
}

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...testFiles], {
    stdio: 'inherit',
    shell: false,
    cwd: repoRoot,
});

if (result.error) {
    throw result.error;
}

process.exit(result.status ?? 1);
