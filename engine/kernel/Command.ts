/** Transport/simulation command envelope; games own command names and payload validation. */
export interface EngineCommand {
    id: string;
    type: string;
    payload: any;
    issuedAtTick?: number;
    source?: string;
    reason?: string;
}
