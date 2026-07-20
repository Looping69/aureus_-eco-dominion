import type { GameCommand, GameState } from '../types';
import {
    buildGameCommandValidationContext,
    createGameCommandCandidate,
    createGameCommandCandidateEnvelope,
    createGameCommandCandidateId,
    describeGameCommandCandidate,
    GAME_COMMAND_CANDIDATE_SOURCES,
    validateGameCommandCandidate,
    type GameCommandCandidate,
    type GameCommandCandidateEnvelope,
    type GameCommandCandidateValidationResult,
    type GameDefinition,
} from '../engine/game-definition';

export type OverseerLocalDevice = 'webgpu' | 'wasm';
export type OverseerLocalModelStatus = 'idle' | 'loading' | 'ready' | 'error';
export type OverseerPilotActionType = Extract<GameCommand['type'], 'ACCEPT_CONTRACT' | 'DELIVER_CONTRACT' | 'BUY_BUILDING' | 'SELL_RESOURCE' | 'BUY_RESOURCE' | 'MARK_HARVEST'> | 'NONE';

export type OverseerPilotAction = {
    type: OverseerPilotActionType;
    payload?: Record<string, unknown>;
    reason?: string;
};

export type OverseerPilotActionValidationResult = Pick<GameCommandCandidateValidationResult, 'ok' | 'reason'>;

export type OverseerLocalInsight = {
    focus: string;
    recommendation: string;
    rawText: string;
    device: OverseerLocalDevice;
    modelId: string;
    action?: OverseerPilotAction;
};

type TextGenerationPipeline = (input: string, options?: Record<string, unknown>) => Promise<unknown>;
type TransformersModule = {
    env?: Record<string, unknown>;
    pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<TextGenerationPipeline>;
};

export const OVERSEER_LOCAL_QWEN_CONFIG = {
    provider: 'Transformers.js',
    modelId: 'onnx-community/Qwen2.5-0.5B-Instruct',
    displayName: 'Qwen2.5 0.5B Instruct',
    task: 'text-generation',
    preferredDevice: 'webgpu' as OverseerLocalDevice,
    fallbackDevice: 'wasm' as OverseerLocalDevice,
    transformersModuleUrl: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2',
    maxNewTokens: 160,
    temperature: 0.25,
    topP: 0.85,
};

export const OVERSEER_PILOT_RULES = [
    'Protect survival first: fix power and water deficits before optional growth.',
    'Deliver accepted contracts immediately when stock is ready.',
    'Accept a new contract only when stock is already strong or the colony has a clear production path.',
    'Grow from the starter spine before luxury: quarters, storage, stockpile, solar, well, wash plant, headframe, canteen.',
    'Keep at least 700 minerals, 700 wood, 700 stone, and 20 gems unless selling is needed to buy a critical building.',
    'Prefer buying one useful building over spending all AGT on resources.',
    'Use MARK_HARVEST only when no better contract, utility, or building action is available.',
    'Return only JSON. Never claim that an action already happened.',
] as const;

export const OVERSEER_PILOT_ACTION_SCHEMA = {
    output: '{ "focus": string, "recommendation": string, "action": { "type": "NONE" | "ACCEPT_CONTRACT" | "DELIVER_CONTRACT" | "BUY_BUILDING" | "SELL_RESOURCE" | "BUY_RESOURCE" | "MARK_HARVEST", "payload": object, "reason": string } }',
    payloads: {
        ACCEPT_CONTRACT: '{ "contractId": string }',
        DELIVER_CONTRACT: '{ "contractId": string }',
        BUY_BUILDING: '{ "buildingType": "STAFF_QUARTERS" | "STORAGE_DEPOT" | "STOCKPILE" | "SOLAR_ARRAY" | "WATER_WELL" | "WASH_PLANT" | "MINING_HEADFRAME" | "CANTEEN" | "SAWMILL" | "STONE_QUARRY" }',
        SELL_RESOURCE: '{ "resource": "minerals" | "wood" | "stone" | "gems" }',
        BUY_RESOURCE: '{ "resource": "minerals" | "wood" | "stone", "amount": number }',
        MARK_HARVEST: '{ "x": number, "z": number }',
        NONE: '{}',
    },
} as const;

const EXECUTABLE_ACTIONS = new Set<OverseerPilotActionType>([
    'NONE',
    'ACCEPT_CONTRACT',
    'DELIVER_CONTRACT',
    'BUY_BUILDING',
    'SELL_RESOURCE',
    'BUY_RESOURCE',
    'MARK_HARVEST',
]);

let generatorPromise: Promise<{ generator: TextGenerationPipeline; device: OverseerLocalDevice }> | null = null;
let modelStatus: OverseerLocalModelStatus = 'idle';

export function getOverseerLocalModelStatus(): OverseerLocalModelStatus {
    return modelStatus;
}

export function getPreferredOverseerLocalDevice(): OverseerLocalDevice {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) return OVERSEER_LOCAL_QWEN_CONFIG.preferredDevice;
    return OVERSEER_LOCAL_QWEN_CONFIG.fallbackDevice;
}

export function buildOverseerLocalPrompt(state: Pick<GameState, 'resources' | 'contracts' | 'agents' | 'jobs' | 'currentEra' | 'activeGoal' | 'powerGrid' | 'waterNetwork' | 'tickCount'>): string {
    return buildOverseerPrompt(state, 'advice');
}

export function buildOverseerPilotPrompt(state: Pick<GameState, 'resources' | 'contracts' | 'agents' | 'jobs' | 'currentEra' | 'activeGoal' | 'powerGrid' | 'waterNetwork' | 'tickCount'>): string {
    return buildOverseerPrompt(state, 'pilot');
}

export async function generateOverseerLocalInsight(state: Parameters<typeof buildOverseerLocalPrompt>[0]): Promise<OverseerLocalInsight> {
    const rawText = await runOverseerGeneration(buildOverseerLocalPrompt(state));
    const parsed = parseOverseerInsight(rawText);
    const { device } = await getOverseerGenerator();
    return {
        ...parsed,
        rawText,
        device,
        modelId: OVERSEER_LOCAL_QWEN_CONFIG.modelId,
    };
}

export async function generateOverseerPilotDirective(state: Parameters<typeof buildOverseerPilotPrompt>[0]): Promise<OverseerLocalInsight> {
    const rawText = await runOverseerGeneration(buildOverseerPilotPrompt(state));
    const parsed = parseOverseerPilotDirective(rawText);
    const { device } = await getOverseerGenerator();
    return {
        ...parsed,
        rawText,
        device,
        modelId: OVERSEER_LOCAL_QWEN_CONFIG.modelId,
    };
}

export function isExecutablePilotAction(action: OverseerPilotAction | undefined): action is OverseerPilotAction {
    return Boolean(action && EXECUTABLE_ACTIONS.has(action.type));
}

export function createOverseerPilotCommandCandidate(action: OverseerPilotAction): GameCommandCandidate {
    return createGameCommandCandidate(action.type, action.payload || {}, GAME_COMMAND_CANDIDATE_SOURCES.LOCAL_QWEN, action.reason);
}

export function describeOverseerPilotCommand(action: OverseerPilotAction): string {
    return describeGameCommandCandidate(createOverseerPilotCommandCandidate(action));
}

export function createOverseerPilotCommandId(action: OverseerPilotAction, issuedAtTick: number, sequence = 0): string {
    return createGameCommandCandidateId(GAME_COMMAND_CANDIDATE_SOURCES.LOCAL_QWEN, action.type, issuedAtTick, sequence);
}

export function createOverseerPilotCommandEnvelope(action: OverseerPilotAction, id: string, issuedAtTick?: number): GameCommandCandidateEnvelope {
    return createGameCommandCandidateEnvelope(createOverseerPilotCommandCandidate(action), id, issuedAtTick);
}

export function validateOverseerPilotAction(
    action: OverseerPilotAction | undefined,
    state: GameState,
    definition: GameDefinition,
): OverseerPilotActionValidationResult {
    if (!isExecutablePilotAction(action)) return { ok: false, reason: 'Pilot action is not executable.' };
    if (action.type === 'NONE') return { ok: true };
    const candidate = createOverseerPilotCommandCandidate(action);
    return validateGameCommandCandidate(definition, candidate, buildGameCommandValidationContext(state as any));
}

async function runOverseerGeneration(prompt: string): Promise<string> {
    const { generator } = await getOverseerGenerator();
    const result = await generator(prompt, {
        max_new_tokens: OVERSEER_LOCAL_QWEN_CONFIG.maxNewTokens,
        temperature: OVERSEER_LOCAL_QWEN_CONFIG.temperature,
        top_p: OVERSEER_LOCAL_QWEN_CONFIG.topP,
        do_sample: true,
        return_full_text: false,
    });
    return normalizeGenerationText(result);
}

function buildOverseerPrompt(state: Pick<GameState, 'resources' | 'contracts' | 'agents' | 'jobs' | 'currentEra' | 'activeGoal' | 'powerGrid' | 'waterNetwork' | 'tickCount'>, mode: 'advice' | 'pilot'): string {
    const resources = state.resources;
    const readyContracts = state.contracts.filter(contract => ['ACCEPTED', 'READY_TO_DELIVER'].includes(contract.status || '')).slice(0, 3);
    const availableContracts = state.contracts.filter(contract => (contract.status || 'AVAILABLE') === 'AVAILABLE').slice(0, 3);
    const idleWorkers = state.agents.filter(agent => agent.state === 'IDLE' && agent.type !== 'ILLEGAL_MINER').length;
    const blockedWorkers = state.agents.filter(agent => agent.statusTone === 'blocked').length;
    const activeGoal = state.activeGoal && !state.activeGoal.completed ? `${state.activeGoal.title}: ${state.activeGoal.description}` : 'No active unfinished goal.';
    const instruction = mode === 'pilot'
        ? `You are now the Pilot. Use these rules:\n${OVERSEER_PILOT_RULES.map((rule, index) => `${index + 1}. ${rule}`).join('\n')}\nAction schema: ${JSON.stringify(OVERSEER_PILOT_ACTION_SCHEMA)}.`
        : 'You are the local AI overseer for Aureus Eco Dominion. Give one short tactical game recommendation. Be concrete, avoid roleplay, and never claim you executed commands.';

    return [
        '<|im_start|>system',
        instruction,
        '<|im_end|>',
        '<|im_start|>user',
        `Tick: ${state.tickCount}. Era: ${state.currentEra}.`,
        `Resources: AGT ${Math.floor(resources.agt)}, minerals ${Math.floor(resources.minerals)}, wood ${Math.floor(resources.wood)}, stone ${Math.floor(resources.stone)}, gems ${Math.floor(resources.gems)}, eco ${Math.floor(resources.eco)}, trust ${Math.floor(resources.trust)}.`,
        `Utilities: power deficit ${Math.ceil(state.powerGrid?.deficit || 0)}, water deficit ${Math.ceil(state.waterNetwork?.deficit || 0)}.`,
        `Workforce: ${state.agents.length} agents, ${idleWorkers} idle, ${blockedWorkers} blocked, ${state.jobs.length} jobs.`,
        `Goal: ${activeGoal}`,
        `Accepted contracts: ${summarizeContracts(readyContracts)}.`,
        `Available contracts: ${summarizeContracts(availableContracts)}.`,
        mode === 'pilot'
            ? 'Choose one valid next action. Return JSON only.'
            : 'Return exactly two short lines: Focus: ... and Recommendation: ...',
        '<|im_end|>',
        '<|im_start|>assistant',
    ].join('\n');
}

async function getOverseerGenerator(): Promise<{ generator: TextGenerationPipeline; device: OverseerLocalDevice }> {
    if (!generatorPromise) {
        modelStatus = 'loading';
        generatorPromise = createOverseerGenerator()
            .then(result => {
                modelStatus = 'ready';
                return result;
            })
            .catch(error => {
                modelStatus = 'error';
                generatorPromise = null;
                throw error;
            });
    }
    return generatorPromise;
}

async function createOverseerGenerator(): Promise<{ generator: TextGenerationPipeline; device: OverseerLocalDevice }> {
    const transformers = await importTransformers();
    configureTransformers(transformers);

    const preferredDevice = getPreferredOverseerLocalDevice();
    try {
        return {
            generator: await transformers.pipeline(OVERSEER_LOCAL_QWEN_CONFIG.task, OVERSEER_LOCAL_QWEN_CONFIG.modelId, { device: preferredDevice }),
            device: preferredDevice,
        };
    } catch (error) {
        if (preferredDevice !== OVERSEER_LOCAL_QWEN_CONFIG.preferredDevice) throw error;
        return {
            generator: await transformers.pipeline(OVERSEER_LOCAL_QWEN_CONFIG.task, OVERSEER_LOCAL_QWEN_CONFIG.modelId, { device: OVERSEER_LOCAL_QWEN_CONFIG.fallbackDevice }),
            device: OVERSEER_LOCAL_QWEN_CONFIG.fallbackDevice,
        };
    }
}

async function importTransformers(): Promise<TransformersModule> {
    const moduleUrl = OVERSEER_LOCAL_QWEN_CONFIG.transformersModuleUrl;
    return await import(/* @vite-ignore */ moduleUrl) as TransformersModule;
}

function configureTransformers(transformers: TransformersModule): void {
    if (!transformers.env) return;
    transformers.env.allowLocalModels = false;
    transformers.env.useBrowserCache = true;
}

function summarizeContracts(contracts: GameState['contracts']): string {
    if (!contracts.length) return 'none';
    return contracts.map(contract => `${contract.id}:${contract.resource} ${contract.amount} for ${contract.reward} AGT`).join('; ');
}

function normalizeGenerationText(result: unknown): string {
    const first = Array.isArray(result) ? result[0] : result;
    if (typeof first === 'string') return first.trim();
    if (first && typeof first === 'object') {
        const value = (first as any).generated_text;
        if (typeof value === 'string') return value.trim();
        if (Array.isArray(value)) {
            const last = value[value.length - 1];
            if (last && typeof last === 'object' && typeof last.content === 'string') return last.content.trim();
        }
    }
    return String(result || '').trim();
}

function parseOverseerInsight(rawText: string): Pick<OverseerLocalInsight, 'focus' | 'recommendation'> {
    const clean = rawText.replace(/<\|im_end\|>/g, '').trim();
    const focusMatch = clean.match(/Focus:\s*(.+)/i);
    const recommendationMatch = clean.match(/Recommendation:\s*(.+)/i);
    const sentences = clean.split(/\n+/).map(line => line.trim()).filter(Boolean);
    return {
        focus: (focusMatch?.[1] || sentences[0] || 'Local model review').slice(0, 120),
        recommendation: (recommendationMatch?.[1] || sentences.slice(1).join(' ') || clean || 'No local recommendation returned.').slice(0, 240),
    };
}

function parseOverseerPilotDirective(rawText: string): Pick<OverseerLocalInsight, 'focus' | 'recommendation' | 'action'> {
    const clean = rawText.replace(/<\|im_end\|>/g, '').trim();
    const json = extractFirstJsonObject(clean);
    if (!json) {
        return { ...parseOverseerInsight(clean), action: { type: 'NONE', reason: 'Model did not return valid JSON.' } };
    }

    try {
        const parsed = JSON.parse(json) as any;
        return {
            focus: String(parsed.focus || 'Local Qwen pilot').slice(0, 120),
            recommendation: String(parsed.recommendation || parsed.action?.reason || 'Pilot is waiting for a valid move.').slice(0, 240),
            action: normalizePilotAction(parsed.action),
        };
    } catch {
        return { ...parseOverseerInsight(clean), action: { type: 'NONE', reason: 'Model JSON could not be parsed.' } };
    }
}

function extractFirstJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    return text.slice(start, end + 1);
}

function normalizePilotAction(value: unknown): OverseerPilotAction {
    if (!value || typeof value !== 'object') return { type: 'NONE' };
    const type = String((value as any).type || 'NONE').toUpperCase() as OverseerPilotActionType;
    if (!EXECUTABLE_ACTIONS.has(type)) return { type: 'NONE', reason: `Unsupported action: ${type}` };
    if (type === 'NONE') return { type, reason: String((value as any).reason || '') };
    const payload = normalizePilotPayload(type, (value as any).payload || {});
    if (!payload) return { type: 'NONE', reason: `Invalid payload for ${type}` };
    return { type, payload, reason: String((value as any).reason || '') };
}

function normalizePilotPayload(type: OverseerPilotActionType, payload: Record<string, unknown>): Record<string, unknown> | null {
    if (type === 'ACCEPT_CONTRACT' || type === 'DELIVER_CONTRACT') {
        const contractId = String(payload.contractId || '');
        return contractId ? { contractId } : null;
    }
    if (type === 'BUY_BUILDING') {
        const buildingType = String(payload.buildingType || '').toUpperCase();
        return buildingType ? { buildingType } : null;
    }
    if (type === 'SELL_RESOURCE') {
        const resource = String(payload.resource || '').toLowerCase();
        return ['minerals', 'wood', 'stone', 'gems'].includes(resource) ? { resource } : null;
    }
    if (type === 'BUY_RESOURCE') {
        const resource = String(payload.resource || '').toLowerCase();
        const amount = Math.max(25, Math.min(400, Math.round(Number(payload.amount || 0))));
        return ['minerals', 'wood', 'stone'].includes(resource) && Number.isFinite(amount) ? { resource, amount } : null;
    }
    if (type === 'MARK_HARVEST') {
        const x = Math.round(Number(payload.x));
        const z = Math.round(Number(payload.z));
        return Number.isFinite(x) && Number.isFinite(z) ? { x, z } : null;
    }
    return {};
}
