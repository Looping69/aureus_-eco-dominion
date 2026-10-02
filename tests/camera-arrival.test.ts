import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { arrivalZoom } from '../game/render/CameraArrival';
import { IsoCameraSystem } from '../game/render/IsoCameraSystem';
import type { ThreeRenderAdapter } from '../engine/render/ThreeRenderAdapter';

function withCamera(run:(camera:IsoCameraSystem,renderCamera:THREE.OrthographicCamera)=>void) {
    const old=Object.getOwnPropertyDescriptor(globalThis,'window');
    Object.defineProperty(globalThis,'window',{configurable:true,value:Object.assign(new EventTarget(),{innerWidth:1200,innerHeight:800})});
    const element=Object.assign(new EventTarget(),{style:{}});
    const renderCamera=new THREE.OrthographicCamera();
    const camera=new IsoCameraSystem({getCamera:()=>renderCamera,getCanvas:()=>element,setCamera:()=>{}} as unknown as ThreeRenderAdapter);
    camera.zoomToPosition(25,-12,2);
    try {run(camera,renderCamera);} finally {camera.dispose();if(old)Object.defineProperty(globalThis,'window',old);else delete (globalThis as any).window;}
}

test('arrival easing is bounded, smooth, and independent of frame count',()=>{
    assert.equal(arrivalZoom(91,26,0,1.8),91);
    assert.equal(arrivalZoom(91,26,.9,1.8),58.5);
    assert.equal(arrivalZoom(91,26,5,1.8),26);
    assert.equal(arrivalZoom(91,26,0,0),26);
});

test('arrival changes the real orthographic frustum and lands on the chosen settlement',()=>withCamera((camera,render)=>{
    let completed=0;camera.playIntroAnimation(()=>completed++);
    const start=render.top-render.bottom;
    for(let i=0;i<27;i++)camera.update(1/30);
    const middle=render.top-render.bottom;
    assert.ok(start>middle&&middle>26);
    for(let i=0;i<30;i++)camera.update(1/30);
    assert.equal(camera.getZoom(),26);assert.equal(render.top-render.bottom,26);assert.equal(completed,1);
    assert.equal(camera.getFocus().x,25);assert.equal(camera.getFocus().z,-12);
    camera.update(10);assert.equal(completed,1);
}));

test('reduced motion lands immediately without scheduling an animation',()=>withCamera(camera=>{
    let completed=0;camera.playIntroAnimation(()=>completed++,true);
    assert.equal(camera.getZoom(),26);assert.equal(completed,1);camera.update(1);assert.equal(completed,1);
}));

test('cancel and dispose suppress completion and a cancelled attempt can be retried',()=>withCamera(camera=>{
    let completed=0;const cancel=camera.playIntroAnimation(()=>completed++);camera.update(.3);cancel();camera.update(3);assert.equal(completed,0);
    camera.playIntroAnimation(()=>completed++);cancel();camera.update(2);assert.equal(completed,1,'old cancellation cannot abort a new arrival');
    camera.playIntroAnimation(()=>completed++);camera.dispose();camera.update(3);assert.equal(completed,1);
}));

test('manual camera input interrupts arrival exactly once and remains usable',()=>withCamera(camera=>{
    let completed=0;camera.playIntroAnimation(()=>completed++);camera.update(.2);camera.zoom(-1);camera.update(.2);
    assert.equal(completed,1);assert.ok(camera.getZoom()<26);camera.finishIntroAnimation();assert.equal(completed,1);
}));
