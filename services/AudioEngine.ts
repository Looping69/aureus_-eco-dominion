
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { SfxType } from '../types';

export type { SfxType };

export class AudioEngine {
    private ctx: AudioContext;
    private masterGain: GainNode;
    private initialized: boolean = false;
    private noiseBuffer: AudioBuffer;

    constructor() {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.25; // Master Volume
        this.masterGain.connect(this.ctx.destination);

        // Create a 1-second white noise buffer for general use
        const bufferSize = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    }

    public async init() {
        if (this.initialized) return;
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        this.initialized = true;
    }

    private createNoiseNode() {
        const node = this.ctx.createBufferSource();
        node.buffer = this.noiseBuffer;
        node.loop = true;
        return node;
    }

    public play(type: SfxType) {
        // Attempt to wake up context on any play call
        this.init().catch(() => { });

        const t = this.ctx.currentTime;

        switch (type) {
            case 'DEATH': {
                // Low descending gloom sound
                const osc = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, t);
                osc.frequency.exponentialRampToValueAtTime(40, t + 0.5);
                g.gain.setValueAtTime(0.3, t);
                g.gain.linearRampToValueAtTime(0, t + 0.5);
                osc.connect(g);
                g.connect(this.masterGain);
                osc.start(t);
                osc.stop(t + 0.5);
                break;
            }
            case 'BUILD': {
                // Heavy thud
                const osc = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(120, t);
                osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
                g.gain.setValueAtTime(0.4, t);
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

                osc.connect(g);
                g.connect(this.masterGain);
                osc.start(t);
                osc.stop(t + 0.15);
                break;
            }
            case 'SELL': {
                // High pitch coin/register
                const osc = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1000, t);
                osc.frequency.linearRampToValueAtTime(1500, t + 0.1);
                g.gain.setValueAtTime(0.2, t);
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

                osc.connect(g);
                g.connect(this.masterGain);
                osc.start(t);
                osc.stop(t + 0.2);

                // Echo
                setTimeout(() => {
                    if (this.ctx.state === 'closed') return;
                    const osc2 = this.ctx.createOscillator();
                    const g2 = this.ctx.createGain();
                    osc2.type = 'sine';
                    osc2.frequency.setValueAtTime(1500, this.ctx.currentTime);
                    g2.gain.setValueAtTime(0.05, this.ctx.currentTime);
                    g2.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
                    osc2.connect(g2);
                    g2.connect(this.masterGain);
                    osc2.start();
                    osc2.stop(this.ctx.currentTime + 0.1);
                }, 100);
                break;
            }
            case 'COMPLETE': {
                // Major Arpeggio
                const notes = [523.25, 659.25, 783.99, 1046.50]; // C E G C
                notes.forEach((freq, i) => {
                    const osc = this.ctx.createOscillator();
                    const g = this.ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.value = freq;
                    const st = t + (i * 0.08);
                    g.gain.setValueAtTime(0.15, st);
                    g.gain.exponentialRampToValueAtTime(0.01, st + 0.4);
                    osc.connect(g);
                    g.connect(this.masterGain);
                    osc.start(st);
                    osc.stop(st + 0.4);
                });
                break;
            }
            case 'ERROR': {
                // Low buzz
                const osc = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, t);
                osc.frequency.linearRampToValueAtTime(100, t + 0.2);
                g.gain.setValueAtTime(0.2, t);
                g.gain.linearRampToValueAtTime(0.01, t + 0.2);
                osc.connect(g);
                g.connect(this.masterGain);
                osc.start(t);
                osc.stop(t + 0.2);
                break;
            }
            case 'UI_CLICK': {
                // Short blip
                const osc = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                osc.frequency.setValueAtTime(800, t);
                g.gain.setValueAtTime(0.1, t);
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
                osc.connect(g);
                g.connect(this.masterGain);
                osc.start(t);
                osc.stop(t + 0.05);
                break;
            }
            case 'UI_OPEN': {
                // Sci-fi slide
                const osc = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, t);
                osc.frequency.exponentialRampToValueAtTime(800, t + 0.15);
                g.gain.setValueAtTime(0.1, t);
                g.gain.linearRampToValueAtTime(0, t + 0.15);
                osc.connect(g);
                g.connect(this.masterGain);
                osc.start(t);
                osc.stop(t + 0.15);
                break;
            }
            case 'CONSTRUCT_SPEEDUP': {
                // Magic chime
                const osc = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, t);
                osc.frequency.linearRampToValueAtTime(2000, t + 0.3);
                g.gain.setValueAtTime(0.2, t);
                g.gain.linearRampToValueAtTime(0, t + 0.3);
                osc.connect(g);
                g.connect(this.masterGain);
                osc.start(t);
                osc.stop(t + 0.3);
                break;
            }
            case 'MINING_HIT': {
                // Metallic clink (Triangle wave high pitch) + Noise burst
                const osc = this.ctx.createOscillator();
                const noise = this.createNoiseNode();
                const gOsc = this.ctx.createGain();
                const gNoise = this.ctx.createGain();

                // Metallic part
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(800 + Math.random() * 400, t); // Vary pitch
                gOsc.gain.setValueAtTime(0.15, t);
                gOsc.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

                // Crunch part
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.value = 1000;
                gNoise.gain.setValueAtTime(0.2, t);
                gNoise.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

                osc.connect(gOsc);
                gOsc.connect(this.masterGain);

                noise.connect(filter);
                filter.connect(gNoise);
                gNoise.connect(this.masterGain);

                osc.start(t);
                osc.stop(t + 0.1);
                noise.start(t);
                noise.stop(t + 0.05);
                break;
            }
            case 'CAMP_BUILD': {
                // Low thud/fabric sound
                const osc = this.ctx.createOscillator();
                const g = this.ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(80, t);
                osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);

                g.gain.setValueAtTime(0.5, t);
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

                osc.connect(g);
                g.connect(this.masterGain);
                osc.start(t);
                osc.stop(t + 0.3);
                break;
            }
            case 'CAMP_RUSTLE': {
                // Filtered noise for ambient camp movement
                const noise = this.createNoiseNode();
                const g = this.ctx.createGain();
                const filter = this.ctx.createBiquadFilter();

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(400, t);
                filter.frequency.linearRampToValueAtTime(200, t + 0.5);

                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.08, t + 0.1); // Fade in
                g.gain.linearRampToValueAtTime(0, t + 0.5);   // Fade out

                noise.connect(filter);
                filter.connect(g);
                g.connect(this.masterGain);

                noise.start(t);
                noise.stop(t + 0.6);
                break;
            }
        }
    }
}
