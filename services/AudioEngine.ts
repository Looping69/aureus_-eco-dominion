
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SfxType } from '../types';

export { SfxType };

/**
 * AudioEngine with proper resource management to prevent Windows audio issues.
 * 
 * Key fixes:
 * 1. Lazy AudioContext initialization (only on first user interaction)
 * 2. Node cleanup after sounds complete
 * 3. Sound frequency limiting (debouncing)
 * 4. Maximum concurrent sounds limit
 * 5. Proper context lifecycle management
 */
export class AudioEngine {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private initialized: boolean = false;
    private noiseBuffer: AudioBuffer | null = null;

    // Resource management
    private activeNodes: Set<AudioNode> = new Set();
    private static MAX_CONCURRENT_SOUNDS = 8;
    private lastPlayTime: Map<SfxType, number> = new Map();
    private static DEBOUNCE_MS: Record<SfxType, number> = {
        [SfxType.BUILD]: 100,
        [SfxType.BUILD_START]: 100,
        [SfxType.BULLDOZE]: 100,
        [SfxType.SELL]: 200,
        [SfxType.COMPLETE]: 200,
        [SfxType.ERROR]: 150,
        [SfxType.UI_CLICK]: 30,
        [SfxType.UI_OPEN]: 100,
        [SfxType.UI_COIN]: 150,
        [SfxType.CONSTRUCT_SPEEDUP]: 200,
        [SfxType.MINING_HIT]: 40,
        [SfxType.CAMP_BUILD]: 150,
        [SfxType.CAMP_RUSTLE]: 100,
        [SfxType.DEATH]: 500,
        [SfxType.ALARM]: 1000
    };

    constructor() {
        // Don't create AudioContext in constructor - wait for user interaction
    }

    /**
     * Initialize audio context. Must be called from a user interaction event.
     */
    public async init(): Promise<boolean> {
        if (this.initialized && this.ctx) return true;

        try {
            // Create context lazily
            if (!this.ctx) {
                const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
                if (!AudioContextClass) {
                    console.warn('AudioEngine: Web Audio API not supported');
                    return false;
                }

                this.ctx = new AudioContextClass({
                    latencyHint: 'interactive',
                    sampleRate: 44100
                });

                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = 0.2; // Lower master volume
                this.masterGain.connect(this.ctx.destination);

                // Create noise buffer
                this.createNoiseBuffer();
            }

            // Resume if suspended
            if (this.ctx.state === 'suspended') {
                await this.ctx.resume();
            }

            this.initialized = true;
            return true;
        } catch (err) {
            console.error('AudioEngine: Failed to initialize', err);
            return false;
        }
    }

    /**
     * Create reusable noise buffer
     */
    private createNoiseBuffer(): void {
        if (!this.ctx) return;

        const bufferSize = this.ctx.sampleRate; // 1 second
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    }

    /**
     * Create a noise source node
     */
    private createNoiseNode(): AudioBufferSourceNode | null {
        if (!this.ctx || !this.noiseBuffer) return null;

        const node = this.ctx.createBufferSource();
        node.buffer = this.noiseBuffer;
        node.loop = true;
        return node;
    }

    /**
     * Track a node for cleanup
     */
    private trackNode(node: AudioNode): void {
        this.activeNodes.add(node);
    }

    /**
     * Schedule node cleanup after it stops
     */
    private scheduleCleanup(node: AudioScheduledSourceNode, duration: number): void {
        // Use onended callback for cleanup
        node.onended = () => {
            try {
                node.disconnect();
                this.activeNodes.delete(node);
            } catch (e) {
                // Node may already be disconnected
            }
        };

        // Fallback cleanup in case onended doesn't fire
        setTimeout(() => {
            try {
                if (this.activeNodes.has(node)) {
                    node.disconnect();
                    this.activeNodes.delete(node);
                }
            } catch (e) {
                // Ignore cleanup errors
            }
        }, duration + 100);
    }

    /**
     * Check if we can play a sound (debouncing + concurrent limit)
     */
    private canPlay(type: SfxType): boolean {
        // Check concurrent sound limit
        if (this.activeNodes.size >= AudioEngine.MAX_CONCURRENT_SOUNDS) {
            return false;
        }

        // Check debounce
        const lastTime = this.lastPlayTime.get(type) || 0;
        const debounce = AudioEngine.DEBOUNCE_MS[type] || 50;
        const now = performance.now();

        if (now - lastTime < debounce) {
            return false;
        }

        this.lastPlayTime.set(type, now);
        return true;
    }

    /**
     * Play a sound effect
     */
    public play(type: SfxType): void {
        // Skip if not initialized or context is bad
        if (!this.ctx || !this.masterGain) {
            // Try to init on play (for first user interaction)
            this.init().catch(() => { });
            return;
        }

        // Skip if context is closed or suspended
        if (this.ctx.state === 'closed') return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => { });
            return;
        }

        // Check rate limiting
        if (!this.canPlay(type)) return;

        const t = this.ctx.currentTime;

        try {
            switch (type) {
                case SfxType.DEATH:
                    this.playDeath(t);
                    break;
                case SfxType.BUILD:
                case SfxType.BUILD_START:
                case SfxType.BULLDOZE:
                    this.playBuild(t);
                    break;
                case SfxType.SELL:
                    this.playSell(t);
                    break;
                case SfxType.COMPLETE:
                    this.playComplete(t);
                    break;
                case SfxType.ERROR:
                    this.playError(t);
                    break;
                case SfxType.UI_CLICK:
                    this.playUIClick(t);
                    break;
                case SfxType.UI_OPEN:
                    this.playUIOpen(t);
                    break;
                case SfxType.UI_COIN:
                    this.playUICoin(t);
                    break;
                case SfxType.CONSTRUCT_SPEEDUP:
                    this.playSpeedup(t);
                    break;
                case SfxType.MINING_HIT:
                    this.playMiningHit(t);
                    break;
                case SfxType.CAMP_BUILD:
                    this.playCampBuild(t);
                    break;
                case SfxType.CAMP_RUSTLE:
                    this.playCampRustle(t);
                    break;
                case SfxType.ALARM:
                    this.playAlarm(t);
                    break;
            }
        } catch (err) {
            console.warn('AudioEngine: Error playing sound', type, err);
        }
    }

    private playDeath(t: number): void {
        if (!this.ctx || !this.masterGain) return;

        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.5);
        g.gain.setValueAtTime(0.2, t);
        g.gain.linearRampToValueAtTime(0, t + 0.5);

        osc.connect(g);
        g.connect(this.masterGain);

        this.trackNode(osc);
        osc.start(t);
        osc.stop(t + 0.5);
        this.scheduleCleanup(osc, 500);
    }

    private playBuild(t: number): void {
        if (!this.ctx || !this.masterGain) return;

        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

        osc.connect(g);
        g.connect(this.masterGain);

        this.trackNode(osc);
        osc.start(t);
        osc.stop(t + 0.15);
        this.scheduleCleanup(osc, 150);
    }

    private playSell(t: number): void {
        if (!this.ctx || !this.masterGain) return;

        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, t);
        osc.frequency.linearRampToValueAtTime(1500, t + 0.1);
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

        osc.connect(g);
        g.connect(this.masterGain);

        this.trackNode(osc);
        osc.start(t);
        osc.stop(t + 0.2);
        this.scheduleCleanup(osc, 200);

        // No echo - removed to reduce node creation
    }

    private playComplete(t: number): void {
        if (!this.ctx || !this.masterGain) return;

        // Simplified arpeggio - only 2 notes instead of 4
        const notes = [523.25, 783.99]; // C, G
        notes.forEach((freq, i) => {
            const osc = this.ctx!.createOscillator();
            const g = this.ctx!.createGain();

            osc.type = 'triangle';
            osc.frequency.value = freq;
            const st = t + (i * 0.1);
            g.gain.setValueAtTime(0.12, st);
            g.gain.exponentialRampToValueAtTime(0.01, st + 0.3);

            osc.connect(g);
            g.connect(this.masterGain!);

            this.trackNode(osc);
            osc.start(st);
            osc.stop(st + 0.3);
            this.scheduleCleanup(osc, 400);
        });
    }

    private playError(t: number): void {
        if (!this.ctx || !this.masterGain) return;

        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.15);
        g.gain.setValueAtTime(0.15, t);
        g.gain.linearRampToValueAtTime(0.01, t + 0.15);

        osc.connect(g);
        g.connect(this.masterGain);

        this.trackNode(osc);
        osc.start(t);
        osc.stop(t + 0.15);
        this.scheduleCleanup(osc, 150);
    }

    private playUIClick(t: number): void {
        if (!this.ctx || !this.masterGain) return;

        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.frequency.setValueAtTime(800, t);
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.04);

        osc.connect(g);
        g.connect(this.masterGain);

        this.trackNode(osc);
        osc.start(t);
        osc.stop(t + 0.04);
        this.scheduleCleanup(osc, 50);
    }

    private playUIOpen(t: number): void {
        if (!this.ctx || !this.masterGain) return;

        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.12);
        g.gain.setValueAtTime(0.08, t);
        g.gain.linearRampToValueAtTime(0, t + 0.12);

        osc.connect(g);
        g.connect(this.masterGain);

        this.trackNode(osc);
        osc.start(t);
        osc.stop(t + 0.12);
        this.scheduleCleanup(osc, 120);
    }

    private playSpeedup(t: number): void {
        if (!this.ctx || !this.masterGain) return;

        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.linearRampToValueAtTime(2000, t + 0.25);
        g.gain.setValueAtTime(0.15, t);
        g.gain.linearRampToValueAtTime(0, t + 0.25);

        osc.connect(g);
        g.connect(this.masterGain);

        this.trackNode(osc);
        osc.start(t);
        osc.stop(t + 0.25);
        this.scheduleCleanup(osc, 250);
    }

    private playMiningHit(t: number): void {
        if (!this.ctx || !this.masterGain) return;

        // Simplified - just the metallic clink, no noise
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800 + Math.random() * 300, t);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

        osc.connect(g);
        g.connect(this.masterGain);

        this.trackNode(osc);
        osc.start(t);
        osc.stop(t + 0.08);
        this.scheduleCleanup(osc, 80);
    }

    private playCampBuild(t: number): void {
        if (!this.ctx || !this.masterGain) return;

        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

        osc.connect(g);
        g.connect(this.masterGain);

        this.trackNode(osc);
        osc.start(t);
        osc.stop(t + 0.25);
        this.scheduleCleanup(osc, 250);
    }

    private playCampRustle(t: number): void {
        if (!this.ctx || !this.masterGain) return;

        const noise = this.createNoiseNode();
        if (!noise) return;

        const g = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, t);
        filter.frequency.linearRampToValueAtTime(200, t + 0.4);

        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.08);
        g.gain.linearRampToValueAtTime(0, t + 0.4);

        noise.connect(filter);
        filter.connect(g);
        g.connect(this.masterGain);

        this.trackNode(noise);
        noise.start(t);
        noise.stop(t + 0.45);
        this.scheduleCleanup(noise, 450);
    }

    private playUICoin(t: number): void {
        if (!this.ctx || !this.masterGain) return;

        // Cash register / coin sound - two quick high notes
        const osc1 = this.ctx.createOscillator();
        const g1 = this.ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1200, t);
        g1.gain.setValueAtTime(0.12, t);
        g1.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        osc1.connect(g1);
        g1.connect(this.masterGain);

        this.trackNode(osc1);
        osc1.start(t);
        osc1.stop(t + 0.1);
        this.scheduleCleanup(osc1, 100);

        // Second note
        const osc2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1600, t + 0.08);
        g2.gain.setValueAtTime(0.1, t + 0.08);
        g2.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

        osc2.connect(g2);
        g2.connect(this.masterGain);

        this.trackNode(osc2);
        osc2.start(t + 0.08);
        osc2.stop(t + 0.18);
        this.scheduleCleanup(osc2, 180);
    }

    private playAlarm(t: number): void {
        if (!this.ctx || !this.masterGain) return;

        // Warning siren - alternating tones
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = 'square';
        // Oscillate between two pitches
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.setValueAtTime(600, t + 0.15);
        osc.frequency.setValueAtTime(800, t + 0.3);
        osc.frequency.setValueAtTime(600, t + 0.45);

        g.gain.setValueAtTime(0.08, t);
        g.gain.linearRampToValueAtTime(0.08, t + 0.5);
        g.gain.linearRampToValueAtTime(0, t + 0.6);

        osc.connect(g);
        g.connect(this.masterGain);

        this.trackNode(osc);
        osc.start(t);
        osc.stop(t + 0.6);
        this.scheduleCleanup(osc, 600);
    }

    /**
     * Set master volume (0-1)
     */
    public setVolume(volume: number): void {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, volume)) * 0.25;
        }
    }

    /**
     * Mute/unmute
     */
    public setMuted(muted: boolean): void {
        if (this.masterGain) {
            this.masterGain.gain.value = muted ? 0 : 0.2;
        }
    }

    /**
     * Clean up all resources
     */
    public cleanup(): void {
        // Disconnect all active nodes
        this.activeNodes.forEach(node => {
            try {
                node.disconnect();
            } catch (e) {
                // Ignore
            }
        });
        this.activeNodes.clear();

        // Close audio context
        if (this.ctx && this.ctx.state !== 'closed') {
            this.ctx.close().catch(() => { });
        }

        this.ctx = null;
        this.masterGain = null;
        this.noiseBuffer = null;
        this.initialized = false;
    }
}
