
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';
import { Agent, AgentRole } from '../types';
import { buildVoxelGroup } from '../utils/voxelBuilder';

/**
 * Role-based configurations including colors and accessory flags
 */
const ROLES: Record<string, { color: string; accessory: string }> = {
  ENGINEER: { color: '#3b82f6', accessory: 'TOOL_BELT' },
  MINER: { color: '#ef4444', accessory: 'BACKPACK_PICKAXE' },
  BOTANIST: { color: '#22c55e', accessory: 'SATCHEL' },
  SECURITY: { color: '#e11d48', accessory: 'SHOULDER_PADS' },
  WORKER: { color: '#f59e0b', accessory: 'NONE' },
  ILLEGAL_MINER: { color: '#0f172a', accessory: 'HOOD' }
};

const SKIN_COLOR = '#f1c27d';
const CLOTH_COLOR = '#1e293b';
const ACCENT_WHITE = '#ffffff';

/**
 * Procedural Agent Generator with Role Accessories
 */
export function createAgentGroup(agent: Agent): THREE.Group {
  const config = ROLES[agent.type] || ROLES['WORKER'];
  const root = new THREE.Group();
  const roleColor = config.color;

  const parts: Record<string, {x:number, y:number, z:number, c:string}[]> = { 
      head: [], torso: [], armL: [], armR: [], legL: [], legR: [] 
  };

  // --- Legs ---
  for (let y = 0; y < 6; y++) {
    for (let x = -2; x <= -1; x++) for (let z = 0; z <= 1; z++) parts.legL.push({ x, y, z, c: CLOTH_COLOR });
    for (let x = 1; x <= 2; x++) for (let z = 0; z <= 1; z++) parts.legR.push({ x, y, z, c: CLOTH_COLOR });
  }

  // --- Torso ---
  for (let y = 6; y < 13; y++) {
    for (let x = -2; x <= 2; x++) {
      for (let z = 0; z <= 1; z++) {
        const isBadge = (y === 10 || y === 11) && x === 0 && z === 1;
        parts.torso.push({ x, y, z, c: isBadge ? ACCENT_WHITE : roleColor });
      }
    }
  }

  // --- Accessories (Contextual) ---
  if (config.accessory === 'BACKPACK_PICKAXE') {
    // Backpack
    for (let y = 7; y < 12; y++) 
      for (let x = -2; x <= 2; x++) 
        for (let z = -1; z < 0; z++) parts.torso.push({ x, y, z, c: '#451a03' });
  } else if (config.accessory === 'SHOULDER_PADS') {
    for (let x of [-3, 3]) 
      for (let y = 11; y < 14; y++) 
        for (let z = -1; z <= 2; z++) parts.torso.push({ x, y, z, c: '#1e293b' });
  } else if (config.accessory === 'TOOL_BELT') {
    for (let x = -3; x <= 3; x++) parts.torso.push({ x, y: 6, z: 1.2, c: '#78350f' });
  }

  // --- Arms ---
  for (let y = 8; y < 13; y++) {
    for (let z = 0; z <= 1; z++) {
      parts.armL.push({ x: -3, y, z, c: SKIN_COLOR });
      parts.armR.push({ x: 3, y, z, c: SKIN_COLOR });
    }
  }

  // --- Head ---
  for (let y = 13; y < 19; y++) {
    for (let x = -2; x <= 2; x++) {
      for (let z = -1; z <= 1; z++) {
        // Rounding
        if (y === 13 && (Math.abs(x) === 2 || Math.abs(z) === 1)) continue;
        if (y === 18 && (Math.abs(x) === 2 || Math.abs(z) === 1)) continue;

        let c = SKIN_COLOR;
        if (y === 16 && (x === -1 || x === 1) && z === 1) c = '#000000'; // Eyes
        if (y >= 17) c = (config.accessory === 'HOOD') ? '#0f172a' : '#221100'; // Hair/Hood
        
        parts.head.push({ x, y, z, c });
      }
    }
  }

  const pivots = {
    head: { x: 0, y: 13, z: 0.5 },
    armL: { x: -2.5, y: 12, z: 0.5 },
    armR: { x: 2.5, y: 12, z: 0.5 },
    legL: { x: -1.5, y: 6, z: 0.5 },
    legR: { x: 1.5, y: 6, z: 0.5 }
  };

  // Helper to offset voxel coordinates by pivot
  const buildPart = (voxels: any[], pivot: {x:number, y:number, z:number}) => {
      const adjusted = voxels.map(v => ({
          x: v.x - pivot.x,
          y: v.y - pivot.y,
          z: v.z - pivot.z,
          c: v.c
      }));
      // Using the new optimized mesher
      return buildVoxelGroup(adjusted);
  };

  const meshParts: Record<string, THREE.Group> = {
    head: buildPart(parts.head, pivots.head),
    torso: buildPart(parts.torso, { x: 0, y: 0, z: 0.5 }),
    armL: buildPart(parts.armL, pivots.armL),
    armR: buildPart(parts.armR, pivots.armR),
    legL: buildPart(parts.legL, pivots.legL),
    legR: buildPart(parts.legR, pivots.legR)
  };

  // Cache parts on root for O(1) access during animation
  root.userData.parts = {};

  Object.entries(meshParts).forEach(([name, mesh]) => {
    mesh.name = name;
    if (name !== 'torso') {
        // @ts-ignore
        const p = pivots[name];
        mesh.position.set(p.x, p.y, p.z);
    }
    root.add(mesh);
    root.userData.parts[name] = mesh;
  });

  root.scale.set(0.04, 0.04, 0.04);
  return root;
}

export function updateAgentRoleMaterial(group: THREE.Group, role: AgentRole) {
    // Meshing approach requires full rebuild for simplicity if role changes
}
