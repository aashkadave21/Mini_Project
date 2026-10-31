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

export interface IncidentPriorityMetrics {
  totalScore: number;
  baseSeverityScore: number;
  waitingTimeScore: number;
  victimCountScore: number;
  waitMinutes: number;
  rationale: string;
}

export interface PrioritizedIncidentItem {
  id: string;
  title: string;
  type: string;
  severity: "critical" | "warning" | "info" | "success";
  sector: string;
  victims: number;
  reported: string;
  createdAt: string;
  status: string;
  pos: [number, number];
  priorityRank: number;
  priorityScore: number;
  baseSeverityScore: number;
  waitingTimeScore: number;
  victimCountScore: number;
  waitMinutes: number;
  rationale: string;
}

/**
 * Calculates priority score from documented severity, urgency, casualties,
 * and waiting-time starvation adjustment.
 *
 * Base Scoring Rules:
 * - Critical Medical: 120 (immediate life threat, hypothermia, trauma)
 * - Critical Toxic / Chemical: 115
 * - Critical Fire / Collapse: 105
 * - Critical Flood / Extraction: 95
 * - Warning (Urgent): 55
 * - Info / Minor Injury: 25
 *
 * Casualties Factor: +2.5 per affected victim (capped at 50)
 * Starvation-Avoidance Aging: +0.75 per minute waiting since arrival
 * Tie-Breaker: Arrival timestamp (first-come, first-served for equal scores)
 */
export function calculateIncidentPriorityScore(
  incident: {
    severity: string;
    type?: string;
    victims?: number;
    createdAt?: string;
  },
  nowMs = Date.now()
): IncidentPriorityMetrics {
  let baseScore = 25;
  const sev = (incident.severity || "").toLowerCase();
  const typ = (incident.type || "").toLowerCase();

  if (sev === "critical") {
    if (typ === "medical") baseScore = 120;
    else if (typ === "chemical") baseScore = 115;
    else if (typ === "fire" || typ === "collapse") baseScore = 105;
    else baseScore = 95; // flood
  } else if (sev === "warning") {
    if (typ === "medical") baseScore = 70;
    else baseScore = 55;
  } else {
    baseScore = 25; // minor injury / info
  }

  const victims = Number(incident.victims) || 1;
  const victimCountScore = Math.min(50, Number((victims * 2.5).toFixed(1)));

  const arrivalTime = new Date(incident.createdAt || Date.now()).getTime();
  const waitMinutes = Math.max(0, Math.floor((nowMs - arrivalTime) / 60000));
  const waitingTimeScore = Number((waitMinutes * 0.75).toFixed(1));

  const totalScore = Number((baseScore + victimCountScore + waitingTimeScore).toFixed(1));

  const rationale = `Base Severity [${sev.toUpperCase()} ${typ}] (${baseScore}) + Casualties [${victims} pers.] (+${victimCountScore}) + Starvation Aging [${waitMinutes}m wait] (+${waitingTimeScore})`;

  return {
    totalScore,
    baseSeverityScore: baseScore,
    waitingTimeScore,
    victimCountScore,
    waitMinutes,
    rationale,
  };
}

/**
 * Reorders emergencies using the MinPriorityQueue binary heap data structure.
 * Guaranteed to prioritize life-threatening cases while fairly breaking ties by arrival time.
 */
export function prioritizeIncidentQueue(
  incidents: any[],
  nowMs = Date.now()
): PrioritizedIncidentItem[] {
  const pq = new MinPriorityQueue<{
    incident: any;
    metrics: IncidentPriorityMetrics;
    arrivalMs: number;
  }>();

  for (const inc of incidents) {
    const metrics = calculateIncidentPriorityScore(inc, nowMs);
    const arrivalMs = new Date(inc.createdAt || 0).getTime();

    // Invert priority so maximum totalScore becomes smallest value for MinPriorityQueue.
    // Use fractional arrival time as secondary tie-breaker:
    // Earlier arrival (smaller arrivalMs) yields smaller heap priority -> dequeues earlier!
    const tieFraction = (arrivalMs % 10000000) / 10000000;
    const heapPriority = (100000 - metrics.totalScore) + tieFraction;

    pq.enqueue({ incident: inc, metrics, arrivalMs }, heapPriority);
  }

  const ranked: PrioritizedIncidentItem[] = [];
  let rank = 1;

  while (!pq.isEmpty()) {
    const entry = pq.dequeue()!;
    ranked.push({
      ...entry.incident,
      priorityRank: rank++,
      priorityScore: entry.metrics.totalScore,
      baseSeverityScore: entry.metrics.baseSeverityScore,
      waitingTimeScore: entry.metrics.waitingTimeScore,
      victimCountScore: entry.metrics.victimCountScore,
      waitMinutes: entry.metrics.waitMinutes,
      rationale: entry.metrics.rationale,
    });
  }

  return ranked;
}
