import type { GameDefinition, GameDefinitionSummary } from './types';

export interface GameDefinitionValidationIssue {
    path: string;
    message: string;
}

export class GameDefinitionValidationError extends Error {
    readonly issues: GameDefinitionValidationIssue[];

    constructor(issues: GameDefinitionValidationIssue[]) {
        super(`Invalid game definition: ${issues.map((issue) => `${issue.path} ${issue.message}`).join('; ')}`);
        this.name = 'GameDefinitionValidationError';
        this.issues = issues;
    }
}

function requireNonEmptyString(value: unknown, path: string, issues: GameDefinitionValidationIssue[]): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
        issues.push({ path, message: 'must be a non-empty string' });
    }
}

function requireStringArray(value: unknown, path: string, issues: GameDefinitionValidationIssue[]): void {
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
        issues.push({ path, message: 'must be an array of non-empty strings' });
    }
}

function requireUniqueIds(entries: Array<{ id: string }>, path: string, issues: GameDefinitionValidationIssue[]): void {
    const seen = new Set<string>();
    for (const entry of entries) {
        if (seen.has(entry.id)) {
            issues.push({ path, message: `contains duplicate id '${entry.id}'` });
        }
        seen.add(entry.id);
    }
}

function validateNumbers(definition: GameDefinition, issues: GameDefinitionValidationIssue[]): void {
    definition.resources.forEach((resource, index) => {
        for (const field of ['initial', 'min', 'max'] as const) {
            const value = resource[field];
            if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
                issues.push({ path: `resources[${index}].${field}`, message: 'must be a finite number when provided' });
            }
        }
        if (resource.min !== undefined && resource.max !== undefined && resource.min > resource.max) {
            issues.push({ path: `resources[${index}]`, message: 'min cannot be greater than max' });
        }
    });
}

export function collectGameDefinitionIssues(definition: GameDefinition): GameDefinitionValidationIssue[] {
    const issues: GameDefinitionValidationIssue[] = [];

    requireNonEmptyString(definition.id, 'id', issues);
    requireNonEmptyString(definition.title, 'title', issues);
    requireNonEmptyString(definition.version, 'version', issues);
    requireNonEmptyString(definition.description, 'description', issues);
    requireStringArray(definition.genreTags, 'genreTags', issues);
    requireStringArray(definition.engineCapabilities, 'engineCapabilities', issues);

    for (const [path, entries] of [
        ['resources', definition.resources],
        ['entityArchetypes', definition.entityArchetypes],
        ['actions', definition.actions],
        ['systems', definition.systems],
    ] as const) {
        if (!Array.isArray(entries) || entries.length === 0) {
            issues.push({ path, message: 'must contain at least one entry' });
            continue;
        }
        entries.forEach((entry, index) => requireNonEmptyString(entry.id, `${path}[${index}].id`, issues));
        requireUniqueIds(entries, path, issues);
    }

    definition.resources.forEach((resource, index) => {
        requireNonEmptyString(resource.label, `resources[${index}].label`, issues);
        requireNonEmptyString(resource.kind, `resources[${index}].kind`, issues);
        if (resource.capacityResourceId && !definition.resources.some((candidate) => candidate.id === resource.capacityResourceId)) {
            issues.push({ path: `resources[${index}].capacityResourceId`, message: `references unknown resource '${resource.capacityResourceId}'` });
        }
    });

    definition.entityArchetypes.forEach((entity, index) => {
        requireNonEmptyString(entity.label, `entityArchetypes[${index}].label`, issues);
        requireNonEmptyString(entity.category, `entityArchetypes[${index}].category`, issues);
        requireStringArray(entity.tags, `entityArchetypes[${index}].tags`, issues);
        if (!entity.components || typeof entity.components !== 'object' || Array.isArray(entity.components)) {
            issues.push({ path: `entityArchetypes[${index}].components`, message: 'must be an object' });
        }
    });

    definition.actions.forEach((action, index) => {
        requireNonEmptyString(action.label, `actions[${index}].label`, issues);
        requireNonEmptyString(action.category, `actions[${index}].category`, issues);
        requireNonEmptyString(action.commandType, `actions[${index}].commandType`, issues);
        requireNonEmptyString(action.target, `actions[${index}].target`, issues);
        requireStringArray(action.payloadFields, `actions[${index}].payloadFields`, issues);
    });

    definition.systems.forEach((system, index) => {
        requireNonEmptyString(system.label, `systems[${index}].label`, issues);
        requireNonEmptyString(system.module, `systems[${index}].module`, issues);
        requireStringArray(system.reads, `systems[${index}].reads`, issues);
        requireStringArray(system.writes, `systems[${index}].writes`, issues);
    });

    validateNumbers(definition, issues);
    return issues;
}

export function validateGameDefinition(definition: GameDefinition): GameDefinition {
    const issues = collectGameDefinitionIssues(definition);
    if (issues.length > 0) {
        throw new GameDefinitionValidationError(issues);
    }
    return definition;
}

export function defineGameDefinition(definition: GameDefinition): GameDefinition {
    return validateGameDefinition(definition);
}

export function summarizeGameDefinition(definition: GameDefinition): GameDefinitionSummary {
    validateGameDefinition(definition);
    return {
        id: definition.id,
        title: definition.title,
        version: definition.version,
        resourceCount: definition.resources.length,
        entityCount: definition.entityArchetypes.length,
        actionCount: definition.actions.length,
        systemCount: definition.systems.length,
        genreTags: [...definition.genreTags],
    };
}