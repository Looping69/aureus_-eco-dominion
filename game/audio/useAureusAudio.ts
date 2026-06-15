import { useCallback, useEffect, useState } from 'react';
import { SfxType } from '../../types';
import { aureusAudio, AudioMood } from './AureusAudio';

export function useAureusAudio(mood: AudioMood = {}) {
    const [audioEnabled, setAudioEnabled] = useState(() => aureusAudio.isEnabled());

    useEffect(() => {
        aureusAudio.setMood(mood);
    }, [mood.activeView, mood.isFPS, mood.isNight, mood.paused, mood.weatherType]);

    const toggleAudio = useCallback(() => {
        const next = aureusAudio.toggle();
        setAudioEnabled(next);
    }, []);

    const playAudioSfx = useCallback((type: SfxType | string) => {
        aureusAudio.playSfx(type);
    }, []);

    return { audioEnabled, toggleAudio, playAudioSfx };
}
