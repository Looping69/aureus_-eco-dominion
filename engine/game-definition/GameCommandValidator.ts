import type { GameActionDefinition, GameDefinition } from './types';

export interface GameCommandValidationResult {
  ok: boolean;
  action?: GameActionDefinition;
  reason?: string;
}

export interface ActiveGameDefinitionProvider {
  getActive(): GameDefinition | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasSingleFieldPrimitivePayload(payload: unknown, fields: string[]): boolean {
  return fields.length === 1 && payload !== null && payload !== undefined && !isRecord(payload);
}

function hasRequiredPayloadField(payload: unknown, field: string, fields: string[]): boolean {
  if (hasSingleFieldPrimitivePayload(payload, fields)) return true;
  if (!isRecord(payload) || !(field in payload)) return false;

  const value = payload[field];
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;

  if (['x', 'y', 'z', 'dx', 'dz', 'amount', 'cost', 'optionIndex', 'threshold', 'radius', 'damage'].includes(field)) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  if (['enabled'].includes(field)) {
    return typeof value === 'boolean';
  }

  if (typeof value === 'string') {
    return value.length > 0;
  }

  return true;
}

export function findMissingPayloadFields(action: GameActionDefinition, payload: unknown): string[] {
  return action.payloadFields.filter((field) => !hasRequiredPayloadField(payload, field, action.payloadFields));
}

export function findInvalidPayloadFields(action: GameActionDefinition, payload: unknown): string[] {
  return findMissingPayloadFields(action, payload);
}

export function findActionForCommandType(
  definition: GameDefinition | null | undefined,
  commandType: string,
): GameActionDefinition | null {
  if (!definition) return null;
  return definition.actions.find((action) => action.commandType === commandType) ?? null;
}

export function validateGameCommandType(
  definition: GameDefinition | null | undefined,
  commandType: string,
  payload?: unknown,
): GameCommandValidationResult {
  if (!definition) {
    return {
      ok: false,
      reason: 'No active game definition is registered for command validation.',
    };
  }

  const action = findActionForCommandType(definition, commandType);
  if (!action) {
    return {
      ok: false,
      reason: `Command type ${commandType} is not declared by active game definition ${definition.id}.`,
    };
  }

  if (arguments.length >= 3) {
    const missingFields = findMissingPayloadFields(action, payload);
    if (missingFields.length > 0) {
      return {
        ok: false,
        action,
        reason: `Command type ${commandType} is missing required payload field(s): ${missingFields.join(', ')}.`,
      };
    }
  }

  return { ok: true, action };
}

export function validateGameCommandForActiveDefinition(
  provider: ActiveGameDefinitionProvider | null | undefined,
  commandType: string,
  payload?: unknown,
): GameCommandValidationResult {
  if (arguments.length >= 3) {
    return validateGameCommandType(provider?.getActive() ?? null, commandType, payload);
  }
  return validateGameCommandType(provider?.getActive() ?? null, commandType);
}