import RAPIER from '@dimforge/rapier3d-compat';

let rapierInitStarted = false;
let rapierReady = false;
let rapierInitError: string | null = null;

export function warmRapierGroundingProbe(): void {
    if (rapierInitStarted) return;
    rapierInitStarted = true;

    void RAPIER.init()
        .then(() => {
            rapierReady = true;
            rapierInitError = null;
        })
        .catch((err) => {
            rapierReady = false;
            rapierInitError = String(err);
            console.warn('[RapierGroundingProbe] Rapier init failed; using terrain-height fallback.', err);
        });
}

export function isRapierGroundingReady(): boolean {
    return rapierReady;
}

export function getRapierGroundingError(): string | null {
    return rapierInitError;
}

export function computeGroundedHeight(
    currentY: number,
    terrainY: number,
    dt: number,
    maxSnapSpeed: number = 24
): number {
    if (!Number.isFinite(currentY)) return terrainY;
    if (!Number.isFinite(terrainY)) return currentY;

    const frameDt = Math.max(dt, 1 / 60);
    const maxStep = Math.max(0.02, maxSnapSpeed * frameDt);
    const delta = terrainY - currentY;

    if (Math.abs(delta) <= maxStep) return terrainY;
    return currentY + Math.sign(delta) * maxStep;
}
