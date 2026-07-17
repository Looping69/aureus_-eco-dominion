import type { GameActionDefinition, GameActionPayloadFieldDefinition, GameDefinition } from './types';

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

function actionHasPayloadSchema(action: GameActionDefinition): boolean {
  return Boolean(action.payloadSchema && Object.keys(action.payloadSchema).length > 0);
}

function getPayloadFieldSchema(action: GameActionDefinition, field: string): GameActionPayloadFieldDefinition | null {
  return action.payloadSchema?.[field] ?? null;
}

function getSchemaPayloadFieldValue(
  action: GameActionDefinition,
  payload: unknown,
  field: string,
): { present: boolean; value: unknown } {
  const schema = getPayloadFieldSchema(action, field);

  if (action.payloadFields.length === 1 && schema?.allowPrimitive && payload !== null && payload !== undefined && !isRecord(payload)) {
    return { present: true, value: payload };
  }

  if (!isRecord(payload) || !(field in payload)) {
    return { present: false, value: undefined };
  }

  return { present: true, value: payload[field] };
}

function matchesPayloadFieldSchema(schema: GameActionPayloadFieldDefinition, value: unknown): boolean {
  if (value === null || value === undefined) return schema.required === false;

  switch (schema.type) {
    case 'string':
      return typeof value === 'string' && value.length > 0;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'string[]':
      return Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === 'string' && entry.length > 0);
    case 'number[]':
      return Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));
    case 'object':
      return isRecord(value);
    case 'any':
      return true;
    default:
      return false;
  }
}

function hasLegacyRequiredPayloadField(payload: unknown, field: string, fields: string[]): boolean {
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

function hasSchemaRequiredPayloadField(action: GameActionDefinition, payload: unknown, field: string): boolean {
  const schema = getPayloadFieldSchema(action, field);
  if (!schema) return false;
  if (schema.required === false) return true;

  const { present, value } = getSchemaPayloadFieldValue(action, payload, field);
  if (!present || value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.length > 0;

  return true;
}

export function findMissingPayloadFields(action: GameActionDefinition, payload: unknown): string[] {
  if (actionHasPayloadSchema(action)) {
    return action.payloadFields.filter((field) => !hasSchemaRequiredPayloadField(action, payload, field));
  }
  return action.payloadFields.filter((field) => !hasLegacyRequiredPayloadField(payload, field, action.payloadFields));
}

export function findInvalidPayloadFields(action: GameActionDefinition, payload: unknown): string[] {
  if (!actionHasPayloadSchema(action)) return [];

  return action.payloadFields.filter((field) => {
    if (!hasSchemaRequiredPayloadField(action, payload, field)) return false;
    const schema = getPayloadFieldSchema(action, field);
    if (!schema) return true;
    const { present, value } = getSchemaPayloadFieldValue(action, payload, field);
    if (!present && schema.required === false) return false;
    return !matchesPayloadFieldSchema(schema, value);
  });
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

    const invalidFields = findInvalidPayloadFields(action, payload);
    if (invalidFields.length > 0) {
      return {
        ok: false,
        action,
        reason: `Command type ${commandType} has invalid payload field(s): ${invalidFields.join(', ')}.`,
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