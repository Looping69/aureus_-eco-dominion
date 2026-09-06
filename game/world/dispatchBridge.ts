import { Action } from '../../types';

export interface WorldDispatchBridgeDeps {
    placeBuilding: (x: number, z: number) => void;
    bulldozeTile: (x: number, z: number) => void;
    setInteractionMode: (mode: any) => void;
    upgradeBuilding: (x: number, z: number) => void;
    speedUpConstruction: (x: number, z: number) => void;
    rehabilitateTile: (x: number, z: number) => void;
    selectBuilding: (type: string | null) => void;
    selectAgent: (agentId: string | null) => void;
    selectAgents: (agentIds: string[]) => void;
    selectAllColonyAgents: () => void;
    commandAgent: (agentId: string, x: number, z: number) => void;
    setLayeredActiveY: (y: number) => void;
    sellMinerals: () => void;
    sellGems: (address?: string) => void;
    sellWood: () => void;
    sellStone: () => void;
    buyResource: (resource: 'minerals' | 'gems' | 'wood' | 'stone', amount: number) => void;
    buyBuilding: (buildingType: string, cost: number) => void;
    updateLogistics: (payload: any) => void;
    researchTech: (techId: string) => void;
    toggleDebug: () => void;
    toggleCheats: () => void;
    toggleViewMode: () => void;
    saveGame: () => void;
    loadState: (saved: any) => void;
    advanceTutorial: () => void;
    startDemo: () => void;
    acceptContract: (contractId: string) => void;
    deliverContract: (contractId: string) => void;
    abandonContract: (contractId: string) => void;
    enterFPS: (agentId: string) => void;
    exitFPS: () => void;
    getSelectedAgentId: () => string | null;
    getSelectedAgentIds?: () => string[];
    pushCommand: (type: string, payload?: any) => void;
    warnUnhandled: (type: string) => void;
}

function contractIdFromPayload(payload: any): string {
    return payload?.contractId ?? payload;
}

function normalizeAgentIdPayload(payload: any, deps: WorldDispatchBridgeDeps): string[] {
    const ids = payload?.agentIds;
    if (Array.isArray(ids)) return ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
    const selectedAgentIds = deps.getSelectedAgentIds?.() ?? [];
    return selectedAgentIds.length > 0 ? selectedAgentIds : deps.getSelectedAgentId() ? [deps.getSelectedAgentId() as string] : [];
}

export function dispatchWorldAction(action: Action, deps: WorldDispatchBridgeDeps): void {
    console.log(`[AureusWorld] Dispatching: ${action.type}`, (action as any).payload);

    switch (action.type) {
        case 'PLACE_BUILDING': deps.placeBuilding(action.payload.x, action.payload.z); break;
        case 'BULLDOZE_TILE': deps.bulldozeTile(action.payload.x, action.payload.z); break;
        case 'ACTIVATE_BULLDOZER': deps.setInteractionMode('BULLDOZE'); break;
        case 'UPGRADE_BUILDING': deps.upgradeBuilding(action.payload.x, action.payload.z); break;
        case 'SPEED_UP_BUILDING': deps.speedUpConstruction(action.payload.x, action.payload.z); break;
        case 'REHABILITATE_TILE': deps.rehabilitateTile(action.payload.x, action.payload.z); break;
        case 'SELECT_BUILDING_TO_PLACE': deps.selectBuilding(action.payload); break;
        case 'SELECT_AGENT': deps.selectAgent(action.payload); break;
        case 'SELECT_AGENT_GROUP': deps.selectAgents(Array.isArray(action.payload) ? action.payload : []); break;
        case 'SELECT_ALL_COLONY_AGENTS': deps.selectAllColonyAgents(); break;
        case 'COMMAND_AGENT': deps.commandAgent(action.payload.agentId, action.payload.x, action.payload.z); break;
        case 'COMBAT_ATTACK_TARGET':
            deps.pushCommand('COMBAT_ATTACK_TARGET', {
                ...action.payload,
                agentIds: normalizeAgentIdPayload(action.payload, deps),
            });
            break;
        case 'COMBAT_HOLD_POSITION':
            deps.pushCommand('COMBAT_HOLD_POSITION', {
                agentIds: normalizeAgentIdPayload(action.payload, deps),
            });
            break;
        case 'COMBAT_CLEAR_ORDERS':
            deps.pushCommand('COMBAT_CLEAR_ORDERS', {
                agentIds: normalizeAgentIdPayload(action.payload, deps),
            });
            break;
        case 'SET_INTERACTION_MODE': deps.setInteractionMode(action.payload); break;
        case 'SET_LAYERED_ACTIVE_Y': deps.setLayeredActiveY(action.payload); break;
        case 'SELL_MINERALS': deps.sellMinerals(); break;
        case 'SELL_GEMS': deps.sellGems(action.payload.address); break;
        case 'SELL_WOOD': deps.sellWood(); break;
        case 'SELL_STONE': deps.sellStone(); break;
        case 'BUY_RESOURCE': deps.buyResource(action.payload.resource, action.payload.amount); break;
        case 'BUY_BUILDING':
            deps.buyBuilding(action.payload.type, action.payload.cost);
            deps.selectBuilding(action.payload.type);
            break;
        case 'UPDATE_LOGISTICS': deps.updateLogistics(action.payload); break;
        case 'UPDATE_SECTOR_POLICY': deps.pushCommand('UPDATE_SECTOR_POLICY', action.payload); break;
        case 'CLAIM_GOAL': deps.pushCommand('CLAIM_GOAL'); break;
        case 'UNLOCK_TECH': deps.researchTech(action.payload); break;
        case 'TOGGLE_DEBUG': deps.toggleDebug(); break;
        case 'TOGGLE_CHEATS': deps.toggleCheats(); break;
        case 'TOGGLE_VIEW': deps.toggleViewMode(); break;
        case 'SAVE_GAME': deps.saveGame(); break;
        case 'LOAD_GAME': deps.loadState(action.payload); break;
        case 'ADVANCE_TUTORIAL': deps.advanceTutorial(); break;
        case 'START_DEMO': deps.startDemo(); break;
        case 'ACCEPT_CONTRACT': deps.acceptContract(contractIdFromPayload(action.payload)); break;
        case 'DELIVER_CONTRACT': deps.deliverContract(contractIdFromPayload(action.payload)); break;
        case 'ABANDON_CONTRACT': deps.abandonContract(contractIdFromPayload(action.payload)); break;
        case 'ENTER_FPS': deps.enterFPS(action.payload || deps.getSelectedAgentId() || ''); break;
        case 'EXIT_FPS': deps.exitFPS(); break;
        case 'DISMISS_NEWS': break;
        case 'SUBMIT_PERMIT': deps.pushCommand('SUBMIT_PERMIT', { permitId: action.payload }); break;
        case 'TALK_TO_NPC': deps.pushCommand('TALK_TO_NPC', { npcId: action.payload }); break;
        case 'CHOOSE_DIALOGUE': deps.pushCommand('CHOOSE_DIALOGUE', { optionIndex: action.payload }); break;
        case 'CLOSE_DIALOGUE': deps.pushCommand('CLOSE_DIALOGUE', {}); break;
        default: deps.warnUnhandled((action as any).type);
    }
}
