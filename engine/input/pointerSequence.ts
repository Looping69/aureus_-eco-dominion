export interface PointerUpDecision {
    pointerId: number;
    activePointerIds: Set<number>;
    isDragging: boolean;
    hadMultiTouchGesture: boolean;
}

export function shouldHandlePointerUp({
    pointerId,
    activePointerIds,
    isDragging,
    hadMultiTouchGesture,
}: PointerUpDecision): boolean {
    if (!activePointerIds.has(pointerId)) return false;
    if (isDragging || hadMultiTouchGesture) return false;
    return true;
}
