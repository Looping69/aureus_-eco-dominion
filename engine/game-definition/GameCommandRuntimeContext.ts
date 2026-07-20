import type { GameCommandValidationContext } from './GameCommandValidator';

export type GameCommandRuntimeStateSnapshot = Record<string, any> | null;

export interface RuntimeAgentOption {
  value: string;
  label: string;
}

export function getBrowserRuntimeStateSnapshot(): GameCommandRuntimeStateSnapshot {
  if (typeof window === 'undefined') return null;

  const runtimeWindow = window as typeof window & { __aureusGetState?: () => unknown };
  try {
    const state = runtimeWindow.__aureusGetState?.();
    return typeof state === 'object' && state !== null ? state as Record<string, any> : null;
  } catch {
    return null;
  }
}

export function getRuntimeAgentOptions(state: GameCommandRuntimeStateSnapshot): RuntimeAgentOption[] {
  const agents = [...(state?.agents || []), ...(state?.ambientNpcs || [])];
  return agents
    .filter((agent: any) => typeof agent?.id === 'string')
    .map((agent: any) => ({
      value: agent.id,
      label: agent.name || agent.role || agent.type || agent.id,
    }));
}

export function getRuntimeSelectedAgentIds(state: GameCommandRuntimeStateSnapshot): string[] {
  const selectedAgentIds = Array.isArray(state?.selectedAgentIds) ? state.selectedAgentIds : [];
  const selectedAgentId = typeof state?.selectedAgentId === 'string' ? [state.selectedAgentId] : [];
  return Array.from(new Set([...selectedAgentIds, ...selectedAgentId]))
    .filter((agentId): agentId is string => typeof agentId === 'string' && agentId.length > 0);
}

export function getSelectedTileNumber(state: GameCommandRuntimeStateSnapshot, field: string): number | null {
  const candidates = [
    state?.selectedTilePos,
    state?.pinnedTilePos,
    state?.hoverTilePos,
    state?.selectedTile,
  ];

  for (const candidate of candidates) {
    const value = candidate?.[field];
    if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  }

  return null;
}

export function getSelectedTileDefault(state: GameCommandRuntimeStateSnapshot, field: string): string | null {
  const value = getSelectedTileNumber(state, field);
  return value === null ? null : String(value);
}

export function getActiveLayerNumber(state: GameCommandRuntimeStateSnapshot): number | null {
  const activeY = state?.layeredWorld?.activeY;
  return typeof activeY === 'number' && Number.isFinite(activeY) ? activeY : null;
}

export function buildGameCommandValidationContext(state: GameCommandRuntimeStateSnapshot): GameCommandValidationContext {
  const runtimeAgentIds = getRuntimeAgentOptions(state).map((agent) => agent.value);
  const selectedAgentIds = getRuntimeSelectedAgentIds(state);
  const selectedTileX = getSelectedTileNumber(state, 'x');
  const selectedTileZ = getSelectedTileNumber(state, 'z');
  const activeLayerY = getActiveLayerNumber(state);

  return {
    optionValues: {
      'runtime.agents': runtimeAgentIds,
      'runtime.selectedAgents': selectedAgentIds,
    },
    payloadFieldValues: {
      'runtime.selectedTile': {
        x: selectedTileX === null ? [] : [selectedTileX],
        z: selectedTileZ === null ? [] : [selectedTileZ],
      },
      'runtime.activeLayer': {
        y: activeLayerY === null ? [] : [activeLayerY],
      },
    },
  };
}
