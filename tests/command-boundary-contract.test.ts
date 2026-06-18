import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const contractTrackerPath = path.join(root, 'components', 'ContractTracker.tsx');
const commandDispatcherPath = path.join(root, 'engine', 'sim', 'systems', 'CommandDispatcher.ts');
const aureusWorldPath = path.join(root, 'game', 'AureusWorld.ts');
const contractBridgePath = path.join(root, 'game', 'world', 'contractBridge.ts');
const useEnginePath = path.join(root, 'game', 'useAureusEngine.ts');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('contract UI queues commands instead of mutating resources directly', () => {
  const trackerText = source(contractTrackerPath);

  for (const snippet of [
    "const queueContractCommand = (world: any, type: 'ACCEPT_CONTRACT' | 'DELIVER_CONTRACT' | 'ABANDON_CONTRACT', contractId: string)",
    'gameState.commandQueue.push({',
    'payload: { contractId },',
    "queueContractCommand(world, 'ACCEPT_CONTRACT', contract.id)",
    "queueContractCommand(world, 'DELIVER_CONTRACT', contract.id)",
    "queueContractCommand(world, 'ABANDON_CONTRACT', contract.id)",
  ]) {
    assertSnippet(trackerText, snippet);
  }
});

test('contract lifecycle mutations live in the command dispatcher', () => {
  const dispatcherText = source(commandDispatcherPath);

  for (const snippet of [
    "commandType === 'ACCEPT_CONTRACT'",
    "commandType === 'DELIVER_CONTRACT'",
    "commandType === 'ABANDON_CONTRACT'",
    'private acceptContract',
    'private deliverContract',
    'private abandonContract',
    "contract.status = 'ACCEPTED';",
    "contract.status = 'COMPLETED';",
    "contract.status = 'FAILED';",
    'state.resources[resourceKey] -= contract.amount;',
    'state.resources.agt += contract.reward;',
    'state.resources.trust = Math.min(100, state.resources.trust + trustReward);',
    'this.reportResult(cmd.id, result, state, handledBy, cmd);',
  ]) {
    assertSnippet(dispatcherText, snippet);
  }
});

test('world contract methods only queue dispatcher commands', () => {
  const worldText = source(aureusWorldPath);
  const bridgeText = source(contractBridgePath);

  assert.equal((worldText.match(/this\.researchManager = new ResearchManager/g) || []).length, 1);

  for (const snippet of [
    "import { acceptWorldContract, abandonWorldContract, deliverWorldContract } from './world/contractBridge';",
    'acceptContract(contractId: string): void { acceptWorldContract(this.stateManager, contractId); }',
    'deliverContract(contractId: string): void { deliverWorldContract(this.stateManager, contractId); }',
    'abandonContract(contractId: string): void { abandonWorldContract(this.stateManager, contractId); }',
    "case 'ACCEPT_CONTRACT': this.acceptContract(action.payload?.contractId ?? action.payload); break;",
    "case 'DELIVER_CONTRACT': this.deliverContract(action.payload?.contractId ?? action.payload); break;",
    "case 'ABANDON_CONTRACT': this.abandonContract(action.payload?.contractId ?? action.payload); break;",
  ]) {
    assertSnippet(worldText, snippet);
  }

  assert.equal(worldText.includes('state.resources[resource] -= contract.amount;'), false);
  assert.equal(worldText.includes('state.resources.agt += contract.reward;'), false);

  for (const snippet of [
    "export type ContractCommandType = 'ACCEPT_CONTRACT' | 'DELIVER_CONTRACT' | 'ABANDON_CONTRACT';",
    'stateManager.pushCommand(type, { contractId });',
    "queueContractCommand(stateManager, 'ACCEPT_CONTRACT', contractId);",
    "queueContractCommand(stateManager, 'DELIVER_CONTRACT', contractId);",
    "queueContractCommand(stateManager, 'ABANDON_CONTRACT', contractId);",
  ]) {
    assertSnippet(bridgeText, snippet);
  }
});

test('engine hook forwards contract delivery through the command queue bridge', () => {
  const hookText = source(useEnginePath);

  for (const snippet of [
    "if (action?.type === 'DELIVER_CONTRACT')",
    "enqueueWorldCommand(world, 'DELIVER_CONTRACT'",
    'contractId: action.payload?.contractId ?? action.payload',
  ]) {
    assertSnippet(hookText, snippet);
  }
});
