import { BuildingType, FactorySectorState } from '../../../types';

const SECTOR_COLOR_PALETTE = [0x38bdf8, 0xf59e0b, 0x2dd4bf, 0xc084fc, 0xf97316, 0xa3e635];

export function getSectorColor(label: string): number {
    const hash = Array.from(label).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return SECTOR_COLOR_PALETTE[hash % SECTOR_COLOR_PALETTE.length];
}

export function getSectorPressure(sector: FactorySectorState | undefined): number {
    if (!sector) return 0;
    return Math.max(
        sector.congestionLevel || 0,
        Math.max(0, 1 - (sector.satisfaction || 1)),
        Math.min(1, (sector.missedQuotaTicks || 0) / 6)
    );
}

export function getSectorPressureColor(pressure: number): number {
    if (pressure > 0.72) return 0xef4444;
    if (pressure > 0.48) return 0xf97316;
    return 0xf59e0b;
}

export function getSectorFlowColor(sector: FactorySectorState): number {
    if ((sector.bonusChain || 0) >= 3) return 0x84cc16;
    if ((sector.satisfaction || 1) < 0.42) return 0xf59e0b;
    return 0x22d3ee;
}

export function getSectorSatisfactionColor(sector: FactorySectorState): number {
    if ((sector.satisfaction || 0) > 0.82) return 0x84cc16;
    if ((sector.satisfaction || 0) < 0.38) return 0xef4444;
    return 0x2dd4bf;
}

export function getSectorCode(label: string): string {
    return label
        .split(' ')
        .map((part) => part[0] || '')
        .join('')
        .slice(0, 3)
        .toUpperCase();
}

export function getPlannerColor(reason?: string): number {
    if (reason === 'UNDERFED') return 0xf59e0b;
    if (reason === 'CONGESTION') return 0xef4444;
    return 0x38bdf8;
}

export function getSuggestedBuildingCode(type?: BuildingType): string {
    return (type || 'PLAN')
        .split('_')
        .map((part) => part[0] || '')
        .join('')
        .slice(0, 4)
        .toUpperCase();
}

export function getSectorGoalLabel(sector: FactorySectorState): string {
    const target = sector.contractTarget || 0;
    const progress = Math.min(target, sector.contractProgress || 0);
    if ((sector.satisfaction || 1) < 0.7) return `SAT ${Math.round((sector.satisfaction || 0) * 100)}->70`;
    if (target > 0 && progress < target) return `Q ${Math.round(progress)}/${target}`;
    if ((sector.bonusChain || 0) > 0) return `HOLD x${sector.bonusChain}`;
    return `FLOW ${Math.round(sector.throughput || 0)}`;
}
