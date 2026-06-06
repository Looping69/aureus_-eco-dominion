
import { BuildingType } from './buildings';
import { Agent, AgentRequest, Job } from './agents';
import { GridTile, WeatherState, WeatherType, Chunk } from './world';
import { GameResources, MarketState, Contract } from './economy';
import { DungeonState } from '../dungeon/DungeonTypes';
import { BureaucracyState } from './bureaucracy';
import { DayNightCycleState } from '../sim/dayNightCycle';
import { UndergroundState } from './underground';

export enum Era {
    SETTLEMENT = 'SETTLEMENT',
    GROWTH = 'GROWTH',
    INDUSTRY = 'INDUSTRY',
    SUSTAINABILITY = 'SUSTAINABILITY',
    PROSPERITY = 'PROSPERITY'
}

export interface EraDef {
    id: Era;
    name: string;
    description: string;
    unlockConditions: {
        minColonists?: number;
        minAgt?: number;
        minEco?: number;
        minTrust?: number;
        minBuildings?: number;
        tutorialComplete?: boolean;
    };
    color: string;
    milestones?: { id: string; name: string; target: number }[];
}

export interface Goal {
    id: string;
    title: string;
    description: string;
    type: 'BUILD' | 'RESOURCE' | 'STAT';
    targetType: BuildingType | 'AGT' | 'MINERALS' | 'ECO' | 'TRUST' | 'GEMS';
    targetValue: number;
    currentValue: number;
    reward: { type: 'AGT' | 'GEMS', amount: number };
    completed: boolean;
}

export interface NewsItem {
    id: string;
    headline: string;
    type: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'CRITICAL';
    timestamp: number;
}

export interface GlobalEvent {
    id: string;
    name: string;
    type: 'WEATHER' | 'ECONOMIC' | 'GEOLOGICAL' | 'SOCIAL' | 'INCURSION';
    duration: number;
    description: string;
    visualTheme?: 'NORMAL' | 'GOLDEN';
    weatherOverride?: WeatherType;
    modifiers?: {
        productionMult?: number;
        sellPriceMult?: number;
        upkeepMult?: number;
        ecoRegenMult?: number;
        trustGainMult?: number;
        energyDecayMult?: number;
    };
}

export type TechId =
    | 'ADVANCED_DRILLING' | 'MARKET_ANALYTICS' | 'AUTOMATION'
    | 'PHOTOVOLTAICS' | 'WATER_RECYCLING' | 'CARBON_CAPTURE'
    | 'COMMUNITY_OUTREACH' | 'NEIGHBORHOOD_WATCH' | 'EDUCATION_REFORM';

export interface TechDefinition {
    id: TechId;
    name: string;
    description: string;
    cost: number;
    category: 'INDUSTRIAL' | 'ECOLOGICAL' | 'SOCIAL';
    prereq: TechId | null;
    effectDesc: string;
}

export interface ResearchState {
    unlocked: TechId[];
}

export enum GameStep {
    INTRO = 'INTRO',
    TUTORIAL_NAV = 'TUTORIAL_NAV',
    TUTORIAL_MINE = 'TUTORIAL_MINE',
    TUTORIAL_SELL = 'TUTORIAL_SELL',
    TUTORIAL_BUY = 'TUTORIAL_BUY',
    TUTORIAL_PLACE = 'TUTORIAL_PLACE',
    TUTORIAL_NEEDS = 'TUTORIAL_NEEDS',
    TUTORIAL_POWER = 'TUTORIAL_POWER',
    TUTORIAL_UNDERGROUND = 'TUTORIAL_UNDERGROUND',
    TUTORIAL_RESEARCH = 'TUTORIAL_RESEARCH',
    TUTORIAL_ERA = 'TUTORIAL_ERA',
    DEMO = 'DEMO',
    PLAYING = 'PLAYING',
    GAME_OVER = 'GAME_OVER',
    VICTORY = 'VICTORY'
}

export enum SfxType {
    BUILD = 'BUILD',
    BUILD_START = 'BUILD_START',
    BULLDOZE = 'BULLDOZE',
    SELL = 'SELL',
    COMPLETE = 'COMPLETE',
    ERROR = 'ERROR',
    UI_CLICK = 'UI_CLICK',
    UI_OPEN = 'UI_OPEN',
    UI_COIN = 'UI_COIN',
    CONSTRUCT_SPEEDUP = 'CONSTRUCT_SPEEDUP',
    MINING_HIT = 'MINING_HIT',
    CAMP_BUILD = 'CAMP_BUILD',
    CAMP_RUSTLE = 'CAMP_RUSTLE',
    DEATH = 'DEATH',
    ALARM = 'ALARM'
}

export type GameDiff =
    | { type: 'CHUNK_UPDATE', cx: number, cz: number, updates: GridTile[] }
    | { type: 'FX', fxType: 'MINING' | 'THEFT' | 'ECO_REHAB' | 'DEATH' | 'SMOKE' | 'DUST' | 'FARM', x: number, z: number };

export type SimulationEffect =
    | GameDiff
    | { type: 'AUDIO', sfx: SfxType };

export interface GameCommand {
    id: string;
    type: 'PLACE_BUILDING' | 'BULLDOZE' | 'SPEED_UP' | 'REHABILITATE' | 'UPGRADE_BUILDING' | 'EXPLODE_TILE' | 'COMMAND_AGENT' | 'MANUAL_MOVE_AGENT' | 'BUY_BUILDING' | 'SELL_RESOURCE' | 'BUY_RESOURCE' | 'SET_AUTO_SELL' | 'MARK_HARVEST' | 'RESEARCH_TECH' | 'ACCEPT_CONTRACT' | 'DELIVER_CONTRACT' | 'ABANDON_CONTRACT' | 'ADVANCE_TUTORIAL' | 'START_DEMO' | 'DISMISS_POPUP' | 'SUBMIT_PERMIT' | 'TALK_TO_NPC' | 'CHOOSE_DIALOGUE' | 'CLOSE_DIALOGUE';
    payload: any;
    issuedAtTick?: number;
}

export type LogisticsOverlayMode = 'OFF' | 'FLOW' | 'CONGESTION' | 'JUNCTIONS';
export type FactoryResourceType =
    | 'ORE'
    | 'CONCENTRATE'
    | 'MINERALS'
    | 'WOOD'
    | 'STONE'
    | 'GEMS'
    | 'REFINED_MATERIALS'
    | 'ALLOYS'
    | 'MACHINE_PARTS'
    | 'AUTOMATION_KITS';
export type FactoryPacketTransportMode = 'BELT' | 'RAIL' | 'DRONE';
export type FactorySectorDirective = 'BALANCED' | 'EXPORT' | 'IMPORT';
export type FactorySectorFlowMode = 'STABLE' | 'SURGE';
export type FactorySectorCongestionMode = 'SAFE' | 'BALANCED' | 'AGGRESSIVE';
export type FactoryPressureReason = 'ROUTE_DEBT' | 'UNDERFED' | 'CONGESTION';
export type FactoryCorridorTrend = 'UP' | 'DOWN' | 'FLAT';

export interface FactorySectorState {
    name: string;
    exportFocus: FactoryResourceType;
    importFocus: FactoryResourceType;
    exportResource?: FactoryResourceType;
    importResource?: FactoryResourceType;
    exportBonus: number;
    importDiscount: number;
    demandBonus: number;
    stationCount: number;
    throughput: number;
    directive?: FactorySectorDirective;
    priorityResource?: FactoryResourceType;
    flowMode?: FactorySectorFlowMode;
    congestionPolicy?: FactorySectorCongestionMode;
    congestionLevel?: number;
    droneLoad?: number;
    exportPremium?: number;
    contractResource?: FactoryResourceType;
    contractTarget?: number;
    contractProgress?: number;
    contractReward?: number;
    satisfaction?: number;
    bonusChain?: number;
    missedQuotaTicks?: number;
}

export interface FactoryPressurePoint {
    key: string;
    buildingType: BuildingType;
    reason: FactoryPressureReason;
    severity: number;
    detail: string;
    resource?: FactoryResourceType;
    sectorName?: string;
}

export interface FactoryPlannerRecommendation {
    id: string;
    title: string;
    label?: string;
    detail: string;
    reason: FactoryPressureReason;
    severity: number;
    targetKey?: string;
    sectorName?: string;
    resource?: FactoryResourceType;
    suggestedBuilding?: BuildingType;
}

export interface FactoryCorridorState {
    id: string;
    sectorName: string;
    anchorKey: string;
    throughput: number;
    baselineThroughput: number;
    history: number[];
    trend: FactoryCorridorTrend;
    improvement: number;
    routeDebtShare: number;
    pinned?: boolean;
}

export interface FactoryNodeState {
    id: string;
    x: number;
    z: number;
    buildingType: BuildingType;
    role: 'SOURCE' | 'PROCESSOR' | 'SINK' | 'TRANSPORT' | 'STATION' | 'JUNCTION';
    acceptedInputs: FactoryResourceType[];
    producedOutputs: FactoryResourceType[];
    buffer: Partial<Record<FactoryResourceType, number>>;
    capacity: number;
    congestion: number;
    throughput: number;
    sectorName?: string;
}

export interface FactoryPacketState {
    id: string;
    from: string;
    to: string;
    x: number;
    z: number;
    progress: number;
    resource: FactoryResourceType;
    amount: number;
    transportMode?: FactoryPacketTransportMode;
    sectorName?: string;
}

export interface FactoryPressureState {
    routeDebt: number;
    underfedProcessors: number;
    congestionHotspots: number;
    points: FactoryPressurePoint[];
    pinnedBottlenecks?: string[];
    reliefSectors?: string[];
    recommendations?: FactoryPlannerRecommendation[];
    efficiencyPenalty?: number;
}

export interface FactoryState {
    nodes: Record<string, FactoryNodeState>;
    packets: FactoryPacketState[];
    overlayMode: LogisticsOverlayMode;
    sectors?: Record<string, FactorySectorState>;
    pressure?: FactoryPressureState;
    corridors?: Record<string, FactoryCorridorState>;
}

export interface PowerGridState {
    totalProduction: number;
    totalConsumption: number;
    connectedConsumption: number;
    deficit: number;
    industrialDemand?: number;
    strandedDemand?: number;
}

export interface WaterNetworkState {
    totalSupply: number;
    totalConsumption: number;
    connectedConsumption: number;
    deficit: number;
}

export interface IndustryState {
    refinedMaterials: number;
    alloys: number;
    machineParts: number;
    automationKits?: number;
    gridLoad: number;
    gridCapacity: number;
}

export interface GameState {
    step: GameStep;
    tickCount: number;
    resources: GameResources;
    market: MarketState;
    contracts: Contract[];
    activeGoal: Goal | null;
    newsFeed: NewsItem[];
    activeEvents: GlobalEvent[];
    weather: WeatherState;
    agents: Agent[];
    jobs: Job[];
    agentRequests?: AgentRequest[];
    chunks: Record<string, Chunk>;
    unlockedEras: Era[];
    currentEra: Era;
    research: ResearchState;
    bureaucracy: BureaucracyState;
    dayNightCycle?: DayNightCycleState;
    dungeon: DungeonState;
    underground: UndergroundState;
    factory: FactoryState;
    powerGrid: PowerGridState;
    waterNetwork: WaterNetworkState;
    industry?: IndustryState;
    inventory: Record<BuildingType, number>;
    selectedBuilding: BuildingType | null;
    selectedAgentId: string | null;
    interactionMode: 'BUILD' | 'INSPECT' | 'BULLDOZE' | 'REHABILITATE' | 'MARK_HARVEST' | 'FPS';
    activeView: 'SURFACE' | 'DUNGEON';
    isFPS: boolean;
    commandQueue: GameCommand[];
    pendingEffects: SimulationEffect[];
    isLoading: boolean;
    loadingMessage?: string;
    eraUnlockedPopup?: Era | null;
    buildingStats: Record<BuildingType, { count: number, level: number }>;
    ui: {
        lastCommandResult?: {
            commandId: string;
            type: string;
            ok: boolean;
            code?: string;
            reason?: string;
        };
    };
    debug: {
        commandTrace: {
            tick: number;
            commandId: string;
            commandType: string;
            payloadSummary: string;
            handledBy: string;
            result: { ok: boolean; code?: string; reason?: string };
        }[];
    };
    cheatsEnabled?: boolean;
    debugMode?: boolean;
}
