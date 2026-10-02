import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Runtime } from '../engine/kernel/Runtime';
import { WorldHost } from '../engine/world/WorldHost';
import { PACK_RUNTIME_REGISTRY } from './runtimeRegistry';
import type { SampleColonyWorld } from './sampleColonyRuntime';
import { createSampleState } from './sampleColonyState';

const buttonStyle: React.CSSProperties = {padding:'10px 14px',border:'1px solid #6f9d89',borderRadius:8,background:'#244c3d',color:'#effff8',cursor:'pointer'};

export default function SampleColonyUi() {
    const [snapshot, setSnapshot] = useState(createSampleState);
    const [session, setSession] = useState<{world: SampleColonyWorld; runtime: Runtime} | null>(null);
    const [message, setMessage] = useState('Starting colony…');
    const [paused, setPaused] = useState(false);
    useEffect(() => {
        let cancelled = false;
        let unsubscribe = () => {};
        const host = new WorldHost();
        const runtime = new Runtime(host, { fixedTickRate: 30, maxSimStepsPerFrame: 3 });
        const boot = (async () => {
            const world = await PACK_RUNTIME_REGISTRY.create('sample.micro-colony', {});
            if (cancelled) { await world.teardown(); return; }
            await host.setWorld(world);
            if (cancelled) return;
            unsubscribe = world.subscribe(setSnapshot);
            setSnapshot(world.snapshot());
            setSession({world,runtime});
            setMessage('Solar panels generate 1 energy each second.');
            runtime.start();
        })();
        void boot.catch(error => { if (!cancelled) setMessage(`Startup failed: ${String(error)}`); });
        return () => {
            cancelled = true;
            runtime.stop();
            unsubscribe();
            void boot.catch(() => {}).then(() => host.unloadWorld());
        };
    }, []);
    return <main style={{maxWidth:720,margin:'48px auto',padding:32,color:'#e8f1ef',background:'#142923',borderRadius:20,fontFamily:'system-ui'}}>
        <p style={{color:'#a5cdbc'}}>INDEPENDENT ENGINE SAMPLE</p>
        <h1 style={{fontSize:36,margin:'12px 0'}}>Solar Micro Colony</h1>
        <p>Collect sunlight and commission a network of beacons.</p>
        <dl style={{display:'flex',gap:40,margin:'32px 0'}}>
            <div><dt>Energy</dt><dd style={{fontSize:28,fontWeight:600}} data-testid="energy">{snapshot.energy}</dd></div>
            <div><dt>Beacons</dt><dd style={{fontSize:28,fontWeight:600}} data-testid="beacons">{snapshot.beacons}</dd></div>
            <div><dt>Simulation ticks</dt><dd style={{fontSize:28,fontWeight:600}} data-testid="ticks">{snapshot.ticks}</dd></div>
        </dl>
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
            <button style={buttonStyle} disabled={!session} onClick={() => setMessage(session!.world.command('SAMPLE_PING').reason)}>Commission beacon · 5 energy</button>
            <button style={buttonStyle} disabled={!session} onClick={() => { try { session!.world.save(); setMessage('Colony saved'); } catch { setMessage('Save storage is unavailable'); } }}>Save colony</button>
            <button style={buttonStyle} disabled={!session} onClick={() => { try { setMessage(session!.world.load() ? 'Colony restored' : 'No compatible save'); } catch { setMessage('Save storage is unavailable'); } }}>Load colony</button>
            <button style={buttonStyle} disabled={!session} onClick={() => { session!.runtime.togglePause(); setPaused(!paused); }}>{paused ? 'Resume' : 'Pause'}</button>
        </div>
        <p role="status" style={{marginTop:24}}>{message}</p>
        {session?.world.lastResult && <p>{session.world.lastResult.reason}</p>}
        <Link to="/" style={{color:'#a5cdbc'}}>Open Aureus: Eco Dominion</Link>
    </main>;
}
