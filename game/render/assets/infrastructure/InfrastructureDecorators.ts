import * as THREE from 'three';

export interface InfrastructureConnections {
    north?: boolean;
    south?: boolean;
    east?: boolean;
    west?: boolean;
}

export interface InfrastructureDecorationAssets {
    dronePadGeo: THREE.BufferGeometry;
    dronePacketGeo: THREE.BufferGeometry;
    beaconGeo: THREE.BufferGeometry;
    junctionArrowGeo: THREE.BufferGeometry;
}

export function decorateRailConveyor(
    group: THREE.Group,
    connections: InfrastructureConnections,
    seed: number
): void {
    const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.045, 0.82),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, metalness: 0.2 })
    );
    base.position.y = 0.04;
    group.add(base);

    const laneMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x164e63, emissiveIntensity: 0.2, roughness: 0.4, metalness: 0.7 });
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.95 });

    const hasX = Boolean(connections.east || connections.west);
    const hasZ = Boolean(connections.north || connections.south);
    const straightX = hasX && !hasZ;
    const straightZ = hasZ && !hasX;

    const lane = new THREE.Mesh(
        new THREE.BoxGeometry(straightX ? 0.82 : 0.3, 0.06, straightZ ? 0.82 : 0.3),
        laneMat
    );
    lane.position.y = 0.09;
    group.add(lane);

    if (!straightX && !straightZ) {
        const crossX = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.055, 0.24), laneMat);
        crossX.position.y = 0.095;
        const crossZ = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.055, 0.82), laneMat);
        crossZ.position.y = 0.095;
        group.add(crossX, crossZ);
    }

    for (let i = 0; i < 3; i++) {
        const pulse = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.11), pulseMat.clone());
        pulse.position.y = 0.16;
        pulse.userData.isConveyorPulse = true;
        pulse.userData.phase = (i / 3) + ((seed % 13) * 0.01);
        pulse.userData.baseY = 0.16;
        if (straightX) {
            pulse.userData.axis = 'x';
            pulse.userData.range = 0.5;
            pulse.position.z = 0;
        } else if (straightZ) {
            pulse.userData.axis = 'z';
            pulse.userData.range = 0.5;
            pulse.position.x = 0;
        } else {
            pulse.userData.axis = 'orbit';
            pulse.userData.orbitRadius = 0.22;
        }
        group.add(pulse);
    }
}

export function decorateDistributionHub(group: THREE.Group, assets: InfrastructureDecorationAssets): void {
    const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.35, emissive: 0x0f172a, emissiveIntensity: 0.3 })
    );
    platform.position.y = 0.14;
    group.add(platform);

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.045, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.6 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.22;
    group.add(ring);

    const arrowOffsets: Array<[number, number, number]> = [
        [0, 0, -0.28],
        [0, 0, 0.28],
        [0.28, 0, 0],
        [-0.28, 0, 0],
    ];
    arrowOffsets.forEach(([x, _y, z], index) => {
        const arrow = new THREE.Mesh(assets.junctionArrowGeo, new THREE.MeshBasicMaterial({ color: 0xe9d5ff, transparent: true, opacity: 0.8 }));
        arrow.position.set(x, 0.2, z);
        if (index >= 2) {
            arrow.rotation.y = Math.PI / 2;
        }
        group.add(arrow);
    });
}

export function decorateTrainStation(group: THREE.Group, seed: number, assets: InfrastructureDecorationAssets): void {
    const platform = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 0.12, 1.35),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.65, emissive: 0x082f49, emissiveIntensity: 0.35 })
    );
    platform.position.y = 0.1;
    group.add(platform);

    const hubRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.44, 0.05, 10, 28),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 })
    );
    hubRing.rotation.x = Math.PI / 2;
    hubRing.position.y = 0.28;
    group.add(hubRing);

    const padOffsets: Array<[number, number]> = [
        [0.48, 0.48],
        [-0.48, 0.48],
        [0.48, -0.48],
        [-0.48, -0.48],
    ];
    padOffsets.forEach(([x, z], index) => {
        const pad = new THREE.Mesh(
            assets.dronePadGeo,
            new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x2dd4bf, emissiveIntensity: 0.25, roughness: 0.5, metalness: 0.6 })
        );
        pad.position.set(x, 0.17, z);
        group.add(pad);

        const orb = new THREE.Mesh(
            new THREE.SphereGeometry(0.07, 8, 8),
            new THREE.MeshBasicMaterial({ color: index % 2 === 0 ? 0x2dd4bf : 0x38bdf8, transparent: true, opacity: 0.95 })
        );
        orb.position.y = 0.34;
        orb.userData.isConveyorPulse = true;
        orb.userData.axis = 'orbit';
        orb.userData.orbitRadius = 0.18 + (index * 0.02);
        orb.userData.phase = (index / 4) + ((seed % 17) * 0.01);
        orb.userData.baseY = 0.34;
        group.add(orb);
    });

    const towerOffsets: Array<[number, number]> = [
        [0.62, 0],
        [-0.62, 0],
    ];
    towerOffsets.forEach(([x, z]) => {
        const tower = new THREE.Mesh(assets.beaconGeo, new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.7 }));
        tower.position.set(x, 0.45, z);
        group.add(tower);
    });
}

export function decorateDroneDepot(group: THREE.Group, seed: number, assets: InfrastructureDecorationAssets): void {
    const platform = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.12, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.45, metalness: 0.7, emissive: 0x052e2b, emissiveIntensity: 0.28 })
    );
    platform.position.y = 0.1;
    group.add(platform);

    const deck = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.05, 0.78),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.75, emissive: 0x0f766e, emissiveIntensity: 0.22 })
    );
    deck.position.y = 0.19;
    group.add(deck);

    const controlSpire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.11, 0.82, 10),
        new THREE.MeshStandardMaterial({ color: 0x99f6e4, roughness: 0.25, metalness: 0.8, emissive: 0x2dd4bf, emissiveIntensity: 0.35 })
    );
    controlSpire.position.set(0, 0.55, -0.18);
    group.add(controlSpire);

    const launchRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.045, 10, 24),
        new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.58 })
    );
    launchRing.rotation.x = Math.PI / 2;
    launchRing.position.set(0, 0.24, 0.12);
    group.add(launchRing);

    const padOffsets: Array<[number, number]> = [
        [0.48, 0.3],
        [0.48, -0.3],
        [-0.48, 0.3],
        [-0.48, -0.3],
    ];
    padOffsets.forEach(([x, z], index) => {
        const pad = new THREE.Mesh(
            assets.dronePadGeo,
            new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: index % 2 === 0 ? 0x2dd4bf : 0x99f6e4, emissiveIntensity: 0.3, roughness: 0.45, metalness: 0.65 })
        );
        pad.position.set(x, 0.18, z);
        group.add(pad);

        const drone = new THREE.Mesh(
            assets.dronePacketGeo,
            new THREE.MeshBasicMaterial({ color: index % 2 === 0 ? 0x2dd4bf : 0x99f6e4, transparent: true, opacity: 0.95 })
        );
        drone.userData.isConveyorPulse = true;
        drone.userData.axis = 'orbit';
        drone.userData.orbitRadius = 0.26 + (index * 0.03);
        drone.userData.phase = (index / 4) + ((seed % 23) * 0.01);
        drone.userData.baseY = 0.52 + ((index % 2) * 0.06);
        group.add(drone);
    });
}
