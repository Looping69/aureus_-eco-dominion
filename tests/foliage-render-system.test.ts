import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { FoliageRenderSystem, getTreeHarvestVisual } from '../game/render/systems/FoliageRenderSystem.ts';
import { getHarvestVisualStage } from '../engine/sim/logic/HarvestVisualProgress.ts';

test('updating one foliage chunk leaves other chunk meshes intact', () => {
    const scene = new THREE.Scene();
    const system = new FoliageRenderSystem(scene);

    system.updateChunk('0,0', [
        { x: 0, y: 0, z: 0, type: 'TREE_OAK' },
    ]);
    system.updateChunk('1,0', [
        { x: 16, y: 0, z: 0, type: 'TREE_OAK' },
    ]);

    const initialMeshes = system.getInteractables() as THREE.InstancedMesh[];
    const firstChunkMesh = initialMeshes.find((mesh) => mesh.userData.chunkKey === '0,0');
    const secondChunkMesh = initialMeshes.find((mesh) => mesh.userData.chunkKey === '1,0');

    assert.equal(initialMeshes.length, 2);
    assert.ok(firstChunkMesh);
    assert.ok(secondChunkMesh);

    system.updateChunk('0,0', [
        { x: 1, y: 0, z: 0, type: 'TREE_OAK' },
        { x: 2, y: 0, z: 0, type: 'TREE_OAK', marked: true },
    ]);

    const updatedMeshes = system.getInteractables() as THREE.InstancedMesh[];
    const updatedFirstChunkMesh = updatedMeshes.find((mesh) => mesh.userData.chunkKey === '0,0');
    const updatedSecondChunkMesh = updatedMeshes.find((mesh) => mesh.userData.chunkKey === '1,0');

    assert.equal(updatedMeshes.length, 2);
    assert.ok(updatedFirstChunkMesh);
    assert.ok(updatedSecondChunkMesh);
    assert.notEqual(updatedFirstChunkMesh, firstChunkMesh);
    assert.equal(updatedSecondChunkMesh, secondChunkMesh);
    assert.equal(updatedFirstChunkMesh?.count, 2);
});

test('foliage mesh is reused when the chunk stays within pooled capacity', () => {
    const scene = new THREE.Scene();
    const system = new FoliageRenderSystem(scene);

    system.updateChunk('0,0', [
        { x: 0, y: 0, z: 0, type: 'TREE_OAK' },
        { x: 1, y: 0, z: 0, type: 'TREE_OAK' },
    ]);

    const initialMesh = (system.getInteractables() as THREE.InstancedMesh[])[0];
    assert.ok(initialMesh);

    system.updateChunk('0,0', [
        { x: 0, y: 0, z: 0, type: 'TREE_OAK' },
    ]);

    const updatedMesh = (system.getInteractables() as THREE.InstancedMesh[])[0];
    assert.equal(updatedMesh, initialMesh);
    assert.equal(updatedMesh.count, 1);
});

test('tree harvest visuals shrink across five integrity stages', () => {
    const integrities = [100, 79, 59, 39, 19];

    assert.deepEqual(integrities.map(getHarvestVisualStage), [0, 1, 2, 3, 4]);

    const visuals = integrities.map((integrity) => getTreeHarvestVisual('TREE_OAK', integrity));
    assert.deepEqual(visuals.map((visual) => visual.heightScale), [1, 0.72, 0.46, 0.28, 0.14]);
    assert.equal(getTreeHarvestVisual('ROCK_BOULDER', 19).heightScale, 1);

    const scene = new THREE.Scene();
    const system = new FoliageRenderSystem(scene);
    system.updateChunk('0,0', integrities.map((integrity) => ({
        x: 0,
        y: 0,
        z: 0,
        type: 'TREE_OAK',
        integrity,
    })));

    const mesh = (system.getInteractables() as THREE.InstancedMesh[])[0];
    assert.ok(mesh);
    assert.equal(mesh.count, integrities.length);

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const yScales: number[] = [];

    for (let index = 0; index < integrities.length; index += 1) {
        mesh.getMatrixAt(index, matrix);
        matrix.decompose(position, quaternion, scale);
        yScales.push(scale.y);
    }

    for (let index = 1; index < yScales.length; index += 1) {
        assert.ok(yScales[index] < yScales[index - 1], `stage ${index} should be shorter than stage ${index - 1}`);
    }
});
