
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { BuildingType, BuildingDef, GameState, TechId, TechDefinition } from '../../types';

export const COLORS = {
  BG: 0x87CEEB, // Sky Blue
  GRID_BASE: 0x5D9E45, // Grass Green
  GRID_HIGHLIGHT: 0x6EBC53, // lighter green
  HIGHLIGHT_VALID: 0x10b981, // Green
  HIGHLIGHT_INVALID: 0xe11d48, // Red
};

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  [BuildingType.EMPTY]: {
    type: BuildingType.EMPTY,
    name: 'Empty Lot',
    cost: 0,
    desc: 'An empty plot of Zimbabwean soil.',
    ecoReq: 0,
    stats: '',
    buildTime: 0,
    maintenance: 0,
    pollution: 0
  },
  [BuildingType.ROAD]: {
    type: BuildingType.ROAD,
    name: 'Road',
    cost: 5,
    desc: 'Connects buildings. Cheap infrastructure.',
    ecoReq: 0,
    stats: 'Infrastructure',
    buildTime: 1,
    maintenance: 0,
    pollution: 0
  },
  [BuildingType.PIPE]: {
    type: BuildingType.PIPE,
    name: 'Water Pipe',
    cost: 15,
    desc: 'Connects water sources to industrial buildings.',
    ecoReq: 0,
    stats: 'Infrastructure',
    buildTime: 5,
    maintenance: 0.5,
    pollution: 0
  },
  [BuildingType.FENCE]: {
    type: BuildingType.FENCE,
    name: 'Perimeter Fence',
    cost: 8,
    desc: 'Secure your borders. Prevents illegal entry in a radius when connected to Security.',
    ecoReq: 0,
    stats: 'Infrastructure',
    buildTime: 2,
    maintenance: 0.1,
    pollution: 0
  },
  [BuildingType.POND]: {
    type: BuildingType.POND,
    name: 'Water Pond',
    cost: 150,
    desc: 'A small natural body of water.',
    ecoReq: 0,
    stats: 'Water Source',
    buildTime: 0,
    maintenance: 0,
    pollution: -0.1
  },
  [BuildingType.RESERVOIR]: {
    type: BuildingType.RESERVOIR,
    name: 'Industrial Reservoir',
    cost: 5000,
    desc: 'Large volume water storage and pump station.',
    ecoReq: 15,
    stats: 'High Output Water',
    width: 3,
    depth: 3,
    buildTime: 90,
    maintenance: 40,
    pollution: 0.2, // Minor pollution from pumps
    production: 5,
    productionType: 'TRUST' // Provides stability
  },
  [BuildingType.STAFF_QUARTERS]: {
    type: BuildingType.STAFF_QUARTERS,
    name: 'Staff Quarters',
    cost: 1200,
    desc: 'Dense housing for your workforce. Restores Energy.',
    ecoReq: 0,
    stats: '+Energy Recovery',
    width: 2,
    depth: 2,
    buildTime: 15,
    maintenance: 5, // Increased from 0
    pollution: 0.6, // Increased from 0.4
    production: 10, // Reduced from 30
    productionType: 'AGT'
  },
  [BuildingType.CANTEEN]: {
    type: BuildingType.CANTEEN,
    name: 'Hydro-Canteen',
    cost: 800,
    desc: 'Vertical farm and dining hall. Restores Hunger.',
    ecoReq: 0,
    stats: '+Hunger Recovery',
    width: 2,
    depth: 2,
    buildTime: 20,
    maintenance: 10,
    pollution: -0.5,
  },
  [BuildingType.SOCIAL_HUB]: {
    type: BuildingType.SOCIAL_HUB,
    name: 'Solaris Social Hub',
    cost: 1500,
    desc: 'Community dome for relaxation. Restores Mood.',
    ecoReq: 10,
    stats: '+Mood Recovery',
    width: 2,
    depth: 2,
    buildTime: 30,
    maintenance: 20,
    pollution: 0,
  },
  [BuildingType.SECURITY_POST]: {
    type: BuildingType.SECURITY_POST,
    name: 'Security Post',
    cost: 600,
    desc: 'Tower monitors activity to prevent theft.',
    ecoReq: 0,
    stats: 'Stops Theft',
    buildTime: 25,
    dependency: BuildingType.STAFF_QUARTERS,
    maintenance: 15,
    pollution: 0,
    production: 1,
    productionType: 'TRUST'
  },
  [BuildingType.WASH_PLANT]: {
    type: BuildingType.WASH_PLANT,
    name: 'Industrial Wash Plant',
    cost: 1200,
    desc: 'Massive throughput for ore cleaning. Highly polluting.',
    ecoReq: 0,
    stats: '+25 Minerals/s',
    width: 2,
    depth: 2,
    buildTime: 45,
    dependency: BuildingType.STAFF_QUARTERS,
    maintenance: 35, // Increased from 25
    pollution: 12.0, // Increased from 8.0
    production: 25, // Reduced from 40
    productionType: 'MINERALS'
  },
  [BuildingType.RECYCLING_PLANT]: {
    type: BuildingType.RECYCLING_PLANT,
    name: 'Recycling Complex',
    cost: 3000,
    desc: 'Clean industrial processing with high efficiency.',
    ecoReq: 30,
    stats: '+20 Min/s, Low Pol',
    width: 2,
    depth: 2,
    buildTime: 60,
    dependency: BuildingType.STAFF_QUARTERS,
    maintenance: 15,
    pollution: 1.0,
    production: 20,
    productionType: 'MINERALS'
  },
  [BuildingType.SOLAR_ARRAY]: {
    type: BuildingType.SOLAR_ARRAY,
    name: 'Solar Array',
    cost: 500,
    desc: 'High-density photovoltaic panels.',
    ecoReq: 0,
    stats: 'Regens Eco',
    width: 2,
    depth: 1,
    buildTime: 20,
    maintenance: 5,
    pollution: -2.0 // Reduced from -3.0 for balance
  },
  [BuildingType.COMMUNITY_GARDEN]: {
    type: BuildingType.COMMUNITY_GARDEN,
    name: 'Urban Garden',
    cost: 600,
    desc: 'Green space that fosters local community trust.',
    ecoReq: 0,
    stats: '+4 Trust/s',
    width: 2,
    depth: 2,
    buildTime: 50,
    maintenance: 8,
    pollution: -1.5,
    production: 4,
    productionType: 'TRUST'
  },
  [BuildingType.WATER_WELL]: {
    type: BuildingType.WATER_WELL,
    name: 'Deep-Well Pump',
    cost: 1200,
    desc: 'Draws clean water from aquifers.',
    ecoReq: 5,
    stats: '+2 Trust/s',
    buildTime: 40,
    maintenance: 5,
    pollution: 0,
    production: 2,
    productionType: 'TRUST'
  },
  [BuildingType.WIND_TURBINE]: {
    type: BuildingType.WIND_TURBINE,
    name: 'Wind Turbine',
    cost: 2500,
    desc: 'Tall turbine harnessing renewable wind energy.',
    ecoReq: 10,
    stats: 'Massive Eco Regen',
    buildTime: 90,
    maintenance: 10,
    pollution: -6.0
  },
  [BuildingType.LOCAL_SCHOOL]: {
    type: BuildingType.LOCAL_SCHOOL,
    name: 'Education Center',
    cost: 12000, // Increased for 3x3
    desc: 'Large campus with classrooms, library, and sports facilities.',
    ecoReq: 20,
    stats: '+25 Trust/s',
    width: 3,
    depth: 3,
    buildTime: 300, // Longer build time
    maintenance: 80,
    pollution: 0.3,
    production: 25, // Increased production
    productionType: 'TRUST'
  },
  [BuildingType.SAFARI_LODGE]: {
    type: BuildingType.SAFARI_LODGE,
    name: 'Eco-Lodge Resort',
    cost: 35000, // Increased for 3x3
    desc: 'Luxury sustainable tourism resort with multiple lodges.',
    ecoReq: 40,
    stats: '+150 AGT/s',
    width: 3,
    depth: 3,
    buildTime: 500, // Longer build time
    maintenance: 100,
    pollution: 1.5, // Less pollution for eco building
    production: 150, // Better production for cost
    productionType: 'AGT'
  },
  [BuildingType.GREEN_TECH_LAB]: {
    type: BuildingType.GREEN_TECH_LAB,
    name: 'Research Biosphere',
    cost: 80000, // Increased for 3x3
    desc: 'Massive research complex for planetary restoration technology.',
    ecoReq: 60,
    stats: 'Extreme Eco Regen',
    width: 3,
    depth: 3,
    buildTime: 1000, // Very long build time
    maintenance: 200,
    pollution: -40.0 // Massive eco benefit
  },
  [BuildingType.MINING_HEADFRAME]: {
    type: BuildingType.MINING_HEADFRAME,
    name: 'Mining Headframe',
    cost: 45000,
    desc: 'Massive industrial mining tower with ore extraction wheel. High throughput.',
    ecoReq: 0,
    stats: '+60 Minerals/s',
    width: 4,
    depth: 4,
    buildTime: 600,
    dependency: BuildingType.WASH_PLANT,
    maintenance: 120,
    pollution: 25.0,
    production: 60,
    productionType: 'MINERALS'
  },
  [BuildingType.ORE_FOUNDRY]: {
    type: BuildingType.ORE_FOUNDRY,
    name: 'Ore Foundry',
    cost: 25000,
    desc: 'High-temperature smelting facility. Converts raw ore to refined materials.',
    ecoReq: 10,
    stats: '+40 Min/s, +Gems',
    width: 3,
    depth: 3,
    buildTime: 400,
    dependency: BuildingType.WASH_PLANT,
    maintenance: 80,
    pollution: 18.0,
    production: 40,
    productionType: 'MINERALS'
  }
};

export const INITIAL_RESOURCES = {
  agt: 0,
  minerals: 0,
  gems: 5, // Reduced from 10
  eco: 60, // Reduced from 75
  trust: 15 // Reduced from 20
};

export const TECHNOLOGIES: Record<TechId, TechDefinition> = {
  // Industrial
  'ADVANCED_DRILLING': {
    id: 'ADVANCED_DRILLING',
    name: 'Diamond-Tipped Drills',
    description: 'Harder drill bits increase mineral extraction yield.',
    cost: 2000,
    category: 'INDUSTRIAL',
    prereq: null,
    effectDesc: '+15% Mineral Production'
  },
  'MARKET_ANALYTICS': {
    id: 'MARKET_ANALYTICS',
    name: 'Market Analytics AI',
    description: 'Predict global demand to sell at peak prices.',
    cost: 4500,
    category: 'INDUSTRIAL',
    prereq: 'ADVANCED_DRILLING',
    effectDesc: '+20% Sell Value'
  },
  'AUTOMATION': {
    id: 'AUTOMATION',
    name: 'Drone Automation',
    description: 'Automated hauling drones reduce operational waste.',
    cost: 12000,
    category: 'INDUSTRIAL',
    prereq: 'MARKET_ANALYTICS',
    effectDesc: '+25% Production, -10% Upkeep'
  },

  // Ecological
  'PHOTOVOLTAICS': {
    id: 'PHOTOVOLTAICS',
    name: 'Adv. Photovoltaics',
    description: 'Next-gen solar cells with higher energy density.',
    cost: 2500,
    category: 'ECOLOGICAL',
    prereq: null,
    effectDesc: '+20% Solar Efficiency'
  },
  'WATER_RECYCLING': {
    id: 'WATER_RECYCLING',
    name: 'Closed-Loop Water',
    description: 'Recycle 90% of industrial wastewater.',
    cost: 5000,
    category: 'ECOLOGICAL',
    prereq: 'PHOTOVOLTAICS',
    effectDesc: '-30% Pollution Generation'
  },
  'CARBON_CAPTURE': {
    id: 'CARBON_CAPTURE',
    name: 'Direct Air Capture',
    description: 'Experimental towers that suck CO2 from the sky.',
    cost: 15000,
    category: 'ECOLOGICAL',
    prereq: 'WATER_RECYCLING',
    effectDesc: '-50% Pollution Generation'
  },

  // Social
  'COMMUNITY_OUTREACH': {
    id: 'COMMUNITY_OUTREACH',
    name: 'Community Outreach',
    description: 'Sponsor local events and festivals.',
    cost: 1500,
    category: 'SOCIAL',
    prereq: null,
    effectDesc: '+20% Trust Gain'
  },
  'NEIGHBORHOOD_WATCH': {
    id: 'NEIGHBORHOOD_WATCH',
    name: 'Neighborhood Watch',
    description: 'Organized locals helping secure the perimeter.',
    cost: 4000,
    category: 'SOCIAL',
    prereq: 'COMMUNITY_OUTREACH',
    effectDesc: 'Reduces Theft Chance'
  },
  'EDUCATION_REFORM': {
    id: 'EDUCATION_REFORM',
    name: 'Stem Scholarship',
    description: 'Fund local students to become engineers.',
    cost: 10000,
    category: 'SOCIAL',
    prereq: 'NEIGHBORHOOD_WATCH',
    effectDesc: '+50% Trust Gain, +10% Production'
  }
};
