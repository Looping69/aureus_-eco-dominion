import { CommandContext, CommandErrorCode, CommandResult, FixedContext } from '../../kernel/Types';
import { GameCommand, GameState } from '../../../types';
import { BaseSimSystem } from '../Simulation';
import { digLayeredWorldVoxel } from '../../worldgen/LayeredWorldMutations';

export class LayeredWorldCommandSystem extends BaseSimSystem {
    readonly id = 'layered-world-command';
    readonly priority = 99;

    tick(_ctx: FixedContext, _state: GameState): void { }

    handleCommand(cmd: GameCommand, _ctx: CommandContext, state: GameState): CommandResult | null {
        if ((cmd.type as string) !== 'DIG_VOXEL') return null;

        const x = Math.round(Number(cmd.payload?.x));
        const y = Math.round(Number(cmd.payload?.y));
        const z = Math.round(Number(cmd.payload?.z));
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Dig target must include x, y, and z.' };
        }

        const result = digLayeredWorldVoxel(state.layeredWorld, x, y, z);
        if (!result.ok) {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: result.reason };
        }

        state.resources.minerals += result.drops.minerals || 0;
        state.resources.gems += result.drops.gems || 0;
        state.resources.stone += result.drops.stone || 0;
        return { ok: true };
    }
}
