export type {
    ActionCategory,
    ActionTarget,
    EntityArchetypeDefinition,
    EntityCategory,
    GameActionDefinition,
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
