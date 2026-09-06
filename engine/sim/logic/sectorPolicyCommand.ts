import { SECTOR_POLICY_OPTIONS, SECTOR_POLICY_PAYLOAD_SCHEMA, type SectorPolicyPayload } from '../../data/sectorPolicy.ts';
import type { FactorySectorState } from '../../types/game';

export type SectorPolicyResult = { ok: true } | { ok: false; reason: string };

/** Validate the complete patch before changing any sector. Called during command dispatch. */
export function applySectorPolicyCommand(sectors: FactorySectorState[] | undefined, payload: unknown): SectorPolicyResult {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { ok: false, reason: 'Sector policy payload must be an object.' };
    }
    const input = payload as Record<string, unknown>;
    if (typeof input.sectorName !== 'string' || input.sectorName.trim().length === 0) {
        return { ok: false, reason: 'Sector policy requires a sector name.' };
    }
    const index = sectors?.findIndex(sector => sector.name === input.sectorName) ?? -1;
    if (!sectors || index < 0) {
        return { ok: false, reason: 'Factory sector not found.' };
    }

    for (const key of Object.keys(input)) {
        if (!Object.prototype.hasOwnProperty.call(SECTOR_POLICY_PAYLOAD_SCHEMA, key)) {
            return { ok: false, reason: `Unknown sector policy field: ${key}.` };
        }
    }
    for (const key of Object.keys(SECTOR_POLICY_OPTIONS) as Array<keyof typeof SECTOR_POLICY_OPTIONS>) {
        const value = input[key];
        // Preserve existing nullish-patch behavior: omitted/null values retain the prior policy.
        if (value === undefined || value === null) continue;
        const allowed: readonly string[] = SECTOR_POLICY_OPTIONS[key];
        if (typeof value !== 'string' || !allowed.includes(value)) {
            return { ok: false, reason: `Invalid sector policy ${key}.` };
        }
    }
    if (input.contractTarget !== undefined && input.contractTarget !== null) {
        if (typeof input.contractTarget !== 'number' || !Number.isFinite(input.contractTarget) || input.contractTarget <= 0) {
            return { ok: false, reason: 'Sector quota target must be a positive finite number.' };
        }
    }

    const policy = input as SectorPolicyPayload;
    const sector = sectors[index];
    sectors[index] = {
        ...sector,
        directive: policy.directive ?? sector.directive ?? 'BALANCED',
        priorityResource: policy.priorityResource ?? sector.priorityResource ?? sector.exportFocus,
        flowMode: policy.flowMode ?? sector.flowMode ?? 'STABLE',
        congestionPolicy: policy.congestionPolicy ?? sector.congestionPolicy ?? 'BALANCED',
        contractResource: policy.contractResource ?? sector.contractResource ?? sector.importFocus,
        contractTarget: policy.contractTarget ?? sector.contractTarget ?? 24,
    };
    return { ok: true };
}
