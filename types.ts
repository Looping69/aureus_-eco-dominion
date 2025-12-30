
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export enum BuildingType {
  EMPTY = 'EMPTY',
  WASH_PLANT = 'WASH_PLANT',
  RECYCLING_PLANT = 'RECYCLING_PLANT',
  SOLAR_ARRAY = 'SOLAR_ARRAY',
  COMMUNITY_GARDEN = 'COMMUNITY_GARDEN',
  WATER_WELL = 'WATER_WELL',
  WIND_TURBINE = 'WIND_TURBINE',
  LOCAL_SCHOOL = 'LOCAL_SCHOOL',
  SAFARI_LODGE = 'SAFARI_LODGE',
  GREEN_TECH_LAB = 'GREEN_TECH_LAB',
  STAFF_QUARTERS = 'STAFF_QUARTERS',
  SECURITY_POST = 'SECURITY_POST',
  CANTEEN = 'CANTEEN',
  SOCIAL_HUB = 'SOCIAL_HUB',
  MINING_HEADFRAME = 'MINING_HEADFRAME',
  ORE_FOUNDRY = 'ORE_FOUNDRY',
  // Infrastructure
  POND = 'POND',
  RESERVOIR = 'RESERVOIR',
  PIPE = 'PIPE',
  ROAD = 'ROAD',
  FENCE = 'FENCE'
}

export type AgentRole = 'WORKER' | 'MINER' | 'BOTANIST' | 'ENGINEER' | 'SECURITY' | 'ILLEGAL_MINER';

export type JobType = 'BUILD' | 'MINE' | 'FARM' | 'REPAIR' | 'RESEARCH' | 'SLEEP' | 'IDLE' | 'MOVE' | 'REHABILITATE' | 'EAT' | 'SOCIALIZE' | 'PATROL';

export interface Job {
  id: string;
  type: JobType;
  targetTileId: number;
  priority: number; // 1-5
  assignedAgentId: string | null;
  progress?: number;
}

export interface ColonistStats {
  mining: number;
  construction: number;
  plants: number;
  intelligence: number;
}

export interface Agent {
  id: string;
  name: string;
  type: AgentRole;
  x: number;
  z: number;
  targetTileId: number | null;
  path: number[] | null;
  state: 'MOVING' | 'WORKING' | 'IDLE' | 'SLEEPING' | 'EATING' | 'RELAXING' | 'SOCIALIZING';

  // Needs
  energy: number; // 0-100
  hunger: number; // 0-100
  mood: number; // 0-100

  // Colonist specific
  skills: ColonistStats;
  currentJobId: string | null;
}

export type BiomeType = 'GRASS' | 'DIRT' | 'SAND' | 'STONE' | 'SNOW';

export type FoliageType =
  | 'NONE'
  // Functional
  | 'GOLD_VEIN'
  | 'MINE_HOLE'
  | 'ILLEGAL_CAMP'
  // Grass Biome
  | 'TREE_OAK'
  | 'TREE_BIRCH'
  | 'TREE_WILLOW'
  | 'TREE_APPLE'
  | 'BUSH_OAK'
  | 'FLOWER_YELLOW'
  // Snow Biome
  | 'TREE_PINE'
  | 'TREE_FROSTED_PINE'
  | 'TREE_TALL_PINE'
  | 'SHRUB_WINTER'
  | 'ROCK_ICY'
  // Sand Biome
  | 'CACTUS_SAGUARO'
  | 'CACTUS_BARREL'
  | 'TREE_PALM'
  | 'SHRUB_DRY'
  | 'ROCK_SANDSTONE'
  // Dirt Biome
  | 'TREE_DEAD'
  | 'TREE_STUMP'
  | 'BUSH_THORN'
  | 'MUSHROOM_GIANT'
  | 'BONE_RIB'
  // Stone Biome
  | 'ROCK_BOULDER'
  | 'ROCK_PEBBLE'
  | 'ROCK_MOSSY'
  | 'FLOWER_ALPINE'
  | 'CRYSTAL_SPIKE';

export interface GridTile {
  id: number;
  x: number;
  y: number;
  buildingType: BuildingType;
  level: number;
  terrainHeight: number;
  biome: BiomeType;
  foliage?: FoliageType;
  locked?: boolean;
  integrity?: number;
  isUnderConstruction?: boolean;
  constructionTimeLeft?: number;
  structureHeadIndex?: number;
  waterStatus?: 'CONNECTED' | 'DISCONNECTED';
  rehabProgress?: number; // 0-100
  explored?: boolean;
}

export interface GameResources {
  agt: number;
  minerals: number;
  gems: number;
  eco: number;
  trust: number;
}

export interface BuildingDef {
  type: BuildingType;
  name: string;
  cost: number;
  desc: string;
  ecoReq: number;
  stats: string;
  width?: number;
  depth?: number;
  buildTime: number;
  dependency?: BuildingType;
  maintenance: number;
  pollution: number;
  production?: number;
  productionType?: 'MINERALS' | 'AGT' | 'ECO' | 'TRUST';
}

export interface LogisticsState {
  autoSell: boolean;
  sellThreshold: number;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  type: 'BUILD' | 'RESOURCE' | 'STAT';
  targetType: BuildingType | 'AGT' | 'MINERALS' | 'ECO' | 'TRUST';
  targetValue: number;
  currentValue: number;
  reward: { type: 'AGT' | 'GEMS', amount: number };
  completed: boolean;
}

export interface NewsItem {
  id: string;
  headline: string;
  type: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'CRITICAL';
  timestamp: number;
}

export interface GlobalEvent {
  id: string;
  name: string;
  type: 'WEATHER' | 'ECONOMIC' | 'GEOLOGICAL' | 'SOCIAL' | 'INCURSION';
  duration: number; // in ticks
  description: string;
  visualTheme?: 'NORMAL' | 'TOXIC' | 'HEAT' | 'GOLDEN';
  modifiers?: {
    productionMult?: number;
    sellPriceMult?: number;
    ecoRegenMult?: number;
    trustGainMult?: number;
    energyDecayMult?: number;
  };
}

export type TechId =
  | 'ADVANCED_DRILLING' | 'MARKET_ANALYTICS' | 'AUTOMATION'
  | 'PHOTOVOLTAICS' | 'WATER_RECYCLING' | 'CARBON_CAPTURE'
  | 'COMMUNITY_OUTREACH' | 'NEIGHBORHOOD_WATCH' | 'EDUCATION_REFORM';

export interface TechDefinition {
  id: TechId;
  name: string;
  description: string;
  cost: number;
  category: 'INDUSTRIAL' | 'ECOLOGICAL' | 'SOCIAL';
  prereq: TechId | null;
  effectDesc: string;
}

export interface ResearchState {
  unlocked: TechId[];
}

export enum GameStep {
  INTRO = 'INTRO',
  TUTORIAL_MINE = 'TUTORIAL_MINE',
  TUTORIAL_SELL = 'TUTORIAL_SELL',
  TUTORIAL_BUY = 'TUTORIAL_BUY',
  TUTORIAL_PLACE = 'TUTORIAL_PLACE',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export enum SfxType {
  BUILD = 'BUILD',
  SELL = 'SELL',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
  UI_CLICK = 'UI_CLICK',
  UI_OPEN = 'UI_OPEN',
  CONSTRUCT_SPEEDUP = 'CONSTRUCT_SPEEDUP',
  MINING_HIT = 'MINING_HIT',
  CAMP_BUILD = 'CAMP_BUILD',
  CAMP_RUSTLE = 'CAMP_RUSTLE',
  DEATH = 'DEATH'
}

export type GameDiff =
  | { type: 'GRID_UPDATE', updates: GridTile[] }
  | { type: 'FX', fxType: 'MINING' | 'THEFT' | 'ECO_REHAB' | 'DEATH' | 'SMOKE' | 'DUST', index: number };

export type SimulationEffect =
  | GameDiff
  | { type: 'AUDIO', sfx: SfxType };

export interface GameState {
  resources: GameResources;
  grid: GridTile[];
  agents: Agent[];
  jobs: Job[];
  inventory: Partial<Record<BuildingType, number>>;
  selectedBuilding: BuildingType | null;
  selectedAgentId: string | null;
  interactionMode: 'BUILD' | 'BULLDOZE' | 'INSPECT';
  step: GameStep;
  tickCount: number;
  viewMode: 'SURFACE' | 'UNDERGROUND' | 'FIRST_PERSON';
  logistics: LogisticsState;
  activeGoal: Goal | null;
  newsFeed: NewsItem[];
  activeEvents: GlobalEvent[];
  research: ResearchState;
  debugMode: boolean;
  cheatsEnabled: boolean;
  pendingEffects: SimulationEffect[];
  // Galactic Trade System
  market: MarketState;
  contracts: Contract[];

  // Environmental System
  weather: WeatherState;
}

export type WeatherType = 'CLEAR' | 'DUST_STORM' | 'ACID_RAIN';

export interface WeatherState {
  current: WeatherType;
  timeLeft: number; // Ticks remaining
  intensity: number; // 0-1
}

export interface MarketState {
  minerals: ResourceMarket;
  gems: ResourceMarket;
  lastEvent?: string; // e.g. "War in Sector 4"
  eventDuration: number;
}

export interface ResourceMarket {
  basePrice: number;
  currentPrice: number;
  trend: 'STABLE' | 'RISING' | 'FALLING' | 'SPIKE_UP' | 'CRASH_DOWN';
  history: number[]; // For sparkline graph (last 20 ticks)
  volatility: number;
}

export interface Contract {
  id: string;
  description: string;
  resource: 'MINERALS' | 'GEMS';
  amount: number;
  reward: number; // AGT payout
  timeLeft: number; // Seconds
  penalty: number; // Reputation/Trust hit if failed
}

export type Action =
  | { type: 'TICK' }
  | { type: 'SELL_MINERALS' }
  | { type: 'UPDATE_LOGISTICS', payload: Partial<LogisticsState> }
  | { type: 'BUY_BUILDING', payload: { type: BuildingType, cost: number } }
  | { type: 'SELECT_BUILDING_TO_PLACE', payload: BuildingType | null }
  | { type: 'SELECT_AGENT', payload: string | null }
  | { type: 'COMMAND_AGENT', payload: { agentId: string, tileId: number } }
  | { type: 'ACTIVATE_BULLDOZER' }
  | { type: 'PLACE_BUILDING', payload: { index: number } }
  | { type: 'PLACE_BATCH_BUILDING', payload: { indices: number[], cost: number } }
  | { type: 'BULLDOZE_TILE', payload: { index: number } }
  | { type: 'SPEED_UP_BUILDING', payload: { index: number } }
  | { type: 'REHABILITATE_TILE', payload: { index: number } }
  | { type: 'ADVANCE_TUTORIAL' }
  | { type: 'SKIP_TUTORIAL' }
  | { type: 'RESET_GAME' }
  | { type: 'TOGGLE_VIEW' }
  | { type: 'TOGGLE_DEBUG' }
  | { type: 'TOGGLE_CHEATS' }
  | { type: 'ENTER_FPS' }
  | { type: 'EXIT_FPS' }
  | { type: 'CLAIM_GOAL' }
  | { type: 'DISMISS_NEWS', payload: string }
  | { type: 'UNLOCK_TECH', payload: TechId }
  | { type: 'MINE_CLICK', payload: { index: number } }
  | { type: 'LOAD_GAME', payload: GameState };
