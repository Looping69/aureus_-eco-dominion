import type { GameState } from '../types';

export type OverseerLocalDevice = 'webgpu' | 'wasm';
export type OverseerLocalModelStatus = 'idle' | 'loading' | 'ready' | 'error';

export type OverseerLocalInsight = {
    focus: string;
    recommendation: string;
    rawText: string;
    device: OverseerLocalDevice;
    modelId: string;
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
    maxNewTokens: 96,
    temperature: 0.35,
    topP: 0.9,
};

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
    const resources = state.resources;
    const readyContracts = state.contracts.filter(contract => ['ACCEPTED', 'READY_TO_DELIVER'].includes(contract.status || '')).slice(0, 3);
    const availableContracts = state.contracts.filter(contract => (contract.status || 'AVAILABLE') === 'AVAILABLE').slice(0, 3);
    const idleWorkers = state.agents.filter(agent => agent.state === 'IDLE' && agent.type !== 'ILLEGAL_MINER').length;
    const blockedWorkers = state.agents.filter(agent => agent.statusTone === 'blocked').length;
    const activeGoal = state.activeGoal && !state.activeGoal.completed ? `${state.activeGoal.title}: ${state.activeGoal.description}` : 'No active unfinished goal.';

    return [
        '<|im_start|>system',
        'You are the local AI overseer for Aureus Eco Dominion. Give one short tactical game recommendation. Be concrete, avoid roleplay, and never claim you executed commands.',
        '<|im_end|>',
        '<|im_start|>user',
        `Tick: ${state.tickCount}. Era: ${state.currentEra}.`,
        `Resources: AGT ${Math.floor(resources.agt)}, minerals ${Math.floor(resources.minerals)}, wood ${Math.floor(resources.wood)}, stone ${Math.floor(resources.stone)}, gems ${Math.floor(resources.gems)}, eco ${Math.floor(resources.eco)}, trust ${Math.floor(resources.trust)}.`,
        `Utilities: power deficit ${Math.ceil(state.powerGrid?.deficit || 0)}, water deficit ${Math.ceil(state.waterNetwork?.deficit || 0)}.`,
        `Workforce: ${state.agents.length} agents, ${idleWorkers} idle, ${blockedWorkers} blocked, ${state.jobs.length} jobs.`,
        `Goal: ${activeGoal}`,
        `Accepted contracts: ${summarizeContracts(readyContracts)}.`,
        `Available contracts: ${summarizeContracts(availableContracts)}.`,
        'Return exactly two short lines: Focus: ... and Recommendation: ...',
        '<|im_end|>',
        '<|im_start|>assistant',
    ].join('\n');
}

export async function generateOverseerLocalInsight(state: Parameters<typeof buildOverseerLocalPrompt>[0]): Promise<OverseerLocalInsight> {
    const prompt = buildOverseerLocalPrompt(state);
    const { generator, device } = await getOverseerGenerator();
    const result = await generator(prompt, {
        max_new_tokens: OVERSEER_LOCAL_QWEN_CONFIG.maxNewTokens,
        temperature: OVERSEER_LOCAL_QWEN_CONFIG.temperature,
        top_p: OVERSEER_LOCAL_QWEN_CONFIG.topP,
        do_sample: true,
        return_full_text: false,
    });
    const rawText = normalizeGenerationText(result);
    const parsed = parseOverseerInsight(rawText);
    return {
        ...parsed,
        rawText,
        device,
        modelId: OVERSEER_LOCAL_QWEN_CONFIG.modelId,
    };
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
    return contracts.map(contract => `${contract.resource} ${contract.amount} for ${contract.reward} AGT`).join('; ');
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
