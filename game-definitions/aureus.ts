import { BuildingType } from '../types';
import type { AgentRole } from '../types';
import { BUILDINGS, INITIAL_RESOURCES } from '../engine/data/VoxelConstants';
import { RAW_AGENT_ROLE_SCHEMA } from '../engine/data/agentRoles';
import { COMBAT_WEAPONS, ROLE_WEAPON_LOADOUTS } from '../engine/data/combatWeapons';
import { RESOURCE_GRID_ROLE_SCHEMA } from '../engine/data/resourceGridRoleSchema';
import { defineGameDefinition, type EntityArchetypeDefinition, type GameActionDefinition, type GameResourceDefinition, type GameSystemBindingDefinition } from '../engine/game-definition';

const resourceDefinitions: GameResourceDefinition[] = [
    { id: 'agt', label: 'AGT', kind: 'currency', initial: INITIAL_RESOURCES.agt, min: 0, tradeable: true, description: 'Primary treasury currency used to buy buildings and trade.' },
    { id: 'minerals', label: 'Minerals', kind: 'material', initial: INITIAL_RESOURCES.minerals, min: 0, capacityResourceId: 'maxCapacity', tradeable: true, description: 'Core mined material for construction and industrial chains.' },
    { id: 'gems', label: 'Gems', kind: 'material', initial: INITIAL_RESOURCES.gems, min: 0, capacityResourceId: 'maxCapacity', tradeable: true, description: 'Rare high-value resource used for advanced upgrades.' },
    { id: 'wood', label: 'Wood', kind: 'material', initial: INITIAL_RESOURCES.wood, min: 0, capacityResourceId: 'maxCapacity', tradeable: true, description: 'Harvested construction material for early and ecological structures.' },
    { id: 'stone', label: 'Stone', kind: 'material', initial: INITIAL_RESOURCES.stone, min: 0, capacityResourceId: 'maxCapacity', tradeable: true, description: 'Quarried construction material for infrastructure and heavy buildings.' },
    { id: 'eco', label: 'Eco', kind: 'reputation', initial: INITIAL_RESOURCES.eco, min: 0, max: 100, description: 'Environmental health score used to unlock sustainable growth.' },
    { id: 'trust', label: 'Trust', kind: 'reputation', initial: INITIAL_RESOURCES.trust, min: 0, max: 100, description: 'Community trust score used to unlock social and civic expansion.' },
    { id: 'income', label: 'Income', kind: 'derived', initial: 0, description: 'Per-second AGT production calculated by simulation systems.' },
    { id: 'maintenance', label: 'Maintenance', kind: 'derived', initial: 0, description: 'Per-second AGT upkeep calculated by simulation systems.' },
    { id: 'maxCapacity', label: 'Storage Capacity', kind: 'capacity', initial: INITIAL_RESOURCES.maxCapacity, min: 0, description: 'Shared material storage ceiling.' },
];

function getBuildingTags(type: BuildingType): string[] {
    const def = BUILDINGS[type];
    const tags = ['building'];
    if (type === BuildingType.EMPTY) tags.push('placeholder');
    if (def.power?.produces) tags.push('power-producer');
    if (def.power?.consumes) tags.push('power-consumer');
    if (def.water?.produces) tags.push('water-producer');
    if (def.water?.consumes) tags.push('water-consumer');
    if (def.productionType) tags.push('producer');
    if (def.upgrades?.length) tags.push('upgradeable');
    if (def.width || def.depth) tags.push('multi-tile');
    return tags;
}

const buildingArchetypes: EntityArchetypeDefinition[] = Object.values(BuildingType).map((type) => {
    const def = BUILDINGS[type];
    return {
        id: `building.${type}`,
        label: def?.name || type,
        category: 'building',
        tags: getBuildingTags(type),
        description: def?.desc,
        components: {
            buildingType: type,
            era: def?.era,
            footprint: { width: def?.width || 1, depth: def?.depth || 1 },
            economy: {
                cost: def?.cost || 0,
                costs: def?.costs || {},
                maintenance: def?.maintenance || 0,
                pollution: def?.pollution || 0,
                production: def?.production || 0,
                productionType: def?.productionType || null,
            },
            utilities: {
                power: def?.power || null,
                water: def?.water || null,
                waterPlaceable: Boolean(def?.waterPlaceable),
            },
            construction: {
                buildTime: def?.buildTime || 0,
                dependency: def?.dependency || null,
            },
            upgrades: def?.upgrades || [],
        },
    };
});

const agentArchetypes: EntityArchetypeDefinition[] = Object.values(RAW_AGENT_ROLE_SCHEMA).map((role) => {
    const roleId = role.id as AgentRole;
    return {
        id: `agent.${role.id}`,
        label: role.label,
        category: 'agent',
        tags: ['agent', role.combat.faction.toLowerCase(), role.workplaces.length > 0 ? 'professional' : 'generalist'],
        description: role.description,
        components: {
            roleId: role.id,
            workplaces: role.workplaces,
            baseSkills: role.baseSkills,
            combat: role.combat,
            weaponLoadout: ROLE_WEAPON_LOADOUTS[roleId],
        },
    };
});

const weaponArchetypes: EntityArchetypeDefinition[] = Object.values(COMBAT_WEAPONS).map((weapon) => ({
    id: `item.weapon.${weapon.id}`,
    label: weapon.label,
    category: 'item',
    tags: ['weapon', weapon.rangeBonus > 0 ? 'ranged-capable' : 'melee'],
    description: weapon.description,
    components: {
        combatWeapon: weapon,
    },
}));

const actionDefinitions: GameActionDefinition[] = [
    { id: 'action.placeBuilding', label: 'Place Building', category: 'build', commandType: 'PLACE_BUILDING', target: 'tile', payloadFields: ['x', 'z', 'buildingType'], description: 'Places a building archetype on a surface tile.' },
    { id: 'action.buyBuilding', label: 'Buy Building', category: 'economy', commandType: 'BUY_BUILDING', target: 'screen', payloadFields: ['buildingType', 'cost'], description: 'Adds a building archetype to player inventory.' },
    { id: 'action.bulldoze', label: 'Bulldoze', category: 'build', commandType: 'BULLDOZE', target: 'tile', payloadFields: ['x', 'z'], description: 'Removes or damages a tile structure.' },
    { id: 'action.speedUp', label: 'Speed Up Construction', category: 'build', commandType: 'SPEED_UP', target: 'tile', payloadFields: ['x', 'z'], description: 'Rushes an active construction job.' },
    { id: 'action.rehabilitate', label: 'Rehabilitate Tile', category: 'world', commandType: 'REHABILITATE', target: 'tile', payloadFields: ['x', 'z'], description: 'Repairs ecological damage on a tile.' },
    { id: 'action.upgradeBuilding', label: 'Upgrade Building', category: 'build', commandType: 'UPGRADE_BUILDING', target: 'tile', payloadFields: ['x', 'z'], description: 'Upgrades a placed building to the next level.' },
    { id: 'action.explodeTile', label: 'Explode Tile', category: 'debug', commandType: 'EXPLODE_TILE', target: 'tile', payloadFields: ['x', 'z', 'radius', 'damage'], description: 'Debug/destruction command for testing damaged tiles.' },
    { id: 'action.digVoxel', label: 'Dig Voxel', category: 'world', commandType: 'DIG_VOXEL', target: 'tile', payloadFields: ['x', 'y', 'z'], description: 'Queues subsurface excavation at a voxel.' },
    { id: 'action.clearRubble', label: 'Clear Rubble', category: 'world', commandType: 'CLEAR_RUBBLE', target: 'tile', payloadFields: ['x', 'y', 'z'], description: 'Queues rubble clearing at a subsurface voxel.' },
    { id: 'action.designateRubbleDump', label: 'Designate Rubble Dump', category: 'world', commandType: 'DESIGNATE_RUBBLE_DUMP', target: 'tile', payloadFields: ['x', 'y', 'z'], description: 'Marks a subsurface voxel as a rubble dump zone.' },
    { id: 'action.fillVoxel', label: 'Fill Voxel', category: 'world', commandType: 'FILL_VOXEL', target: 'tile', payloadFields: ['x', 'y', 'z'], description: 'Queues a rubble fill command for a subsurface voxel.' },
    { id: 'action.commandAgent', label: 'Command Agent', category: 'move', commandType: 'COMMAND_AGENT', target: 'agent', payloadFields: ['agentId', 'x', 'z'], description: 'Orders one agent to move or work at a tile.' },
    { id: 'action.commandAgents', label: 'Command Agents', category: 'move', commandType: 'COMMAND_AGENTS', target: 'agent', payloadFields: ['agentIds', 'x', 'z'], description: 'Orders a selected group of agents.' },
    { id: 'action.manualMoveAgent', label: 'Manual Move Agent', category: 'move', commandType: 'MANUAL_MOVE_AGENT', target: 'agent', payloadFields: ['agentId', 'dx', 'dz'], description: 'Directly moves an agent through manual control.' },
    { id: 'action.attackTarget', label: 'Attack Target', category: 'combat', commandType: 'COMBAT_ATTACK_TARGET', target: 'agent', payloadFields: ['agentIds'], description: 'Sets aggression or direct combat targeting.' },
    { id: 'action.holdPosition', label: 'Hold Position', category: 'combat', commandType: 'COMBAT_HOLD_POSITION', target: 'agent', payloadFields: ['agentIds'], description: 'Tells agents to hold combat position.' },
    { id: 'action.clearCombatOrders', label: 'Clear Combat Orders', category: 'combat', commandType: 'COMBAT_CLEAR_ORDERS', target: 'agent', payloadFields: ['agentIds'], description: 'Returns agents to automatic combat behavior.' },
    { id: 'action.sellResource', label: 'Sell Resource', category: 'economy', commandType: 'SELL_RESOURCE', target: 'resource', payloadFields: ['resource'], description: 'Sells a material into the market.' },
    { id: 'action.buyResource', label: 'Buy Resource', category: 'economy', commandType: 'BUY_RESOURCE', target: 'resource', payloadFields: ['resource', 'amount'], description: 'Buys a material from the market.' },
    { id: 'action.setAutoSell', label: 'Set Auto Sell', category: 'economy', commandType: 'SET_AUTO_SELL', target: 'screen', payloadFields: ['enabled', 'threshold'], description: 'Updates automatic market sale rules.' },
    { id: 'action.markHarvest', label: 'Mark Harvest', category: 'world', commandType: 'MARK_HARVEST', target: 'tile', payloadFields: ['x', 'z'], description: 'Marks a tree, resource, or foliage tile for harvesting.' },
    { id: 'action.researchTech', label: 'Research Tech', category: 'research', commandType: 'RESEARCH_TECH', target: 'screen', payloadFields: ['techId'], description: 'Researches an unlocked technology.' },
    { id: 'action.acceptContract', label: 'Accept Contract', category: 'economy', commandType: 'ACCEPT_CONTRACT', target: 'screen', payloadFields: ['contractId'], description: 'Accepts an available delivery contract.' },
    { id: 'action.deliverContract', label: 'Deliver Contract', category: 'economy', commandType: 'DELIVER_CONTRACT', target: 'screen', payloadFields: ['contractId'], description: 'Delivers resources for an accepted contract.' },
    { id: 'action.abandonContract', label: 'Abandon Contract', category: 'economy', commandType: 'ABANDON_CONTRACT', target: 'screen', payloadFields: ['contractId'], description: 'Abandons an accepted contract.' },
    { id: 'action.advanceTutorial', label: 'Advance Tutorial', category: 'world', commandType: 'ADVANCE_TUTORIAL', target: 'screen', payloadFields: [], description: 'Advances the tutorial state machine.' },
    { id: 'action.startDemo', label: 'Start Demo', category: 'world', commandType: 'START_DEMO', target: 'screen', payloadFields: [], description: 'Starts the playable demo flow.' },
    { id: 'action.dismissPopup', label: 'Dismiss Popup', category: 'debug', commandType: 'DISMISS_POPUP', target: 'screen', payloadFields: ['popupId'], description: 'Dismisses a blocking UI popup through the command boundary.' },
    { id: 'action.submitPermit', label: 'Submit Permit', category: 'dialogue', commandType: 'SUBMIT_PERMIT', target: 'screen', payloadFields: ['permitId'], description: 'Submits a bureaucracy permit action.' },
    { id: 'action.talkToNpc', label: 'Talk To NPC', category: 'dialogue', commandType: 'TALK_TO_NPC', target: 'agent', payloadFields: ['npcId'], description: 'Starts dialogue with a bureaucracy NPC.' },
    { id: 'action.chooseDialogue', label: 'Choose Dialogue', category: 'dialogue', commandType: 'CHOOSE_DIALOGUE', target: 'screen', payloadFields: ['optionIndex'], description: 'Chooses a dialogue option.' },
    { id: 'action.closeDialogue', label: 'Close Dialogue', category: 'dialogue', commandType: 'CLOSE_DIALOGUE', target: 'screen', payloadFields: [], description: 'Closes the active dialogue.' },
];

const systemBindings: GameSystemBindingDefinition[] = [
    { id: 'system.resources', label: 'Resources', module: 'engine/sim/systems/EconomySystem', reads: ['resources', 'buildings'], writes: ['resources'], description: 'Calculates production, maintenance, and resource flow.' },
    { id: 'system.construction', label: 'Construction', module: 'engine/sim/systems/ConstructionSystem', reads: ['chunks', 'commandQueue'], writes: ['chunks', 'pendingEffects'], description: 'Turns placement commands into built tile structures.' },
    { id: 'system.agents', label: 'Agents', module: 'engine/sim/systems/AgentSystem', reads: ['agents', 'jobs', 'chunks'], writes: ['agents', 'jobs'], description: 'Moves and updates worker agents.' },
    { id: 'system.combat', label: 'Combat', module: 'engine/sim/systems/CombatSystem', reads: ['agents', 'ambientNpcs', 'chunks'], writes: ['agents', 'ambientNpcs', 'pendingEffects'], description: 'Hydrates combat stats and resolves attacks.' },
    { id: 'system.resourceGrid', label: 'Utility Grids', module: 'engine/sim/resourceGrid/ResourceGridSolver', reads: ['chunks', 'weather', 'dayNightCycle'], writes: ['powerGrid', 'waterNetwork'], description: 'Uses resource grid schema entries for power and water.' },
];

export const AUREUS_GAME_DEFINITION = defineGameDefinition({
    id: 'aureus.eco-dominion',
    title: 'Aureus: Eco Dominion',
    version: '0.1.0',
    description: 'A configurable colony, extraction, ecology, and combat simulation running on the Aureus engine foundation.',
    genreTags: ['colony-sim', 'survival', 'factory', 'strategy', 'voxel-world'],
    engineCapabilities: ['fixed-step-simulation', 'chunked-world', 'three-rendering', 'command-queue', 'lockstep-ready', 'data-driven-content'],
    resources: resourceDefinitions,
    entityArchetypes: [
        ...buildingArchetypes,
        ...agentArchetypes,
        ...weaponArchetypes,
    ],
    actions: actionDefinitions,
    systems: [
        ...systemBindings,
        {
            id: 'system.resourceGridSchema',
            label: 'Resource Grid Schema',
            module: 'engine/data/resourceGridRoleSchema',
            reads: RESOURCE_GRID_ROLE_SCHEMA.map((entry) => `building.${entry.buildingType}`),
            writes: ['powerGrid', 'waterNetwork'],
            description: 'Declarative power and water roles consumed by the utility solver.',
        },
    ],
});

export default AUREUS_GAME_DEFINITION;