import { StateManager } from '../../engine/state/StateManager';

export type ContractCommandType = 'ACCEPT_CONTRACT' | 'DELIVER_CONTRACT' | 'ABANDON_CONTRACT';

export function queueContractCommand(
    stateManager: StateManager,
    type: ContractCommandType,
    contractId: string,
): void {
    stateManager.pushCommand(type, { contractId });
}

export function acceptWorldContract(stateManager: StateManager, contractId: string): void {
    queueContractCommand(stateManager, 'ACCEPT_CONTRACT', contractId);
}

export function deliverWorldContract(stateManager: StateManager, contractId: string): void {
    queueContractCommand(stateManager, 'DELIVER_CONTRACT', contractId);
}

export function abandonWorldContract(stateManager: StateManager, contractId: string): void {
    queueContractCommand(stateManager, 'ABANDON_CONTRACT', contractId);
}
