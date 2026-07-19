export type {
    ActionCategory,
    ActionTarget,
    EntityArchetypeDefinition,
    EntityCategory,
    GameActionDefinition,
    GameActionPayloadFieldDefinition,
    GameActionPayloadFieldType,
    GameActionPayloadOptionSource,
    GameActionPayloadSchema,
    GameDefinition,
    GameDefinitionId,
    GameDefinitionSummary,
    GameDefinitionVersion,
    GameResourceDefinition,
    GameSystemBindingDefinition,
    ResourceKind,
} from './types';

export {
    findActionForCommandType,
    findInvalidPayloadFields,
    findMissingPayloadFields,
    validateGameCommandForActiveDefinition,
    validateGameCommandType,
} from './GameCommandValidator';
export type { ActiveGameDefinitionProvider, GameCommandValidationResult } from './GameCommandValidator';

export {
    GameDefinitionValidationError,
    collectGameDefinitionIssues,
    defineGameDefinition,
    summarizeGameDefinition,
    validateGameDefinition,
} from './validateGameDefinition';
export type { GameDefinitionValidationIssue } from './validateGameDefinition';