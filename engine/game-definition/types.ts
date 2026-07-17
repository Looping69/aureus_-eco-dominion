export type GameDefinitionId = string;
export type GameDefinitionVersion = string;

export type ResourceKind = 'currency' | 'material' | 'reputation' | 'capacity' | 'derived';
export type EntityCategory = 'agent' | 'building' | 'terrain' | 'item' | 'projectile' | 'effect' | 'ui' | 'world';
export type ActionCategory = 'build' | 'move' | 'combat' | 'economy' | 'research' | 'dialogue' | 'world' | 'debug';
export type ActionTarget = 'none' | 'tile' | 'agent' | 'entity' | 'resource' | 'screen';
export type GameActionPayloadFieldType = 'string' | 'number' | 'boolean' | 'string[]' | 'number[]' | 'object' | 'any';

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

export interface GameActionPayloadFieldDefinition {
    type: GameActionPayloadFieldType;
    required?: boolean;
    allowPrimitive?: boolean;
    values?: string[];
    description?: string;
}

export type GameActionPayloadSchema = Record<string, GameActionPayloadFieldDefinition>;

export interface GameActionDefinition {
    id: string;
    label: string;
    category: ActionCategory;
    commandType: string;
    target: ActionTarget;
    payloadFields: string[];
    payloadSchema?: GameActionPayloadSchema;
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