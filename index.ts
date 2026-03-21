// Welcome to
// __________         __    __  .__                               __
// \______   \_____ _/  |__/  |_|  |   ____   ______ ____ _____  |  | __ ____
//  |    |  _/\__  \\   __\   __\  | _/ __ \ /  ___//    \\__  \ |  |/ // __ \
//  |    |   \ / __ \|  |  |  | |  |_\  ___/ \___ \|   |  \/ __ \|    <\  ___/
//  |________/(______/__|  |__| |____/\_____>______>___|__(______/__|__\\_____>
//
// This file can be a nice home for your Battlesnake logic and helper functions.
//
// To get you started we've included code to prevent your Battlesnake from moving backwards.
// For more info see docs.battlesnake.com

import runServer from './server';
import { Coord, GameState, InfoResponse, MoveResponse } from './types';

const HEALTH_FOOD_THRESHOLD = 70;
const MIN_FLOOD_FILL_SPACE = 3;
/** Min space around a food cell to consider it (avoid eating into a trap). */
const MIN_SPACE_AROUND_FOOD = 2;
const HEAD_TO_HEAD_KILL_BONUS = 5;
const HEAD_TO_HEAD_RISK_PENALTY = 10;

const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
type Direction = (typeof DIRECTIONS)[number];

function coordKey(c: Coord): string {
  return `${c.x},${c.y}`;
}

/** Packed cell id for grid maps (faster than string keys in hot paths). */
function cellIndex(c: Coord, width: number): number {
  return c.y * width + c.x;
}

function indexToCoord(index: number, width: number): Coord {
  return { x: index % width, y: Math.floor(index / width) };
}

function coordKeyFromIdx(idx: number, width: number): string {
  return `${idx % width},${Math.floor(idx / width)}`;
}

/** Binary min-heap on `f` for A* open set. */
class MinFHeap {
  private readonly heap: { f: number; g: number; idx: number }[] = [];

  get length(): number {
    return this.heap.length;
  }

  push(node: { f: number; g: number; idx: number }): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): { f: number; g: number; idx: number } | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return min;
  }

  private bubbleUp(i: number): void {
    const h = this.heap;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[i]!.f >= h[p]!.f) break;
      [h[i], h[p]] = [h[p]!, h[i]!];
      i = p;
    }
  }

  private bubbleDown(i: number): void {
    const h = this.heap;
    const n = h.length;
    while (true) {
      const l = i * 2 + 1;
      const r = l + 1;
      let smallest = i;
      if (l < n && h[l]!.f < h[smallest]!.f) smallest = l;
      if (r < n && h[r]!.f < h[smallest]!.f) smallest = r;
      if (smallest === i) break;
      [h[i], h[smallest]] = [h[smallest]!, h[i]!];
      i = smallest;
    }
  }
}

function getNeighbor(head: Coord, move: Direction): Coord {
  switch (move) {
    case 'up':
      return { x: head.x, y: head.y + 1 };
    case 'down':
      return { x: head.x, y: head.y - 1 };
    case 'left':
      return { x: head.x - 1, y: head.y };
    case 'right':
      return { x: head.x + 1, y: head.y };
  }
}

function inBounds(c: Coord, width: number, height: number): boolean {
  return c.x >= 0 && c.x < width && c.y >= 0 && c.y < height;
}

/** Blocked cells for pathfinding/flood fill: all snake bodies. Our tail is excluded (it moves next turn unless we eat). */
function getBlockedSet(gameState: GameState, excludeMyTail: boolean): Set<string> {
  const blocked = new Set<string>();
  const { board, you } = gameState;
  for (const snake of board.snakes) {
    const body = snake.body;
    const tailIndex = body.length - 1;
    for (let i = 0; i < body.length; i++) {
      if (snake.id === you.id && excludeMyTail && i === tailIndex) continue;
      blocked.add(coordKey(body[i]));
    }
  }
  return blocked;
}

/** A*: shortest path from start to goal. Returns array of coords (start not included), or empty if no path. */
function aStarPath(
  start: Coord,
  goal: Coord,
  width: number,
  height: number,
  blocked: Set<string>
): Coord[] {
  const goalIdx = cellIndex(goal, width);
  const startIdx = cellIndex(start, width);
  const heuristic = (c: Coord) => Math.abs(c.x - goal.x) + Math.abs(c.y - goal.y);
  const open = new MinFHeap();
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>();
  gScore.set(startIdx, 0);
  open.push({ idx: startIdx, g: 0, f: heuristic(start) });

  const blockedAt = (c: Coord) => blocked.has(coordKey(c));

  while (open.length > 0) {
    const node = open.pop()!;
    const { idx: currentIdx, g: currentG } = node;
    if (currentG !== (gScore.get(currentIdx) ?? Infinity)) continue;

    if (currentIdx === goalIdx) {
      const path: Coord[] = [];
      let cur = currentIdx;
      while (cur !== startIdx) {
        path.unshift(indexToCoord(cur, width));
        cur = cameFrom.get(cur)!;
      }
      return path;
    }

    const cx = currentIdx % width;
    const cy = Math.floor(currentIdx / width);
    const neighbors: Coord[] = [
      { x: cx, y: cy + 1 },
      { x: cx, y: cy - 1 },
      { x: cx - 1, y: cy },
      { x: cx + 1, y: cy },
    ];
    for (const next of neighbors) {
      if (!inBounds(next, width, height) || blockedAt(next)) continue;
      const nextIdx = cellIndex(next, width);
      const tentativeG = currentG + 1;
      if (tentativeG >= (gScore.get(nextIdx) ?? Infinity)) continue;
      cameFrom.set(nextIdx, currentIdx);
      gScore.set(nextIdx, tentativeG);
      open.push({ idx: nextIdx, g: tentativeG, f: tentativeG + heuristic(next) });
    }
  }
  return [];
}

/**
 * Flood fill from `from`: count reachable cells (4-neighbor), excluding blocked and out-of-bounds.
 * Reuses `visitStamp` + `queue` with a per-pass `stamp` (increment between calls; wrap before 255).
 * If `maxCount` is set, stops once count reaches that value (enough for "at least N" checks).
 */
function floodFillCount(
  from: Coord,
  width: number,
  height: number,
  blocked: Set<string>,
  visitStamp: Uint8Array,
  stamp: number,
  queue: Int32Array,
  maxCount?: number
): number {
  const fromIdx = cellIndex(from, width);
  if (blocked.has(coordKey(from))) return 0;

  let qh = 0;
  let qt = 0;
  queue[qt++] = fromIdx;
  visitStamp[fromIdx] = stamp;
  let count = 0;

  while (qh < qt) {
    const idx = queue[qh++]!;
    count++;
    if (maxCount !== undefined && count >= maxCount) return count;

    const x = idx % width;
    const y = (idx / width) | 0;

    if (y + 1 < height) {
      const n = idx + width;
      if (visitStamp[n] !== stamp && !blocked.has(coordKeyFromIdx(n, width))) {
        visitStamp[n] = stamp;
        queue[qt++] = n;
      }
    }
    if (y > 0) {
      const n = idx - width;
      if (visitStamp[n] !== stamp && !blocked.has(coordKeyFromIdx(n, width))) {
        visitStamp[n] = stamp;
        queue[qt++] = n;
      }
    }
    if (x > 0) {
      const n = idx - 1;
      if (visitStamp[n] !== stamp && !blocked.has(coordKeyFromIdx(n, width))) {
        visitStamp[n] = stamp;
        queue[qt++] = n;
      }
    }
    if (x + 1 < width) {
      const n = idx + 1;
      if (visitStamp[n] !== stamp && !blocked.has(coordKeyFromIdx(n, width))) {
        visitStamp[n] = stamp;
        queue[qt++] = n;
      }
    }
  }
  return count;
}

/** Direction from head to the first step of path (path[0] must be adjacent to head). */
function pathToDirection(head: Coord, firstStep: Coord): Direction | null {
  if (firstStep.x === head.x && firstStep.y === head.y + 1) return 'up';
  if (firstStep.x === head.x && firstStep.y === head.y - 1) return 'down';
  if (firstStep.x === head.x - 1 && firstStep.y === head.y) return 'left';
  if (firstStep.x === head.x + 1 && firstStep.y === head.y) return 'right';
  return null;
}

function getHazardSet(gameState: GameState): Set<string> {
  const hazards = new Set<string>();
  for (const h of gameState.board.hazards) {
    hazards.add(coordKey(h));
  }
  return hazards;
}

/** For each cell an opponent head could move to next turn, track the longest opponent that could arrive. */
function getOpponentPossibleHeadMoves(gameState: GameState): Map<string, number> {
  const result = new Map<string, number>();
  const { board, you } = gameState;
  for (const snake of board.snakes) {
    if (snake.id === you.id) continue;
    for (const dir of DIRECTIONS) {
      const next = getNeighbor(snake.head, dir);
      if (!inBounds(next, board.width, board.height)) continue;
      const key = coordKey(next);
      result.set(key, Math.max(result.get(key) ?? 0, snake.length));
    }
  }
  return result;
}

// info is called when you create your Battlesnake on play.battlesnake.com
// and controls your Battlesnake's appearance
// TIP: If you open your Battlesnake URL in a browser you should see this data
function info(): InfoResponse {
  console.log("INFO");

  return {
    apiversion: "1",
    author: "elwindly",
    color: "#007A33",
    head: "dragon",
    tail: "flame",
  };
}

// start is called when your Battlesnake begins a game
function start(gameState: GameState): void {
  console.log("GAME START");
}

// end is called when your Battlesnake finishes a game
function end(gameState: GameState): void {
  console.log("GAME OVER\n");
}

// move is called on every turn and returns your next move
// Valid moves are "up", "down", "left", or "right"
// See https://docs.battlesnake.com/api/example-move for available data
function move(gameState: GameState): MoveResponse {
  const { board, you } = gameState;
  const { width, height, food } = board;
  const myHead = you.body[0];
  const myNeck = you.body[1];
  const hazardDmg = gameState.game.ruleset.settings.hazardDamagePerTurn;

  const isMoveSafe: Record<Direction, boolean> = {
    up: true,
    down: true,
    left: true,
    right: true,
  };

  // Don't move backwards
  if (myNeck.x < myHead.x) isMoveSafe.left = false;
  else if (myNeck.x > myHead.x) isMoveSafe.right = false;
  else if (myNeck.y < myHead.y) isMoveSafe.down = false;
  else if (myNeck.y > myHead.y) isMoveSafe.up = false;

  // Safety: bounds and collisions (other bodies; our body except tail which moves)
  const blocked = getBlockedSet(gameState, true);
  for (const dir of DIRECTIONS) {
    if (!isMoveSafe[dir]) continue;
    const next = getNeighbor(myHead, dir);
    if (!inBounds(next, width, height)) {
      isMoveSafe[dir] = false;
      continue;
    }
    if (blocked.has(coordKey(next))) {
      isMoveSafe[dir] = false;
    }
  }

  let safeMoves = DIRECTIONS.filter((d) => isMoveSafe[d]);
  if (safeMoves.length === 0) {
    console.log(`MOVE ${gameState.turn}: No safe moves detected! Moving down`);
    return { move: 'down' };
  }

  const floodVisitStamp = new Uint8Array(width * height);
  const floodQueue = new Int32Array(width * height);
  let floodStamp = 0;
  const nextFloodStamp = (): number => {
    if (++floodStamp >= 255) {
      floodVisitStamp.fill(0);
      floodStamp = 1;
    }
    return floodStamp;
  };

  const hazardSet = getHazardSet(gameState);
  const opponentHeadMoves = getOpponentPossibleHeadMoves(gameState);

  // Food seeking: shortest reachable path, accounting for hazard damage along the way
  let bestFoodDirection: Direction | null = null;
  if (food.length > 0) {
    let bestPathLength = Infinity;
    for (const f of food) {
      const path = aStarPath(myHead, f, width, height, blocked);
      if (path.length === 0) continue;
      const hazardSteps = path.filter((c) => hazardSet.has(coordKey(c))).length;
      const effectiveCost = path.length + hazardSteps * hazardDmg;
      if (effectiveCost >= you.health) continue;
      const spaceAtFood = floodFillCount(
        f,
        width,
        height,
        blocked,
        floodVisitStamp,
        nextFloodStamp(),
        floodQueue,
        MIN_SPACE_AROUND_FOOD
      );
      if (spaceAtFood < MIN_SPACE_AROUND_FOOD) continue;
      if (path.length < bestPathLength) {
        bestPathLength = path.length;
        bestFoodDirection = pathToDirection(myHead, path[0]);
      }
    }
  }

  const onHazard = hazardSet.has(coordKey(myHead));
  const adjustedThreshold = onHazard
    ? Math.min(HEALTH_FOOD_THRESHOLD + hazardDmg * 3, 100)
    : HEALTH_FOOD_THRESHOLD;
  const lowHealth = you.health <= adjustedThreshold;

  // Score each safe move: flood fill, food, hazards, head-to-head
  const scored: {
    move: Direction;
    space: number;
    towardFood: boolean;
    hazardCost: number;
    headToHeadScore: number;
  }[] = [];
  for (const dir of safeMoves) {
    const nextHead = getNeighbor(myHead, dir);
    const nextKey = coordKey(nextHead);
    const space = floodFillCount(
      nextHead,
      width,
      height,
      blocked,
      floodVisitStamp,
      nextFloodStamp(),
      floodQueue
    );
    if (space < MIN_FLOOD_FILL_SPACE) continue;

    const hazardCost = hazardSet.has(nextKey) ? Math.max(hazardDmg, 1) : 0;

    let headToHeadScore = 0;
    const opponentMaxLength = opponentHeadMoves.get(nextKey);
    if (opponentMaxLength !== undefined) {
      headToHeadScore = you.length > opponentMaxLength
        ? HEAD_TO_HEAD_KILL_BONUS
        : -HEAD_TO_HEAD_RISK_PENALTY;
    }

    scored.push({
      move: dir,
      space,
      towardFood: dir === bestFoodDirection,
      hazardCost,
      headToHeadScore,
    });
  }

  const candidates = scored.length > 0
    ? scored
    : safeMoves.map((m) => ({
        move: m,
        space: 0,
        towardFood: false,
        hazardCost: 0,
        headToHeadScore: 0,
      }));

  candidates.sort((a, b) => {
    if (b.space !== a.space) return b.space - a.space;
    if (b.headToHeadScore !== a.headToHeadScore) return b.headToHeadScore - a.headToHeadScore;
    if (a.hazardCost !== b.hazardCost) return a.hazardCost - b.hazardCost;
    return (b.towardFood ? 1 : 0) - (a.towardFood ? 1 : 0);
  });

  let nextMove: Direction;
  if (lowHealth && bestFoodDirection && candidates.some((c) => c.move === bestFoodDirection)) {
    nextMove = bestFoodDirection;
  } else {
    const killMove = candidates.find(
      (c) => c.headToHeadScore > 0 && c.space >= you.length
    );
    if (killMove && !lowHealth) {
      nextMove = killMove.move;
    } else if (candidates.length > 0) {
      nextMove = candidates[0].move;
    } else {
      nextMove = safeMoves[0];
    }
  }

  console.log(`MOVE ${gameState.turn}: ${nextMove}`);
  return { move: nextMove };
}

runServer({
  info: info,
  start: start,
  move: move,
  end: end
});
