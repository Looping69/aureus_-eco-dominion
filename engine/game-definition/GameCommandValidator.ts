import type { GameActionDefinition, GameDefinition } from './types';

export interface GameCommandValidationResult {
  ok: boolean;
  action?: GameActionDefinition;
  reason?: string;
}

export interface ActiveGameDefinitionProvider {
  getActive(): GameDefinition | null;
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

  return { ok: true, action };
}

export function validateGameCommandForActiveDefinition(
  provider: ActiveGameDefinitionProvider | null | undefined,
  commandType: string,
): GameCommandValidationResult {
  return validateGameCommandType(provider?.getActive() ?? null, commandType);
}
