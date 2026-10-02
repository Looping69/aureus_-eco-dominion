import type { FogRevealCenter } from './FogExploration';

/** First unexplored point along a ray, merging overlapping explored discs.
 * This preserves radial exploration; it does not invent terrain line-of-sight rules.
 */
export function getExploredRayDistance(origin: {x: number; z: number}, direction: {x: number; z: number}, centers: FogRevealCenter[], maxDistance: number): number {
    const length = Math.hypot(direction.x,direction.z);
    if (!length || maxDistance <= 0) return 0;
    const ux = direction.x / length, uz = direction.z / length;
    const intervals: [number,number][] = [];
    for (const center of centers) {
        const dx = center.x - origin.x, dz = center.z - origin.z;
        const along = dx * ux + dz * uz;
        const perpendicularSq = Math.max(0, dx * dx + dz * dz - along * along);
        const remaining = center.radius * center.radius - perpendicularSq;
        if (remaining < 0) continue;
        const half = Math.sqrt(remaining);
        if (along + half < 0 || along - half > maxDistance) continue;
        intervals.push([Math.max(0,along-half), Math.min(maxDistance,along+half)]);
    }
    intervals.sort((a,b) => a[0]-b[0]);
    let boundary = 0;
    for (const [start,end] of intervals) {
        if (start > boundary + 1e-6) break;
        boundary = Math.max(boundary,end);
        if (boundary >= maxDistance) break;
    }
    return boundary;
}
