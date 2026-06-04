import * as THREE from 'three';
import { FactoryPacketTransportMode } from '../../../types';
import { PacketInstanceSpec } from './PacketInstancedLayer';

export function createInstanceSpec(
    bucketKey: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: THREE.Vector3,
    scale: number,
    rotationX: number = 0,
    rotationY: number = 0,
    rotationZ: number = 0,
    scaleX?: number,
    scaleY?: number,
    scaleZ?: number,
): PacketInstanceSpec {
    return {
        bucketKey,
        geometry,
        material,
        position,
        scale,
        scaleX,
        scaleY,
        scaleZ,
        rotationX,
        rotationY,
        rotationZ,
    };
}

export function getPacketInstanceMaterial(
    packetMats: Record<string, THREE.MeshBasicMaterial>,
    packetInstanceMaterialCache: Map<string, THREE.MeshBasicMaterial>,
    resource: string,
    mode: FactoryPacketTransportMode,
    colorOverride?: number,
): THREE.MeshBasicMaterial {
    const base = packetMats[resource] || packetMats.ORE;
    const color = colorOverride ?? base.color.getHex();
    const key = `${mode}:${resource}:${color.toString(16)}`;
    const cached = packetInstanceMaterialCache.get(key);
    if (cached) {
        return cached;
    }

    const material = base.clone();
    material.color.setHex(color);
    material.transparent = true;
    material.opacity = mode === 'DRONE' ? 0.92 : 0.96;
    packetInstanceMaterialCache.set(key, material);
    return material;
}

export function getOverlayInstanceMaterial(
    overlayInstanceMaterialCache: Map<string, THREE.MeshBasicMaterial>,
    bucketKey: string,
    color: number,
    opacity: number,
): THREE.MeshBasicMaterial {
    const key = `${bucketKey}:${color.toString(16)}:${opacity.toFixed(2)}`;
    const cached = overlayInstanceMaterialCache.get(key);
    if (cached) {
        return cached;
    }

    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity });
    overlayInstanceMaterialCache.set(key, material);
    return material;
}
