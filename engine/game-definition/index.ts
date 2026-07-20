export type {
    ActionCategory,
    ActionTarget,
    EntityArchetypeDefinition,
    EntityCategory,
    GameActionDefinition,
    GameActionPayloadFieldDefinition,
    GameActionPayloadFieldType,
    GameActionPayloadOptionSource,
    GameActionPayloadOptionValue,
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
    buildGameCommandValidationContext,
    getActiveLayerNumber,
    getBrowserRuntimeStateSnapshot,
    getRuntimeAgentOptions,
    getRuntimeSelectedAgentIds,
    getSelectedTileDefault,
    getSelectedTileNumber,
} from './GameCommandRuntimeContext';
export type { GameCommandRuntimeStateSnapshot, RuntimeAgentOption } from './GameCommandRuntimeContext';

export {
    createGameCommandCandidate,
    createGameCommandCandidateEnvelope,
    createGameCommandCandidateId,
    GAME_COMMAND_CANDIDATE_SOURCES,
    isValidGameCommandCandidate,
    validateGameCommandCandidate,
} from './GameCommandCandidate';
export type { GameCommandCandidate, GameCommandCandidateEnvelope, GameCommandCandidateSource, GameCommandCandidateValidationResult } from './GameCommandCandidate';

export {
    findActionForCommandType,
    findInvalidPayloadFields,
    findMissingPayloadFields,
    validateGameCommandForActiveDefinition,
    validateGameCommandType,
} from './GameCommandValidator';
export type { ActiveGameDefinitionProvider, GameCommandValidationContext, GameCommandValidationResult } from './GameCommandValidator';

export {
    GameDefinitionValidationError,
    collectGameDefinitionIssues,
    defineGameDefinition,
    summarizeGameDefinition,
    validateGameDefinition,
} from './validateGameDefinition';
export type { GameDefinitionValidationIssue } from './validateGameDefinition';
