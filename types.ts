
/**
 * Aureus Engine - Unified Types
 * This file re-exports all domain types for backward compatibility
 */

export * from './game/types/world';
export * from './game/types/agents';
export * from './game/types/buildings';
export * from './game/types/economy';
export * from './game/types/game';
export * from './game/types/underground';
export * from './game/types/layeredWorld';

export type SidebarMode = 'NONE' | 'OPS' | 'SHOP' | 'TRADE';

export type Action = {
  type: string;
  payload?: any;
};
