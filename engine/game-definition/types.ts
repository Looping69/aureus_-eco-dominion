export type GameDefinitionId = string;
export type GameDefinitionVersion = string;

export type ResourceKind = 'currency' | 'material' | 'reputation' | 'capacity' | 'derived';
export type EntityCategory = 'agent' | 'building' | 'terrain' | 'item' | 'projectile' | 'effect' | 'ui' | 'world';
export type ActionCategory = 'build' | 'move' | 'combat' | 'economy' | 'research' | 'dialogue' | 'world' | 'debug';
export type ActionTarget = 'none' | 'tile' | 'agent' | 'entity' | 'resource' | 'screen';

export interface GameResourceDefinition {
    id: string;
    label: string;
    kind: ResourceKind;
    initial?: number;
    min?: number;
    max?: number;
    capacityResourceId?: string;
    tradeable?: boolean;
    description?: string;
}

export interface EntityArchetypeDefinition {
    id: string;
    label: string;
    category: EntityCategory;
    tags: string[];
    components: Record<string, unknown>;
    description?: string;
}

export interface GameActionDefinition {
    id: string;
    label: string;
    category: ActionCategory;
    commandType: string;
    target: ActionTarget;
    payloadFields: string[];
    description?: string;
}

export interface GameSystemBindingDefinition {
    id: string;
    label: string;
    module: string;
    reads: string[];
    writes: string[];
    description?: string;
}

export interface GameDefinition {
    id: GameDefinitionId;
    title: string;
    version: GameDefinitionVersion;
    description: string;
    genreTags: string[];
    engineCapabilities: string[];
    resources: GameResourceDefinition[];
    entityArchetypes: EntityArchetypeDefinition[];
    actions: GameActionDefinition[];
    systems: GameSystemBindingDefinition[];
}

export interface GameDefinitionSummary {
    id: GameDefinitionId;
    title: string;
    version: GameDefinitionVersion;
    resourceCount: number;
    entityCount: number;
    actionCount: number;
    systemCount: number;
    genreTags: string[];
}
