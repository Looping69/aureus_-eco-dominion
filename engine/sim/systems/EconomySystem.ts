/**
 * Economy System
 * Handles market price fluctuations and economic events.
 */

import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel';
import { GameState } from '../../../types';

export class EconomySystem extends BaseSimSystem {
    readonly id = 'economy';
    readonly priority = 40;

    private lastMarketUpdate = 0;
    private readonly MARKET_INTERVAL = 2.0; // Seconds

    tick(ctx: FixedContext, state: GameState): void {
        if (ctx.time - this.lastMarketUpdate < this.MARKET_INTERVAL) return;
        this.lastMarketUpdate = ctx.time;

        const market = state.market;
        if (!market) return;

        // Fluatuate Minerals & Gems
        this.fluatuateResource(market.minerals);
        this.fluatuateResource(market.gems);

        // Random Trend Shifts
        this.updateTrend(market.minerals);
        this.updateTrend(market.gems);
    }

    private fluatuateResource(m: any) {
        const change = (Math.random() - 0.5) * m.volatility + (m.trend === 'RISING' ? 1.5 : m.trend === 'FALLING' ? -1.5 : 0);
        let newPrice = Math.max(1, Math.min(m.basePrice * 3, m.currentPrice + change));
        newPrice = Math.round(newPrice * 10) / 10;

        m.history.push(newPrice);
        if (m.history.length > 20) m.history.shift();
        m.currentPrice = newPrice;
    }

    private updateTrend(m: any) {
        if (Math.random() < 0.05) {
            const r = Math.random();
            if (r < 0.3) m.trend = 'STABLE';
            else if (r < 0.6) m.trend = 'RISING';
            else m.trend = 'FALLING';
        }
    }
}
