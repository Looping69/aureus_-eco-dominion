import { create } from 'zustand';

interface ContractPanelState {
    isCollapsed: boolean;
    hasAttention: boolean;
    toggleCollapsed: () => void;
    setCollapsed: (isCollapsed: boolean) => void;
    markAttention: () => void;
    clearAttention: () => void;
}

export const useContractPanelStore = create<ContractPanelState>((set) => ({
    isCollapsed: true,
    hasAttention: false,
    toggleCollapsed: () => set((state) => ({
        isCollapsed: !state.isCollapsed,
        hasAttention: state.isCollapsed ? false : state.hasAttention,
    })),
    setCollapsed: (isCollapsed) => set({ isCollapsed }),
    markAttention: () => set({ hasAttention: true }),
    clearAttention: () => set({ hasAttention: false }),
}));
