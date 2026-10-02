/** Frame-rate independent easing for the orthographic settlement arrival. */
export function arrivalZoom(start: number, target: number, elapsed: number, duration: number): number {
    const t = duration <= 0 ? 1 : Math.max(0, Math.min(1, elapsed / duration));
    const eased = t * t * (3 - 2 * t);
    return start + (target - start) * eased;
}
