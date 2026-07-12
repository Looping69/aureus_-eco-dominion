import type {
  EntityArchetypeDefinition,
  GameActionDefinition,
  GameDefinition,
  GameDefinitionId,
  GameDefinitionSummary,
  GameResourceDefinition,
  GameSystemBindingDefinition,
} from './types';
import { summarizeGameDefinition, validateGameDefinition } from './validateGameDefinition';

export class GameDefinitionRegistry {
  private readonly definitions = new Map<GameDefinitionId, GameDefinition>();
  private activeDefinitionId: GameDefinitionId | null = null;

  register(definition: GameDefinition, options: { activate?: boolean } = {}): GameDefinition {
    validateGameDefinition(definition);
    this.definitions.set(definition.id, definition);

    if (options.activate || this.activeDefinitionId === null) {
      this.activeDefinitionId = definition.id;
    }

    return definition;
  }

  has(id: GameDefinitionId): boolean {
    return this.definitions.has(id);
  }

  get(id: GameDefinitionId): GameDefinition | null {
    return this.definitions.get(id) ?? null;
  }

  list(): GameDefinitionSummary[] {
    return Array.from(this.definitions.values()).map((definition) => summarizeGameDefinition(definition));
  }

  setActive(id: GameDefinitionId): GameDefinition {
    const definition = this.get(id);
    if (!definition) {
      throw new Error(`Unknown game definition: ${id}`);
    }

    this.activeDefinitionId = id;
    return definition;
  }

  getActive(): GameDefinition | null {
    if (!this.activeDefinitionId) {
      return null;
    }

    return this.get(this.activeDefinitionId);
  }

  getActiveSummary(): GameDefinitionSummary | null {
    const activeDefinition = this.getActive();
    return activeDefinition ? summarizeGameDefinition(activeDefinition) : null;
  }

  getResource(id: string): GameResourceDefinition | null {
    return this.getActive()?.resources.find((resource) => resource.id === id) ?? null;
  }

  getEntityArchetype(id: string): EntityArchetypeDefinition | null {
    return this.getActive()?.entityArchetypes.find((archetype) => archetype.id === id) ?? null;
  }

  getAction(id: string): GameActionDefinition | null {
    return this.getActive()?.actions.find((action) => action.id === id) ?? null;
  }

  getSystem(id: string): GameSystemBindingDefinition | null {
    return this.getActive()?.systems.find((system) => system.id === id) ?? null;
  }

  clear(): void {
    this.definitions.clear();
    this.activeDefinitionId = null;
  }
}

export function createGameDefinitionRegistry(definitions: GameDefinition[] = []): GameDefinitionRegistry {
  const registry = new GameDefinitionRegistry();
  definitions.forEach((definition, index) => registry.register(definition, { activate: index === 0 }));
  return registry;
}
