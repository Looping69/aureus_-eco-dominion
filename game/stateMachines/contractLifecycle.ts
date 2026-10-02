import { createMachine } from 'xstate';
import { Contract } from '../../types';

export type ContractLifecycleState =
    | 'available'
    | 'accepted'
    | 'readyToDeliver'
    | 'completed'
    | 'failed';

export const contractLifecycleMachine = createMachine({
    id: 'contractLifecycle',
    initial: 'available',
    states: {
        available: {
            on: {
                ACCEPT: 'accepted',
                EXPIRE: 'failed',
            },
        },
        accepted: {
            on: {
                STOCK_READY: 'readyToDeliver',
                ABANDON: 'failed',
                EXPIRE: 'failed',
            },
        },
        readyToDeliver: {
            on: {
                DELIVER: 'completed',
                STOCK_LOW: 'accepted',
                ABANDON: 'failed',
                EXPIRE: 'failed',
            },
        },
        completed: { type: 'final' },
        failed: { type: 'final' },
    },
});

export function getContractLifecycleState(status?: Contract['status']): ContractLifecycleState {
    if (status === 'ACCEPTED') return 'accepted';
    if (status === 'READY_TO_DELIVER') return 'readyToDeliver';
    if (status === 'COMPLETED') return 'completed';
    if (status === 'FAILED') return 'failed';
    return 'available';
}

export function isContractActionable(status?: Contract['status']): boolean {
    const lifecycleState = getContractLifecycleState(status);
    return lifecycleState === 'available' || lifecycleState === 'accepted' || lifecycleState === 'readyToDeliver';
}
