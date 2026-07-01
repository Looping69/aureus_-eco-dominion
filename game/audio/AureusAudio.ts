import { SfxType } from '../../types';

export interface AudioMood {
    paused?: boolean;
    activeView?: 'SURFACE' | 'DUNGEON';
    isNight?: boolean;
    isFPS?: boolean;
    weatherType?: string;
}

const STORAGE_KEY = 'aureus.audio.enabled.v1';
const MUSIC_SCALE = [196, 220, 247, 294, 330, 392];

type WebAudioWindow = Window & typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
};

function canUseAudio(): boolean {
    return typeof window !== 'undefined' && Boolean(window.AudioContext || (window as WebAudioWindow).webkitAudioContext);
}

function readStoredEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
}

function setParam(param: AudioParam, value: number, time: number, ramp = 0.05) {
    param.cancelScheduledValues(time);
    param.setTargetAtTime(value, time, ramp);
}

export class AureusAudioDirector {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private musicGain: GainNode | null = null;
    private ambienceGain: GainNode | null = null;
    private enabled = readStoredEnabled();
    private mood: AudioMood = { activeView: 'SURFACE' };
    private drones: OscillatorNode[] = [];
    private musicTimer: ReturnType<typeof setInterval> | null = null;
    private pulseIndex = 0;

    isEnabled(): boolean {
        return this.enabled;
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, String(enabled));
        }

        if (enabled) {
            this.ensureContext();
            this.startBeds();
            this.playSfx(SfxType.UI_OPEN);
        } else {
            this.stopBeds();
        }
    }

    toggle(): boolean {
        const next = !this.enabled;
        this.setEnabled(next);
        return next;
    }

    setMood(mood: AudioMood) {
        this.mood = { ...this.mood, ...mood };
        this.updateBedLevels();
    }

    playSfx(type: SfxType | string) {
        if (!this.enabled) return;
        const ctx = this.ensureContext();
        if (!ctx || !this.master) return;

        const now = ctx.currentTime;
        switch (type) {
            case SfxType.ERROR:
                this.tone(110, 0.18, 0.05, 'sawtooth', -0.25);
                this.tone(82, 0.22, 0.035, 'square', 0.25);
                break;
            case SfxType.BUILD:
            case SfxType.BUILD_START:
            case SfxType.CAMP_BUILD:
                this.tone(220, 0.08, 0.045, 'triangle', -0.15);
                this.tone(330, 0.16, 0.035, 'triangle', 0.2, 0.06);
                break;
            case SfxType.COMPLETE:
            case SfxType.UI_COIN:
            case SfxType.SELL:
                this.tone(392, 0.08, 0.035, 'sine', -0.2);
                this.tone(523, 0.11, 0.035, 'sine', 0.15, 0.06);
                this.tone(659, 0.14, 0.03, 'sine', 0.05, 0.12);
                break;
            case SfxType.MINING_HIT:
            case SfxType.BULLDOZE:
                this.noiseBurst(0.12, 0.04, 650);
                this.tone(72, 0.18, 0.035, 'sawtooth', -0.1);
                break;
            case SfxType.ALARM:
                this.tone(740, 0.12, 0.04, 'square', -0.35);
                this.tone(554, 0.12, 0.04, 'square', 0.35, 0.13);
                break;
            case SfxType.UI_OPEN:
                this.tone(294, 0.08, 0.025, 'sine', -0.08);
                this.tone(392, 0.1, 0.025, 'sine', 0.08, 0.05);
                break;
            case SfxType.UI_CLICK:
            default:
                this.tone(330, 0.055, 0.02, 'sine', 0);
                break;
        }

        if (ctx.state === 'suspended') {
            void ctx.resume();
        }
    }

    private ensureContext(): AudioContext | null {
        if (!canUseAudio()) return null;
        if (this.ctx) return this.ctx;

        const AudioContextCtor = window.AudioContext || (window as WebAudioWindow).webkitAudioContext;
        if (!AudioContextCtor) return null;

        const ctx = new AudioContextCtor();
        this.ctx = ctx;

        this.master = ctx.createGain();
        this.musicGain = ctx.createGain();
        this.ambienceGain = ctx.createGain();

        this.master.gain.value = 0;
        this.musicGain.gain.value = 0;
        this.ambienceGain.gain.value = 0;

        this.musicGain.connect(this.master);
        this.ambienceGain.connect(this.master);
        this.master.connect(ctx.destination);
        return ctx;
    }

    private startBeds() {
        const ctx = this.ensureContext();
        if (!ctx || !this.master || !this.musicGain || !this.ambienceGain) return;

        if (ctx.state === 'suspended') {
            void ctx.resume();
        }

        if (this.drones.length === 0) {
            for (const frequency of [55, 82.4, 110]) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = frequency === 110 ? 'triangle' : 'sine';
                osc.frequency.value = frequency;
                gain.gain.value = 0.012;
                osc.connect(gain);
                gain.connect(this.ambienceGain);
                osc.start();
                this.drones.push(osc);
            }
        }

        if (!this.musicTimer) {
            this.musicTimer = setInterval(() => this.scheduleMusicPulse(), 5200);
            this.scheduleMusicPulse();
        }

        this.updateBedLevels();
    }

    private stopBeds() {
        const ctx = this.ctx;
        if (!ctx) return;

        if (this.musicTimer) {
            clearInterval(this.musicTimer);
            this.musicTimer = null;
        }

        const now = ctx.currentTime;
        if (this.master) setParam(this.master.gain, 0, now, 0.08);
    }

    private updateBedLevels() {
        if (!this.ctx || !this.master || !this.musicGain || !this.ambienceGain) return;
        const now = this.ctx.currentTime;

        if (!this.enabled || this.mood.paused) {
            setParam(this.master.gain, 0, now, 0.12);
            return;
        }

        const underground = this.mood.activeView === 'DUNGEON';
        const night = Boolean(this.mood.isNight);
        const storm = String(this.mood.weatherType || '').toLowerCase().includes('storm');

        setParam(this.master.gain, this.mood.isFPS ? 0.2 : 0.16, now, 0.1);
        setParam(this.musicGain.gain, underground ? 0.028 : night ? 0.038 : 0.046, now, 0.2);
        setParam(this.ambienceGain.gain, underground ? 0.09 : storm ? 0.075 : night ? 0.052 : 0.042, now, 0.2);
    }

    private scheduleMusicPulse() {
        if (!this.enabled || this.mood.paused) return;
        const ctx = this.ensureContext();
        if (!ctx || !this.musicGain) return;

        const root = MUSIC_SCALE[this.pulseIndex % MUSIC_SCALE.length];
        const fifth = MUSIC_SCALE[(this.pulseIndex + 3) % MUSIC_SCALE.length];
        const octave = root * 2;
        const underground = this.mood.activeView === 'DUNGEON';
        const duration = underground ? 2.8 : 2.1;
        const now = ctx.currentTime;

        this.musicTone(root, now, duration, underground ? 'sine' : 'triangle', -0.28);
        this.musicTone(fifth, now + 0.24, duration * 0.75, 'sine', 0.12);
        this.musicTone(octave, now + 0.58, duration * 0.45, 'triangle', 0.34);
        this.pulseIndex += 1;
    }

    private musicTone(frequency: number, start: number, duration: number, type: OscillatorType, pan: number) {
        const ctx = this.ctx;
        if (!ctx || !this.musicGain) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const panner = ctx.createStereoPanner();
        osc.type = type;
        osc.frequency.value = frequency;
        panner.pan.value = pan;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.06, start + 0.35);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.musicGain);
        osc.start(start);
        osc.stop(start + duration + 0.1);
    }

    private tone(frequency: number, duration: number, gainValue: number, type: OscillatorType, pan: number, delay = 0) {
        const ctx = this.ctx;
        if (!ctx || !this.master) return;

        const start = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const panner = ctx.createStereoPanner();
        osc.type = type;
        osc.frequency.value = frequency;
        panner.pan.value = pan;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.master);
        osc.start(start);
        osc.stop(start + duration + 0.05);
    }

    private noiseBurst(duration: number, gainValue: number, cutoff: number) {
        const ctx = this.ctx;
        if (!ctx || !this.master) return;

        const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }

        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        filter.type = 'lowpass';
        filter.frequency.value = cutoff;
        gain.gain.value = gainValue;
        source.buffer = buffer;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        source.start();
    }
}

export const aureusAudio = new AureusAudioDirector();
export { STORAGE_KEY as AUREUS_AUDIO_STORAGE_KEY };
