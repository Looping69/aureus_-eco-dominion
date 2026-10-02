import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { RuntimeRegistry } from '../engine/game-pack/RuntimeRegistry';
import { WorldHost } from '../engine/world/WorldHost';
import { PACK_RUNTIME_REGISTRY } from '../game-definitions/runtimeRegistry';
import { SampleColonyWorld } from '../game-definitions/sampleColonyRuntime';
import { SAMPLE_SAVE_KEY } from '../game-definitions/sampleColonyState';

function storageFixture(): Storage {
    const values = new Map<string,string>();
    return { getItem: key => values.get(key) ?? null, setItem: (key,value) => {values.set(key,value);}, removeItem: key => {values.delete(key);}, clear: () => values.clear(), key: i => [...values.keys()][i] ?? null, get length() { return values.size; } };
}
const ctx = { fixedDt: 1/30, stepIndex: 0, time: 0 };

test('executable registry rejects duplicates and missing runtimes', async () => {
    const registry = new RuntimeRegistry<{ colony: {services: Storage; world: SampleColonyWorld} }>();
    registry.register('colony', async storage => new SampleColonyWorld(storage));
    assert.throws(() => registry.register('colony', async storage => new SampleColonyWorld(storage)), /already registered/);
    assert.equal(registry.has('missing'), false);
    // Exercise untyped external input as well as the compile-time ID constraint.
    await assert.rejects(registry.create('missing' as 'colony',storageFixture()), /Unknown game pack runtime/);
    const world = await registry.create('colony',storageFixture());
    assert.equal(world.id,'sample.micro-colony');
    assert.equal(PACK_RUNTIME_REGISTRY.has('aureus.eco-dominion'),true);
});

test('sample uses the real host, simulation, queued commands, and independent save key', async () => {
    const storage = storageFixture();
    storage.setItem('aureus_save_v2','existing Aureus save remains untouched');
    const world = await PACK_RUNTIME_REGISTRY.create('sample.micro-colony',{storage});
    const host = new WorldHost();
    await host.setWorld(world);
    let notifications = 0;
    const unsubscribe = world.subscribe(snapshot => { notifications++; snapshot.energy = -100; });
    assert.equal(world.command('SAMPLE_PING').ok,true);
    assert.deepEqual(world.snapshot(),{ticks:0,energy:10,beacons:0});
    host.simulation(ctx);
    assert.deepEqual(world.snapshot(),{ticks:1,energy:5,beacons:1});
    for(let i=1;i<30;i++) host.simulation(ctx);
    assert.deepEqual(world.snapshot(),{ticks:30,energy:6,beacons:1});
    world.save();
    const saved = world.snapshot();
    assert.ok(storage.getItem(SAMPLE_SAVE_KEY));
    world.command('SAMPLE_PING'); host.simulation(ctx);
    assert.equal(world.snapshot().beacons,2);
    world.command('SAMPLE_PING');
    assert.equal(world.load(),true);
    assert.deepEqual(world.snapshot(),saved);
    host.simulation(ctx);
    assert.equal(world.snapshot().beacons,1,'load clears commands from the abandoned timeline');
    assert.equal(storage.getItem('aureus_save_v2'),'existing Aureus save remains untouched');
    assert.ok(notifications>30);
    unsubscribe();
    const final = world.snapshot();
    await host.unloadWorld();
    assert.equal(host.world,null);
    assert.equal(world.state,'disposed');
    host.simulation(ctx); world.simulation(ctx);
    assert.deepEqual(world.snapshot(),final);
    assert.equal(world.command('SAMPLE_PING').ok,false);
});

test('invalid commands and unaffordable commands cannot create beacons', async () => {
    const world = new SampleColonyWorld(storageFixture()); await world.init();
    const initial = world.snapshot();
    assert.equal(world.command('PLACE_BUILDING').ok,false);
    assert.deepEqual(world.snapshot(),initial);
    for(let i=0;i<3;i++) world.command('SAMPLE_PING');
    world.simulation(ctx);
    assert.deepEqual(world.snapshot(),{ticks:1,energy:0,beacons:2});
    assert.equal(world.lastResult?.ok,false);
    await world.teardown();
});

test('incompatible or corrupt saves reject atomically and retain queued commands', async () => {
    const world = new SampleColonyWorld(storageFixture()); await world.init();
    const original = world.snapshot();
    const envelope = JSON.parse(world.serialize());
    world.command('SAMPLE_PING');
    for(const invalid of [null,'{',JSON.stringify({seed:42}),JSON.stringify({...envelope,packId:'aureus.eco-dominion'}),JSON.stringify({...envelope,schemaVersion:2}),JSON.stringify({...envelope,state:{...envelope.state,energy:-1}}),JSON.stringify({...envelope,state:{...envelope.state,ticks:0.5}})]) {
        assert.equal(world.load(invalid),false);
        assert.deepEqual(world.snapshot(),original);
    }
    world.simulation(ctx);
    assert.equal(world.snapshot().beacons,1);
    await world.teardown();
});

test('sample runtime dependency closure contains only sample modules and shared engine', () => {
    const root = process.cwd();
    const visited = new Set<string>();
    function visit(file: string) {
        if(visited.has(file)) return;
        visited.add(file);
        const relative = path.relative(root,file).replaceAll(path.sep,'/');
        assert.ok(relative.startsWith('engine/') || relative.startsWith('game-definitions/sampleColony'),relative);
        const ast = ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
        for(const statement of ast.statements) {
            if(!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
            if(!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
            const specifier=statement.moduleSpecifier.text;
            if(!specifier.startsWith('.')) continue;
            const target=path.resolve(path.dirname(file),specifier);
            const resolved=[target,target+'.ts',target+'.tsx',path.join(target,'index.ts')].find(candidate=>existsSync(candidate) && /\.tsx?$/.test(candidate));
            assert.ok(resolved,`Unresolved ${specifier} in ${relative}`);
            visit(resolved!);
        }
    }
    visit(path.join(root,'game-definitions/sampleColonyRuntime.ts'));
    assert.ok(visited.has(path.join(root,'engine/sim/Simulation.ts')));
    assert.ok(visited.has(path.join(root,'engine/state/StateStore.ts')));
});
