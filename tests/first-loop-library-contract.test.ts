import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const contractTrackerPath = path.join(process.cwd(), 'components', 'ContractTracker.tsx');
const contractPanelStorePath = path.join(process.cwd(), 'components', 'state', 'useContractPanelStore.ts');
const contractLifecyclePath = path.join(process.cwd(), 'engine', 'stateMachines', 'contractLifecycle.ts');
const productionSystemPath = path.join(process.cwd(), 'engine', 'sim', 'systems', 'ProductionSystem.ts');

function includesAll(source: string, snippets: string[]) {
  for (const snippet of snippets) {
    assert.match(source, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
}

test('contract tracker uses Zustand UI state so contracts can collapse without touching engine state', () => {
  assert.equal(existsSync(contractPanelStorePath), true, 'contract panel store is missing');
  assert.equal(existsSync(contractTrackerPath), true, 'contract tracker is missing');

  const store = readFileSync(contractPanelStorePath, 'utf8');
  includesAll(store, [
    "import { create } from 'zustand';",
    'isCollapsed: true',
    'toggleCollapsed',
    'markAttention',
  ]);

  const tracker = readFileSync(contractTrackerPath, 'utf8');
  includesAll(tracker, [
    "import { useContractPanelStore } from './state/useContractPanelStore';",
    'const isCollapsed = useContractPanelStore',
    'toggleCollapsed();',
    'Panel collapsed',
    'Open to deliver',
  ]);
});

test('contract lifecycle is represented by an XState machine and consumed by the tracker', () => {
  assert.equal(existsSync(contractLifecyclePath), true, 'contract lifecycle machine is missing');

  const lifecycle = readFileSync(contractLifecyclePath, 'utf8');
  includesAll(lifecycle, [
    "import { createMachine } from 'xstate';",
    "id: 'contractLifecycle'",
    "ACCEPT: 'accepted'",
    "STOCK_READY: 'readyToDeliver'",
    "DELIVER: 'completed'",
    'getContractLifecycleState',
  ]);

  const tracker = readFileSync(contractTrackerPath, 'utf8');
  includesAll(tracker, [
    "import { getContractLifecycleState } from '../engine/stateMachines/contractLifecycle';",
    'const lifecycleState = getContractLifecycleState(status);',
    "lifecycleState === 'readyToDeliver'",
  ]);
});

test('Settlement mining produces global minerals so the starter contract cannot dead-end on hidden ore logistics', () => {
  assert.equal(existsSync(productionSystemPath), true, 'ProductionSystem.ts is missing');

  const production = readFileSync(productionSystemPath, 'utf8');
  includesAll(production, [
    'BuildingType, Era, FactoryNodeState',
    'tile.buildingType === BuildingType.MINING_HEADFRAME',
    'state.currentEra === Era.SETTLEMENT',
    'mineralProd += (currentDef.production || 0)',
    "this.pushOutput(node, 'ORE'",
  ]);
});
