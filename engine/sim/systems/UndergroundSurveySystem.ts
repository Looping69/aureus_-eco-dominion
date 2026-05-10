import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel/Types';
import { BuildingType } from '../../types/buildings';
import { GameState } from '../../types/game';
import { generateUndergroundTile } from '../../underground/generator';

const SURVEY_DRILL_RADIUS = 4;

export class UndergroundSurveySystem extends BaseSimSystem {
    readonly id = 'underground_survey';
    readonly priority = 35;

    tick(_ctx: FixedContext, state: GameState): void {
        const underground = state.underground;
        if (!underground) return;

        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (tile.buildingType !== BuildingType.SURVEY_DRILL || tile.isUnderConstruction) {
                    continue;
                }

                this.revealRadius(state, tile.x, tile.z, SURVEY_DRILL_RADIUS);
            }
        }
    }

    private revealRadius(state: GameState, centerX: number, centerZ: number, radius: number): void {
        const underground = state.underground;
        const radiusSq = radius * radius;
        for (let dz = -radius; dz <= radius; dz++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if ((dx * dx) + (dz * dz) > radiusSq) continue;
                const x = centerX + dx;
                const z = centerZ + dz;
                const key = `${x},${z}`;
                if (!underground.tiles[key]) {
                    underground.tiles[key] = generateUndergroundTile(state.seed, x, z);
                }
                underground.tiles[key].surveyed = true;
            }
        }
    }
}
