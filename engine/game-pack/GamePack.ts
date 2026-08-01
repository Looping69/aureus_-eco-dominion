import type { GameDefinition, GameDefinitionId, GameDefinitionSummary } from '../game-definition';
import { summarizeGameDefinition, validateGameDefinition } from '../game-definition';

export type GamePackId = GameDefinitionId;

export interface GamePackRuntimeDefinition {
  worldModule: string;
  stateModule?: string;
  uiModule?: string;
}

export interface GamePack {
  id: GamePackId;
  title: string;
  version: string;
  description: string;
  genreTags: string[];
  definition: GameDefinition;
  runtime: GamePackRuntimeDefinition;
}

export interface GamePackSummary {
  id: GamePackId;
  title: string;
  version: string;
  description: string;
  genreTags: string[];
  definition: GameDefinitionSummary;
  runtime: GamePackRuntimeDefinition;
}

export function defineGamePack(pack: GamePack): GamePack {
  validateGameDefinition(pack.definition);

  if (pack.id !== pack.definition.id) {
    throw new Error(`Game pack id '${pack.id}' must match definition id '${pack.definition.id}'`);
  }

  if (pack.title !== pack.definition.title) {
    throw new Error(`Game pack title '${pack.title}' must match definition title '${pack.definition.title}'`);
  }

  if (pack.version !== pack.definition.version) {
    throw new Error(`Game pack version '${pack.version}' must match definition version '${pack.definition.version}'`);
  }

  if (pack.description.trim().length === 0) {
    throw new Error(`Game pack '${pack.id}' must include a description`);
  }

  if (!Array.isArray(pack.genreTags) || pack.genreTags.length === 0) {
    throw new Error(`Game pack '${pack.id}' must include at least one genre tag`);
  }

  if (!pack.runtime.worldModule || pack.runtime.worldModule.trim().length === 0) {
    throw new Error(`Game pack '${pack.id}' must declare a world runtime module`);
  }

  return pack;
}

export function summarizeGamePack(pack: GamePack): GamePackSummary {
  const validatedPack = defineGamePack(pack);

  return {
    id: validatedPack.id,
    title: validatedPack.title,
    version: validatedPack.version,
    description: validatedPack.description,
    genreTags: [...validatedPack.genreTags],
    definition: summarizeGameDefinition(validatedPack.definition),
    runtime: { ...validatedPack.runtime },
  };
}

export class GamePackRegistry {
  private readonly packs = new Map<GamePackId, GamePack>();
  private activePackId: GamePackId | null = null;

  register(pack: GamePack, options: { activate?: boolean } = {}): GamePack {
    const validatedPack = defineGamePack(pack);
    this.packs.set(validatedPack.id, validatedPack);

    if (options.activate || this.activePackId === null) {
      this.activePackId = validatedPack.id;
    }

    return validatedPack;
  }

  has(id: GamePackId): boolean {
    return this.packs.has(id);
  }

  get(id: GamePackId): GamePack | null {
    return this.packs.get(id) ?? null;
  }

  list(): GamePackSummary[] {
    return Array.from(this.packs.values()).map((pack) => summarizeGamePack(pack));
  }

  setActive(id: GamePackId): GamePack {
    const pack = this.get(id);
    if (!pack) {
      throw new Error(`Unknown game pack: ${id}`);
    }

    this.activePackId = id;
    return pack;
  }

  getActive(): GamePack | null {
    if (!this.activePackId) {
      return null;
    }

    return this.get(this.activePackId);
  }

  getActiveSummary(): GamePackSummary | null {
    const activePack = this.getActive();
    return activePack ? summarizeGamePack(activePack) : null;
  }

  getActiveDefinition(): GameDefinition | null {
    return this.getActive()?.definition ?? null;
  }

  getActiveDefinitionSummary(): GameDefinitionSummary | null {
    return this.getActiveSummary()?.definition ?? null;
  }

  clear(): void {
    this.packs.clear();
    this.activePackId = null;
  }
}

export function createGamePackRegistry(packs: GamePack[] = []): GamePackRegistry {
  const registry = new GamePackRegistry();
  packs.forEach((pack, index) => registry.register(pack, { activate: index === 0 }));
  return registry;
}
