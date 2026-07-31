import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const contractTrackerPath = path.join(root, 'components', 'ContractTracker.tsx');
const commandDispatcherPath = path.join(root, 'engine', 'sim', 'systems', 'CommandDispatcher.ts');
const gameTypesPath = path.join(root, 'engine', 'types', 'game.ts');
const commandCandidatePath = path.join(root, 'engine', 'game-definition', 'GameCommandCandidate.ts');
const gameDefinitionIndexPath = path.join(root, 'engine', 'game-definition', 'index.ts');
const stateManagerPath = path.join(root, 'engine', 'state', 'StateManager.ts');
const lockstepBridgePath = path.join(root, 'engine', 'net', 'LockstepStateBridge.ts');
const systemsIndexPath = path.join(root, 'engine', 'sim', 'systems', 'index.ts');
const aureusWorldPath = path.join(root, 'game', 'AureusWorld.ts');
const contractBridgePath = path.join(root, 'game', 'world', 'contractBridge.ts');
const dispatchBridgePath = path.join(root, 'game', 'world', 'dispatchBridge.ts');
const useEnginePath = path.join(root, 'game', 'useAureusEngine.ts');
const useEngineActionsPath = path.join(root, 'game', 'useAureusEngineActions.ts');
const fpsAbilityPath = path.join(root, 'game', 'ui', 'fpsAbilityLogic.ts');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('shared command candidate helpers expose a one-step queued envelope path', () => {
  const candidateText = source(commandCandidatePath);
  const indexText = source(gameDefinitionIndexPath);

  for (const snippet of [
    'export function createQueuedGameCommandCandidateEnvelope(',
    'const candidate = createGameCommandCandidate(commandType, payload, source, reason);',
    'id ?? createGameCommandCandidateId(source, commandType, issuedAtTick, sequence)',
    'createGameCommandCandidateEnvelope(',
  ]) {
    assertSnippet(candidateText, snippet);
  }

  assertSnippet(indexText, 'createQueuedGameCommandCandidateEnvelope,');
});

test('contract UI queues commands through shared UI envelopes instead of mutating resources directly', () => {
  const trackerText = source(contractTrackerPath);

  for (const snippet of [
    'createQueuedGameCommandCandidateEnvelope,',
    'GAME_COMMAND_CANDIDATE_SOURCES',
    "const CONTRACT_TRACKER_COMMAND_REASON = 'Contract tracker action';",
    "const queueContractCommand = (world: any, type: 'ACCEPT_CONTRACT' | 'DELIVER_CONTRACT' | 'ABANDON_CONTRACT', contractId: string)",
    'const command = createQueuedGameCommandCandidateEnvelope(',
    'GAME_COMMAND_CANDIDATE_SOURCES.UI,',
    'CONTRACT_TRACKER_COMMAND_REASON,',
    'gameState.commandQueue.push(command as GameCommand);',
    "queueContractCommand(world, 'ACCEPT_CONTRACT', contract.id)",
    "queueContractCommand(world, 'DELIVER_CONTRACT', contract.id)",
    "queueContractCommand(world, 'ABANDON_CONTRACT', contract.id)",
  ]) {
    assertSnippet(trackerText, snippet);
  }

  assert.doesNotMatch(trackerText, /id:\s*`ui_\$\{type\.toLowerCase\(\)\}_\$\{Date\.now\(\)\}`/);
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
    'this.reportResult(cmd.id, result, state, handledBy, cmd, sequence);',
  ]) {
    assertSnippet(dispatcherText, snippet);
  }
});

test('command dispatcher records deterministic audit metadata for every dispatched command', () => {
  const dispatcherText = source(commandDispatcherPath);

  for (const snippet of [
    'for (let sequence = 0; sequence < queue.length; sequence += 1) {',
    'this.dispatchCommand(cmd, commandCtx, state, sequence);',
    'private dispatchCommand(cmd: GameCommand, ctx: CommandContext, state: GameState, sequence: number)',
    'this.reportResult(cmd.id, result, state, handledBy, cmd, sequence);',
    'issuedAtTick: cmd?.issuedAtTick ?? state.tickCount,',
    'sequence,',
    'source: this.getCommandSource(cmd),',
    "validationResult: ok ? 'accepted' : 'rejected',",
    'rejectionReason: reason,',
    'private getCommandSource(cmd?: GameCommand): string',
    "cmd.source.length > 0 ? cmd.source : 'unknown'",
  ]) {
    assertSnippet(dispatcherText, snippet);
  }
});

test('game state types expose command audit metadata and source-carrying commands', () => {
  const gameTypesText = source(gameTypesPath);

  for (const snippet of [
    'export type GameCommandType =',
    "'CLEAR_RUBBLE'",
    "'DESIGNATE_RUBBLE_DUMP'",
    "'FILL_VOXEL'",
    "'BULLDOZE_SUB'",
    "'PLACE_SUB_BUILDING'",
    "'SET_AI_OVERSEER'",
    '| (string & {});',
    'type: GameCommandType;',
    'source?: string;',
    'reason?: string;',
    "export type CommandAuditValidationResult = 'accepted' | 'rejected';",
    'export interface CommandTraceEntry',
    'issuedAtTick?: number;',
    'sequence: number;',
    'source: string;',
    "commandType: GameCommandType | 'UNKNOWN';",
    'validationResult: CommandAuditValidationResult;',
    'rejectionReason?: string;',
    'commandTrace: CommandTraceEntry[];',
  ]) {
    assertSnippet(gameTypesText, snippet);
  }
});

test('StateManager pushCommand queues through shared UI envelopes while preserving cmd ids', () => {
  const stateManagerText = source(stateManagerPath);

  for (const snippet of [
    'createQueuedGameCommandCandidateEnvelope,',
    'GAME_COMMAND_CANDIDATE_SOURCES,',
    'const issuedAtTick = this.state.tickCount;',
    'const command = createQueuedGameCommandCandidateEnvelope(',
    'GAME_COMMAND_CANDIDATE_SOURCES.UI,',
    "'StateManager pushCommand'",
    "this.getNextId('cmd'),",
    "this.state.commandQueue.push(command as GameState['commandQueue'][number]);",
  ]) {
    assertSnippet(stateManagerText, snippet);
  }

  assert.doesNotMatch(stateManagerText, /this\.state\.commandQueue\.push\(\{\s*id: this\.getNextId\('cmd'\)/s);
});

test('engine action helper queues world commands through shared UI envelopes', () => {
  const actionsText = source(useEngineActionsPath);

  for (const snippet of [
    'createQueuedGameCommandCandidateEnvelope,',
    'GAME_COMMAND_CANDIDATE_SOURCES,',
    "const WORLD_ACTION_COMMAND_REASON = 'Aureus world action';",
    'const command = createQueuedGameCommandCandidateEnvelope(',
    'GAME_COMMAND_CANDIDATE_SOURCES.UI,',
    'WORLD_ACTION_COMMAND_REASON,',
    'state.commandQueue.push(command as GameCommand);',
  ]) {
    assertSnippet(actionsText, snippet);
  }

  assert.doesNotMatch(actionsText, /id:\s*`ui_\$\{type\.toLowerCase\(\)\}_\$\{Date\.now\(\)\}`/);
});

test('FPS ability helper queues commands through shared UI envelopes', () => {
  const fpsText = source(fpsAbilityPath);

  for (const snippet of [
    'createQueuedGameCommandCandidateEnvelope,',
    'GAME_COMMAND_CANDIDATE_SOURCES',
    "const FPS_COMMAND_REASON = 'FPS ability HUD';",
    'return createQueuedGameCommandCandidateEnvelope(',
    'GAME_COMMAND_CANDIDATE_SOURCES.UI,',
    'FPS_COMMAND_REASON,',
    'commandQueue.push(createFPSQueuedCommand(type, payload, tickCount, commandQueue.length));',
  ]) {
    assertSnippet(fpsText, snippet);
  }

  assert.doesNotMatch(fpsText, /id:\s*`fps_\$\{type\.toLowerCase\(\)\}_\$\{Date\.now\(\)\}`/);
});

test('lockstep bridge preserves full command envelope metadata when flushing', () => {
  const bridgeText = source(lockstepBridgePath);

  for (const snippet of [
    'const ready = buffer.drainReady(currentTick);',
    'state.commandQueue.push({',
    '...envelope.command,',
    'issuedAtTick: envelope.command.issuedAtTick ?? envelope.targetTick,',
  ]) {
    assertSnippet(bridgeText, snippet);
  }

  assert.equal(bridgeText.includes('source: envelope'), false);
  assert.equal(bridgeText.includes('reason: envelope'), false);
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

test('AureusWorld dispatch delegates to the extracted dispatch bridge', () => {
  const worldText = source(aureusWorldPath);
  const dispatchBridgeText = source(dispatchBridgePath);

  for (const snippet of [
    "import { dispatchWorldAction } from './world/dispatchBridge';",
    'dispatch(action: Action): void {',
    'dispatchWorldAction(action, {',
    'getSelectedAgentId: () => this.stateManager.getState().selectedAgentId,',
    'pushCommand: (type, payload) => this.stateManager.pushCommand(type, payload),',
  ]) {
    assertSnippet(worldText, snippet);
  }

  assert.equal(worldText.includes("switch (action.type)"), false);

  for (const snippet of [
    'export interface WorldDispatchBridgeDeps',
    'export function dispatchWorldAction(action: Action, deps: WorldDispatchBridgeDeps): void',
    "case 'ACCEPT_CONTRACT': deps.acceptContract(contractIdFromPayload(action.payload)); break;",
    "case 'DELIVER_CONTRACT': deps.deliverContract(contractIdFromPayload(action.payload)); break;",
    "case 'ABANDON_CONTRACT': deps.abandonContract(contractIdFromPayload(action.payload)); break;",
    "case 'BUY_BUILDING':",
    "case 'SUBMIT_PERMIT': deps.pushCommand('SUBMIT_PERMIT', { permitId: action.payload }); break;",
  ]) {
    assertSnippet(dispatchBridgeText, snippet);
  }
});

test('AureusWorld uses the active AI Overseer play system, whose autopilot commands are envelope-backed', () => {
  const systemsIndexText = source(systemsIndexPath);
  const worldText = source(aureusWorldPath);

  assertSnippet(systemsIndexText, "export * from './AIOverseerPlaySystem';");
  assertSnippet(worldText, 'AIOverseerSystem, CombatSystem');
  assert.equal(systemsIndexText.includes("export * from './AIOverseerAutopilotSystem';"), false);
});

test('AureusWorld simulation flushes lockstep commands before the simulation tick', () => {
  const worldText = source(aureusWorldPath);

  for (const snippet of [
    'this.stateManager.flushReadyLockstepCommands();',
    'this.sim.tick(ctx, state);',
  ]) {
    assertSnippet(worldText, snippet);
  }

  assert.ok(
    worldText.indexOf('this.stateManager.flushReadyLockstepCommands();') < worldText.indexOf('this.sim.tick(ctx, state);'),
    'lockstep commands should flush before the simulation tick',
  );
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
