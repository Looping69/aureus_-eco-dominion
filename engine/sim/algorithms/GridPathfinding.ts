/** Generic A* over caller-supplied traversal costs. Search order preserves existing replays. */
import { BinaryHeap } from '../../utils/BinaryHeap';

// Node wrapper for Heap
interface PathNode {
    x: number;
    z: number;
    f: number;
}

const getDistance2D = (ax: number, az: number, bx: number, bz: number) => {
    // Chebyshev distance for 8-way movement
    return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
};

export function findGridPath(
    startX: number, startZ: number,
    endX: number, endZ: number,
    getTraversalCost: (x: number, z: number) => number | null,
    impassableDestinationCost = 2
): { x: number, z: number }[] | null {
    if (startX === endX && startZ === endZ) {
        return [{ x: endX, z: endZ }];
    }

    const openSet = new BinaryHeap<PathNode>((a, b) => a.f - b.f);
    openSet.push({ x: startX, z: startZ, f: getDistance2D(startX, startZ, endX, endZ) });

    const cameFrom = new Map<string, { x: number, z: number }>();
    const gScore = new Map<string, number>();

    const startKey = `${startX},${startZ}`;
    gScore.set(startKey, 0);

    const visited = new Set<string>();

    let iterations = 0;
    const MAX_ITERATIONS = 5000;

    while (openSet.size > 0) {
        iterations++;
        if (iterations > MAX_ITERATIONS) return null;

        const current = openSet.pop()!;
        const { x: cx, z: cz } = current;
        const currentKey = `${cx},${cz}`;

        if (cx === endX && cz === endZ) {
            // Reconstruct
            const path = [{ x: cx, z: cz }];
            let currKey = currentKey;
            while (cameFrom.has(currKey)) {
                const prev = cameFrom.get(currKey)!;
                path.unshift(prev);
                currKey = `${prev.x},${prev.z}`;
            }
            return path.slice(1);
        }

        if (visited.has(currentKey)) continue;
        visited.add(currentKey);

        // --- Lateral Neighbors ---
        for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dz === 0) continue;

                const nx = cx + dx, nz = cz + dz;
                const nKey = `${nx},${nz}`;
                if (visited.has(nKey)) continue;

                let cost = getTraversalCost(nx, nz);
                if (cost === null) continue;

                // Special case: Allow reaching the destination even if it's technically impassable (e.g. for construction)
                if (cost === Infinity) {
                    if (nx === endX && nz === endZ) {
                        cost = impassableDestinationCost;
                    } else {
                        continue;
                    }
                }

                const tentativeG = (gScore.get(currentKey) ?? Infinity) + cost;
                if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
                    cameFrom.set(nKey, { x: cx, z: cz });
                    gScore.set(nKey, tentativeG);
                    openSet.push({ x: nx, z: nz, f: tentativeG + getDistance2D(nx, nz, endX, endZ) });
                }
            }
        }
    }

    return null;
}
