import { BaseSimSystem } from '../Simulation';
import { FOG_REVEAL_UPDATE_SECONDS, revealFogOfWarAroundSources } from '../fogOfWar/FogOfWarModel';

export class FogOfWarSystem extends BaseSimSystem {
    readonly id = 'fog-of-war';
    readonly priority = 95;

    private lastRevealAt = Number.NEGATIVE_INFINITY;

    tick(ctx: any, state: any): void {
        if (ctx.time - this.lastRevealAt < FOG_REVEAL_UPDATE_SECONDS) return;
        this.lastRevealAt = ctx.time;
        revealFogOfWarAroundSources(state);
    }
}
