import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel/Types';
import { BuildingType, GameState } from '../../../types';
import { createInitialUndergroundState, generateUndergroundTile } from '../../underground/UndergroundGen';

export class UndergroundSurveySystem extends BaseSimSystem {
    readonly id = 'undergroundSurvey';
    readonly priority = 55;

    tick(_ctx: FixedContext, state: GameState): void {
        // Run at a low cadence to avoid scanning every sim tick.
        if (state.tickCount % 30 !== 0) return;

        if (!(state as any).underground) {
            (state as any).underground = createInitialUndergroundState(state.seed);
        }

        const underground = state.underground;

        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (tile.buildingType !== BuildingType.SURVEY_DRILL) continue;
                if (tile.isUnderConstruction) continue;

                const hx = tile.structureHeadX ?? tile.x;
                const hz = tile.structureHeadZ ?? tile.z;
                if (tile.x !== hx || tile.z !== hz) continue;

                const drillKey = `${hx},${hz}`;
                if (underground.surveyedByDrill[drillKey]) continue;

                underground.surveyedByDrill[drillKey] = true;

                for (let dz = -4; dz <= 4; dz++) {
                    for (let dx = -4; dx <= 4; dx++) {
                        if (dx * dx + dz * dz > 16) continue;
                        const tx = hx + dx;
                        const tz = hz + dz;
                        const key = `${tx},${tz}`;
                        if (underground.tiles[key]) continue;

                        underground.tiles[key] = generateUndergroundTile(state.seed, tx, tz, underground.depth);
                    }
                }
            }
        }
    }
}

