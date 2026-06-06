
export interface GameResources {
    agt: number;
    minerals: number;
    gems: number;
    wood: number;
    stone: number;
    eco: number;
    trust: number;
    income: number;      // New: Pre-calculated income/s
    maintenance: number; // New: Pre-calculated maintenance/s
    maxCapacity: number;
}

export interface ResourceMarket {
    basePrice: number;
    currentPrice: number;
    trend: 'STABLE' | 'RISING' | 'FALLING' | 'SPIKE_UP' | 'CRASH_DOWN';
    history: number[]; // For sparkline graph (last 20 ticks)
    volatility: number;
}

export interface MarketState {
    minerals: ResourceMarket;
    gems: ResourceMarket;
    wood: ResourceMarket;
    stone: ResourceMarket;
    lastEvent?: string; // e.g. "War in Sector 4"
    eventDuration: number;
}

export type ContractStatus = 'AVAILABLE' | 'ACCEPTED' | 'COMPLETED' | 'FAILED';

export interface Contract {
    id: string;
    description: string;
    resource: 'MINERALS' | 'GEMS' | 'WOOD' | 'STONE';
    amount: number;
    reward: number; // AGT payout
    timeLeft: number; // Seconds for accepted contracts, offer expiry for available contracts, display TTL for terminal states
    penalty: number; // AGT penalty if accepted work fails
    status?: ContractStatus;
    acceptedAtTick?: number;
    completedAtTick?: number;
    failedAtTick?: number;
    deliveredAmount?: number;
}