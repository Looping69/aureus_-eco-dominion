import { BaseSimSystem } from '../../../engine/sim/Simulation';
import type { FixedContext } from '../../../engine/kernel/Types';
import type { GameState } from '../../types/game';
import { FogExplorationTracker } from '../../fog/FogExploration';

/** Exploration is authoritative simulation state, independent of camera mode. */
export class FogOfWarSystem extends BaseSimSystem {
    readonly id = 'fog-exploration';
    readonly priority = -100;
    private readonly tracker = new FogExplorationTracker();
    constructor(private readonly onChanged: () => void = () => {}) { super(); }
    tick(_ctx: FixedContext, state: GameState): void {
        if (state.activeView !== 'SURFACE') return;
        this.tracker.updateFromState(state, this.onChanged);
    }
}
