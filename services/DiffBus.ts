
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GameDiff } from '../types';

type Listener = (diff: GameDiff) => void;

class DiffBusService {
    private listeners: Listener[] = [];

    subscribe(fn: Listener) {
        this.listeners.push(fn);
        return () => {
            this.listeners = this.listeners.filter(l => l !== fn);
        };
    }

    publish(diff: GameDiff) {
        // In a real production app, we might batch these or schedule them.
        // For now, direct synchronous dispatch is efficient enough for this scale.
        this.listeners.forEach(fn => fn(diff));
    }
}

export const DiffBus = new DiffBusService();
