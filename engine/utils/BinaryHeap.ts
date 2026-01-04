/**
 * Efficient Binary Heap for priority queues
 */
export class BinaryHeap<T> {
    private heap: T[] = [];

    constructor(private compareFn: (a: T, b: T) => number) { }

    /**
     * Add an item to the heap
     */
    push(item: T): void {
        this.heap.push(item);
        this.bubbleUp(this.heap.length - 1);
    }

    /**
     * Remove and return the top item (according to compareFn)
     */
    pop(): T | undefined {
        if (this.heap.length === 0) return undefined;
        if (this.heap.length === 1) return this.heap.pop();

        const top = this.heap[0];
        this.heap[0] = this.heap.pop()!;
        this.bubbleDown(0);
        return top;
    }

    /**
     * Peek at the top item without removing it
     */
    peek(): T | undefined {
        return this.heap[0];
    }

    /**
     * Get number of items in heap
     */
    get size(): number {
        return this.heap.length;
    }

    private bubbleUp(index: number): void {
        while (index > 0) {
            const parentIndex = (index - 1) >>> 1;
            if (this.compareFn(this.heap[index], this.heap[parentIndex]) >= 0) break;

            this.swap(index, parentIndex);
            index = parentIndex;
        }
    }

    private bubbleDown(index: number): void {
        const lastIndex = this.heap.length - 1;
        while (true) {
            let smallestIndex = index;
            const leftChildIndex = (index << 1) + 1;
            const rightChildIndex = (index << 1) + 2;

            if (leftChildIndex <= lastIndex && this.compareFn(this.heap[leftChildIndex], this.heap[smallestIndex]) < 0) {
                smallestIndex = leftChildIndex;
            }

            if (rightChildIndex <= lastIndex && this.compareFn(this.heap[rightChildIndex], this.heap[smallestIndex]) < 0) {
                smallestIndex = rightChildIndex;
            }

            if (smallestIndex === index) break;

            this.swap(index, smallestIndex);
            index = smallestIndex;
        }
    }

    private swap(i: number, j: number): void {
        const temp = this.heap[i];
        this.heap[i] = this.heap[j];
        this.heap[j] = temp;
    }

    /**
     * Convert heap to array (not necessarily sorted)
     */
    toArray(): T[] {
        return [...this.heap];
    }

    /**
     * Filter the heap (expensive, O(n log n))
     */
    filter(predicate: (item: T) => boolean): void {
        const remaining = this.heap.filter(predicate);
        this.heap = [];
        for (const item of remaining) {
            this.push(item);
        }
    }

    /**
     * Check if any item matches predicate
     */
    some(predicate: (item: T) => boolean): boolean {
        return this.heap.some(predicate);
    }

    /**
     * Clear the heap
     */
    clear(): void {
        this.heap = [];
    }
}
