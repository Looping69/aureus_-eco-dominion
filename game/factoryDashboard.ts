import type { GameState } from '../types.ts';

export interface FactoryDashboardMetrics {
    constructedBuildings: number;
    underConstruction: number;
    pendingJobs: number;
    assignedJobs: number;
    powerBalance: number;
    waterBalance: number;
    oreStockpile: number;
    netAgtPerSecond: number;
}

export const buildFactoryDashboardMetrics = (state: GameState): FactoryDashboardMetrics => {
    const constructedBuildings = state.grid.filter(
        tile => tile.buildingType !== 'EMPTY' && !tile.isUnderConstruction
    ).length;
    const underConstruction = state.grid.filter(tile => tile.isUnderConstruction).length;

    return {
        constructedBuildings,
        underConstruction,
        pendingJobs: state.jobs.filter(job => !job.assignedAgentId).length,
        assignedJobs: state.jobs.filter(job => Boolean(job.assignedAgentId)).length,
        powerBalance: state.powerGrid.totalProduced - state.powerGrid.totalConsumed,
        waterBalance: state.waterNetwork.totalProduced - state.waterNetwork.totalConsumed,
        oreStockpile: Math.floor(state.resources.minerals),
        netAgtPerSecond: state.resources.income - state.resources.maintenance,
    };
};
