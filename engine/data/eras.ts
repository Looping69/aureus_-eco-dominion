import { BuildingType, Era, EraDef } from '../../types';

export const ERAS: Record<Era, EraDef> = {
  [Era.SETTLEMENT]: {
    id: Era.SETTLEMENT,
    name: 'Chapter I: Dust Claim',
    description: 'Three founders, one charter, and a valley that has not decided whether to welcome you.',
    unlockConditions: { tutorialComplete: true },
    color: '#94a3b8',
    milestones: [
      { id: 'founding', name: 'First Campfire', target: 1 },
      { id: 'first_resources', name: 'The Ground Answers', target: 1 }
    ]
  },
  [Era.GROWTH]: {
    id: Era.GROWTH,
    name: 'Chapter II: The Camp Becomes A Town',
    description: 'Beds, storage, and the first honest delivery turn a claim into a place people might trust.',
    unlockConditions: {
      minColonists: 3,
      minAgt: 5000,
      minBuildings: 3,
      requiredBuildings: [BuildingType.STAFF_QUARTERS, BuildingType.STORAGE_DEPOT, BuildingType.MINING_HEADFRAME]
    } as any,
    color: '#22c55e',
    milestones: [
      { id: 'starter_base', name: 'A Roof And A Depot', target: 3 },
      { id: 'first_delivery_fund', name: 'Payroll Secured', target: 5000 }
    ]
  },
  [Era.INDUSTRY]: {
    id: Era.INDUSTRY,
    name: 'Chapter III: Iron Under The Grass',
    description: 'Heavy machines arrive. The colony can become powerful, careless, or something rarer.',
    unlockConditions: { minColonists: 12, minEco: 40, minAgt: 20000 },
    color: '#eab308',
    milestones: [
      { id: 'industrial_core', name: 'Twelve Names On The Roster', target: 12 },
      { id: 'eco_balance', name: 'Still Breathing', target: 40 },
      { id: 'massive_capital', name: 'Industrial Fund', target: 20000 }
    ]
  },
  [Era.SUSTAINABILITY]: {
    id: Era.SUSTAINABILITY,
    name: 'Chapter IV: Debt To The Land',
    description: 'The bill comes due. Restore what you can, clean what you broke, and prove progress can have memory.',
    unlockConditions: { minEco: 70, minTrust: 60, minAgt: 50000 },
    color: '#3b82f6',
    milestones: [
      { id: 'green_future', name: 'Land Recovered', target: 70 },
      { id: 'social_harmony', name: 'Trusted Enough To Stay', target: 60 }
    ]
  },
  [Era.PROSPERITY]: {
    id: Era.PROSPERITY,
    name: 'Chapter V: Dominion Or Stewardship',
    description: 'The world is watching now. Build the future, and decide what kind of power Aureus becomes.',
    unlockConditions: { minEco: 90, minTrust: 90, minColonists: 25 },
    color: '#a855f7',
    milestones: [
      { id: 'utopia_eco', name: 'Land Recovered', target: 90 },
      { id: 'utopia_social', name: 'People Believe', target: 90 },
      { id: 'galactic_hub', name: 'A City With A Skyport', target: 25 }
    ]
  }
};
