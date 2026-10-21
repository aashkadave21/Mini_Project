/**
 * Data Structures: Generic Binary Min-Heap implementation of a Priority Queue
 * Time Complexity:
 *   - Insertion: O(log n)
 *   - Extract-Min: O(log n)
 *   - Peek: O(1)
 * Space Complexity: O(n)
 */
export class MinPriorityQueue<T> {
  private heap: { item: T; priority: number }[] = [];

  public get size(): number {
    return this.heap.length;
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  public enqueue(item: T, priority: number): void {
    this.heap.push({ item, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  public dequeue(): T | undefined {
    if (this.isEmpty()) return undefined;
    const min = this.heap[0]!.item;
    const end = this.heap.pop();
    if (this.heap.length > 0 && end !== undefined) {
      this.heap[0] = end;
      this.sinkDown(0);
    }
    return min;
  }

  public peek(): T | undefined {
    return this.heap[0]?.item;
  }

  private bubbleUp(index: number): void {
    const element = this.heap[index]!;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex]!;
      if (element.priority >= parent.priority) break;
      this.heap[index] = parent;
      this.heap[parentIndex] = element;
      index = parentIndex;
    }
  }

  private sinkDown(index: number): void {
    const length = this.heap.length;
    const element = this.heap[index]!;
    while (true) {
      const leftChildIndex = 2 * index + 1;
      const rightChildIndex = 2 * index + 2;
      let swapIndex: number | null = null;
      let leftChild: { item: T; priority: number } | undefined;
      let rightChild: { item: T; priority: number } | undefined;

      if (leftChildIndex < length) {
        leftChild = this.heap[leftChildIndex]!;
        if (leftChild.priority < element.priority) {
          swapIndex = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        rightChild = this.heap[rightChildIndex]!;
        if (
          (swapIndex === null && rightChild.priority < element.priority) ||
          (swapIndex !== null && rightChild.priority < (leftChild?.priority ?? Infinity))
        ) {
          swapIndex = rightChildIndex;
        }
      }

      if (swapIndex === null) break;
      this.heap[index] = this.heap[swapIndex]!;
      this.heap[swapIndex] = element;
      index = swapIndex;
    }
  }
}
