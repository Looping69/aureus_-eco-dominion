/** SPDX-License-Identifier: Apache-2.0 */
// Helper: Bresenham's Line Algorithm for Grid
export function getLineCoordinates(x0: number, z0: number, x1: number, z1: number): { x: number, z: number }[] {
    const path: { x: number, z: number }[] = [];

    const dx = Math.abs(x1 - x0);
    const dz = Math.abs(z1 - z0);
    const sx = (x0 < x1) ? 1 : -1;
    const sz = (z0 < z1) ? 1 : -1;
    let err = dx - dz;

    let cx = x0;
    let cz = z0;

    while (true) {
        path.push({ x: cx, z: cz });

        if ((cx === x1) && (cz === z1)) break;

        const e2 = 2 * err;
        if (e2 > -dz) {
            err -= dz;
            cx += sx;
        }
        if (e2 < dx) {
            err += dx;
            cz += sz;
        }
    }
    return path;
}

export function pseudoRandom(seed: number) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
        s = s * 16807 % 2147483647;
        return (s - 1) / 2147483646;
    };
}
