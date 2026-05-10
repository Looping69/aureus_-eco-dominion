import React from 'react';
import { GameState, UndergroundTile, DEFAULT_UNDERGROUND_SECTOR_ID } from '../types';
import './DungeonHUD.css';

export interface DungeonHUDProps {
    state: GameState;
}

export const DungeonHUD: React.FC<DungeonHUDProps> = ({ state }) => {
    if (state.activeView !== 'DUNGEON') return null;

    const tiles: UndergroundTile[] = Object.values(state.underground?.tiles || {});
    const surveyedTiles = tiles.filter(tile => tile.surveyed);
    const statsSource = surveyedTiles.length > 0 ? surveyedTiles : tiles;
    const hazardCount = surveyedTiles.filter(tile => tile.hazard !== 'NONE').length;

    const computeTileAverage = (selector: (tile: UndergroundTile) => number): number => {
        if (statsSource.length === 0) return 0;
        return Math.round(statsSource.reduce((sum, tile) => sum + selector(tile), 0) / statsSource.length);
    };

    const metrics = [
        { label: 'Depth', value: computeTileAverage(tile => tile.depth), unit: 'm' },
        { label: 'Stability', value: computeTileAverage(tile => tile.stability), unit: '%' },
        { label: 'Oxygen', value: computeTileAverage(tile => tile.oxygen), unit: '%' },
        { label: 'Exposure', value: computeTileAverage(tile => tile.exposure), unit: '%' },
        { label: 'Surveyed Tiles', value: surveyedTiles.length },
        { label: 'Hazards', value: hazardCount },
    ];

    return (
        <div className="dungeon-hud">
            <div className="dungeon-hud-title">Below Sector · {state.underground?.sectorId || DEFAULT_UNDERGROUND_SECTOR_ID}</div>
            <div className="dungeon-hud-grid">
                {metrics.map(metric => (
                    <div key={metric.label} className="dungeon-hud-card">
                        <div className="dungeon-hud-label">{metric.label}</div>
                        <div className="dungeon-hud-value">
                            {metric.value}{metric.unit || ''}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
