import { BuildingType, Era, EraDef } from '../../types';

export const ERAS: Record<Era, EraDef> = {
  [Era.SETTLEMENT]: {
    id: Era.SETTLEMENT,
    name: 'Era 1: Settlement',
    description: 'Establish your colony basics',
    unlockConditions: { tutorialComplete: true },
    color: '#94a3b8',
    milestones: [
      { id: 'founding', name: 'Colony Established', target: 1 },
      { id: 'first_resources', name: 'Resource Chain', target: 1 }
    ]
  },
  [Era.GROWTH]: {
    id: Era.GROWTH,
    name: 'Era 2: Growth',
    description: 'Expand after proving the starter economy works',
    unlockConditions: {
      minAgt: 5000,
      minBuildings: 3,
      requiredBuildings: [BuildingType.STAFF_QUARTERS, BuildingType.STORAGE_DEPOT, BuildingType.MINING_HEADFRAME]
    } as any,
    color: '#22c55e',
    milestones: [
      { id: 'starter_base', name: 'Starter Base', target: 3 },
      { id: 'first_delivery_fund', name: 'First Delivery Fund', target: 5000 }
    ]
  },
  [Era.INDUSTRY]: {
    id: Era.INDUSTRY,
    name: 'Era 3: Industry',
    description: 'Heavy production and resource scaling',
    unlockConditions: { minColonists: 12, minEco: 40, minAgt: 20000 },
    color: '#eab308',
    milestones: [
      { id: 'industrial_core', name: 'Industrial Core', target: 12 },
      { id: 'eco_balance', name: 'Eco Awareness', target: 40 },
      { id: 'massive_capital', name: 'Industrial Fund', target: 20000 }
    ]
  },
  [Era.SUSTAINABILITY]: {
    id: Era.SUSTAINABILITY,
    name: 'Era 4: Sustainability',
    description: 'Balance restoration and advanced tech',
    unlockConditions: { minEco: 70, minTrust: 60, minAgt: 50000 },
    color: '#3b82f6',
    milestones: [
      { id: 'green_future', name: 'Green Haven', target: 70 },
      { id: 'social_harmony', name: 'Social Glue', target: 60 }
    ]
  },
  [Era.PROSPERITY]: {
    id: Era.PROSPERITY,
    name: 'Era 5: Prosperity',
    description: 'The height of development',
    unlockConditions: { minEco: 90, minTrust: 90, minColonists: 25 },
    color: '#a855f7',
    milestones: [
      { id: 'utopia_eco', name: 'Eco Utopia', target: 90 },
      { id: 'utopia_social', name: 'Social Utopia', target: 90 },
      { id: 'galactic_hub', name: 'Galactic Hub', target: 25 }
    ]
  }
};
