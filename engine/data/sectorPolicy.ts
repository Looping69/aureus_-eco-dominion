import type { GameActionDefinition } from '../game-definition/types';
import type {
    FactoryResourceType,
    FactorySectorCongestionMode,
    FactorySectorDirective,
    FactorySectorFlowMode,
    FactorySectorState,
} from '../types/game';

export type SectorPolicyPayload = { sectorName: string } & Partial<Pick<
    FactorySectorState,
    'directive' | 'priorityResource' | 'flowMode' | 'congestionPolicy' | 'contractResource' | 'contractTarget'
>>;

const resources: FactoryResourceType[] = [
    'ORE', 'CONCENTRATE', 'MINERALS', 'WOOD', 'STONE', 'GEMS',
    'REFINED_MATERIALS', 'ALLOYS', 'MACHINE_PARTS', 'AUTOMATION_KITS',
];

// Schema-driven tools and simulation validation share the same allowed policy values.
export const SECTOR_POLICY_OPTIONS = {
    directive: ['BALANCED', 'EXPORT', 'IMPORT'] satisfies FactorySectorDirective[],
    priorityResource: resources,
    flowMode: ['STABLE', 'SURGE'] satisfies FactorySectorFlowMode[],
    congestionPolicy: ['SAFE', 'BALANCED', 'AGGRESSIVE'] satisfies FactorySectorCongestionMode[],
    contractResource: resources,
};

export const SECTOR_POLICY_PAYLOAD_SCHEMA: NonNullable<GameActionDefinition['payloadSchema']> = {
    sectorName: { type: 'string', required: true, description: 'Existing factory sector name.' },
    directive: { type: 'string', required: false, options: SECTOR_POLICY_OPTIONS.directive, description: 'Sector dispatch directive.' },
    priorityResource: { type: 'string', required: false, options: SECTOR_POLICY_OPTIONS.priorityResource, description: 'Resource prioritised by the sector.' },
    flowMode: { type: 'string', required: false, options: SECTOR_POLICY_OPTIONS.flowMode, description: 'Sector throughput mode.' },
    congestionPolicy: { type: 'string', required: false, options: SECTOR_POLICY_OPTIONS.congestionPolicy, description: 'Sector congestion policy.' },
    contractResource: { type: 'string', required: false, options: SECTOR_POLICY_OPTIONS.contractResource, description: 'Resource required by the sector quota.' },
    contractTarget: { type: 'number', required: false, description: 'Positive finite sector quota target.' },
};
