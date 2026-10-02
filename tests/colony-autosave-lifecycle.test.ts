import test from 'node:test';
import assert from 'node:assert/strict';
import { ColonyAutosave, type AutosaveEnvironment } from '../game/world/ColonyAutosave';
import { readFileSync } from 'node:fs';

function fixture() {
    const window = new EventTarget(), document = new EventTarget();
    const callbacks: (()=>void)[] = [];
    const cleared: unknown[] = [];
    const environment: AutosaveEnvironment = {
        window, document, isHidden:()=>true,
        setInterval: callback => {callbacks.push(callback); return callbacks.length;},
        clearInterval: timer=>{cleared.push(timer);},
    };
    return {environment,callbacks,cleared,events:()=>{
        window.dispatchEvent(new Event('beforeunload'));
        document.dispatchEvent(new Event('visibilitychange'));
    }};
}

test('cancellation after construction and before successful Continue preserves save bytes', () => {
    for(const initialized of [false,true]) {
        const f=fixture();
        const original=' {"seed":42,"research":{"unlocked":["ADVANCED_DRILLING"]}}\n';
        let stored=original;
        const autosave=new ColonyAutosave(()=>{stored='fresh world';},f.environment);
        if(initialized) autosave.start();
        f.events(); for(const callback of f.callbacks) callback();
        assert.equal(stored,original,'startup events cannot save before a colony is chosen');
        autosave.dispose();
        f.events(); for(const callback of f.callbacks) callback();
        assert.equal(stored,original,'cancel and stale callbacks preserve exact bytes');
    }
});

test('an active colony still autosaves and saves exactly once on disposal', () => {
    const f=fixture();let writes=0;
    const autosave=new ColonyAutosave(()=>writes++,f.environment);
    autosave.start();autosave.start();
    assert.equal(f.callbacks.length,1);
    autosave.activate();f.callbacks[0]();
    assert.equal(writes,1);
    autosave.dispose();assert.equal(writes,2);
    autosave.dispose();autosave.activate();autosave.start();autosave.saveNow();
    f.events();f.callbacks[0]();
    assert.equal(writes,2);
    assert.deepEqual(f.cleared,[1]);
});

test('disposed worlds remove listeners and cannot overwrite a successor colony', () => {
    const f=fixture();let oldWrites=0,newWrites=0,stored='existing';
    const old=new ColonyAutosave(()=>{oldWrites++;stored='old';},f.environment);
    old.start();old.activate();old.dispose();
    const next=new ColonyAutosave(()=>{newWrites++;stored='new';},f.environment);
    next.start();next.activate();
    f.events();
    assert.equal(stored,'new');assert.equal(oldWrites,1);assert.equal(newWrites,2);
    next.dispose();stored='newer external save';
    f.events();for(const callback of f.callbacks) callback();
    assert.equal(stored,'newer external save');
    assert.equal(oldWrites,1);assert.equal(newWrites,3);
});

test('disposal detaches both browser handlers even when shutdown saving throws', () => {
    const f=fixture();let attempts=0;
    const autosave=new ColonyAutosave(()=>{attempts++;throw new Error('disk unavailable');},f.environment);
    autosave.start();autosave.activate();
    assert.throws(()=>autosave.dispose(),/disk unavailable/);
    f.events();f.callbacks[0]();autosave.dispose();
    assert.equal(attempts,1);assert.deepEqual(f.cleared,[1]);
});

test('Aureus activation is explicit and teardown does not unconditionally save', () => {
    const world=readFileSync(new URL('../game/AureusWorld.ts',import.meta.url),'utf8');
    const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
    const lifecycle=readFileSync(new URL('../game/world/lifecycle.ts',import.meta.url),'utf8');
    assert.match(world,/if \(loaded\) this\.beginColonySession\(\)/);
    assert.match(world,/if \(this\.state !== 'ready'\) return;/);
    assert.match(app,/if \(startNew\) world\.beginColonySession\(\)/);
    assert.doesNotMatch(lifecycle,/deps\.saveGameQuiet\(\)/);
});
