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
    GameDefinitionValidationError,
    collectGameDefinitionIssues,
    defineGameDefinition,
    summarizeGameDefinition,
    validateGameDefinition,
} from './validateGameDefinition';
export type { GameDefinitionValidationIssue } from './validateGameDefinition';
