import assert from 'node:assert/strict';
import test from 'node:test';
import { collectCurrentFogRevealCenters, FogExplorationTracker } from '../game/fog/FogExploration';
import { getExploredRayDistance } from '../game/fog/ExploredBoundary';
import { FogOfWarSystem } from '../game/sim/systems/FogOfWarSystem';
import { StateManager } from '../game/state/StateManager';
import { PersistenceManager } from '../game/state/PersistenceManager';
import { BuildingType } from '../game/types/buildings';

const circle = (x:number,z:number,radius:number) => ({key:`${x},${z}`,x,z,radius});
const ctx = {fixedDt:1/30,stepIndex:0,time:0};

test('empty terrain and water never grant building vision, completed buildings do', () => {
    const state = {spawnX:0,spawnZ:0,agents:[],ambientNpcs:[],chunks:{'0,0':{tiles:[
        {x:100,z:100,buildingType:BuildingType.EMPTY},
        {x:110,z:100,buildingType:BuildingType.POND},
        {x:120,z:100,buildingType:BuildingType.WORKSHOP,isUnderConstruction:true},
        {x:130,z:100,buildingType:BuildingType.WORKSHOP},
    ]}}};
    const sources = collectCurrentFogRevealCenters(state);
    assert.equal(sources.length,2);
    assert.equal(sources[0].key,'spawn');
    assert.equal(sources[1].x,130);
});

test('first-person boundary merges explored corridors rather than nearest historical circles', () => {
    const centers = [circle(0,0,12),circle(18,0,12),circle(36,0,12)];
    assert.equal(getExploredRayDistance({x:0,z:0},{x:1,z:0},centers,128),48);
    assert.equal(getExploredRayDistance({x:5,z:0},{x:1,z:0},centers,128),43);
    assert.equal(getExploredRayDistance({x:0,z:0},{x:0,z:1},centers,128),12);
    assert.equal(getExploredRayDistance({x:0,z:0},{x:-1,z:0},centers,128),12);
    assert.equal(getExploredRayDistance({x:0,z:0},{x:1,z:0},centers,20),20);
});

test('unexplored gaps remain closed even if another revealed island lies beyond them', () => {
    assert.equal(getExploredRayDistance({x:-10,z:-8},{x:1,z:0},[circle(-10,-8,5),circle(10,-8,5)],128),5);
    assert.equal(getExploredRayDistance({x:0,z:0},{x:1,z:0},[circle(20,0,5)],128),0);
    assert.equal(getExploredRayDistance({x:0,z:0},{x:0,z:0},[circle(0,0,5)],128),0);
});

test('loading different exploration with the same version replaces cached history', () => {
    const tracker = new FogExplorationTracker();
    const first = {spawnX:0,spawnZ:0,agents:[],fogExploration:{centers:[{key:'spawn',x:0,z:0,radius:18},circle(100,0,12)],version:2}};
    tracker.updateFromState(first);
    const second = {...first,fogExploration:{centers:[{key:'spawn',x:0,z:0,radius:18},circle(-100,0,12)],version:2}};
    tracker.updateFromState(second);
    assert.deepEqual(tracker.getCenters(),second.fogExploration.centers);
    assert.equal(tracker.getCenters().some(c=>c.x===100),false);
});

test('simulation records agent exploration in both views and saves remembered areas', () => {
    const state = new StateManager({seed:42}).getState();
    let changes=0;
    const system = new FogOfWarSystem(()=>changes++);
    state.isFPS=true;
    state.agents[0].x=-60; state.agents[0].z=20;
    system.tick(ctx,state);
    const traveled=state.fogExploration!.centers.find(c=>c.x===-60&&c.z===20);
    assert.ok(traveled);
    state.agents[0].x=60;
    state.isFPS=false;
    system.tick(ctx,state);
    assert.ok(state.fogExploration!.centers.some(c=>c.key===traveled.key));
    const current=collectCurrentFogRevealCenters(state);
    assert.equal(current.some(c=>c.x===-60&&c.z===20),false);
    assert.ok(current.some(c=>c.x===60&&c.z===20));
    assert.ok(changes>=2);
    const restored=new PersistenceManager().reviveState(JSON.stringify(state));
    assert.deepEqual(restored?.fogExploration,state.fogExploration);
});
