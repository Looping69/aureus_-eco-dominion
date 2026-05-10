import React from 'react';
import { GameState, UndergroundTile } from '../types';
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

    const average = (selector: (tile: typeof statsSource[number]) => number): number => {
        if (statsSource.length === 0) return 0;
        return Math.round(statsSource.reduce((sum, tile) => sum + selector(tile), 0) / statsSource.length);
    };

    const metrics = [
        { label: 'Depth', value: average(tile => tile.depth), unit: 'm' },
        { label: 'Stability', value: average(tile => tile.stability), unit: '%' },
        { label: 'Oxygen', value: average(tile => tile.oxygen), unit: '%' },
        { label: 'Exposure', value: average(tile => tile.exposure), unit: '%' },
        { label: 'Surveyed Tiles', value: surveyedTiles.length },
        { label: 'Hazards', value: hazardCount },
    ];

    return (
        <div className="dungeon-hud">
            <div className="dungeon-hud-title">Below Sector · {state.underground?.sectorId || 'Sector B1'}</div>
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
