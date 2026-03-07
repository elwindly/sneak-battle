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

const HEALTH_FOOD_THRESHOLD = 50;
const MIN_FLOOD_FILL_SPACE = 3;

const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
type Direction = (typeof DIRECTIONS)[number];

function coordKey(c: Coord): string {
  return `${c.x},${c.y}`;
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
  const key = (c: Coord) => coordKey(c);
  const heuristic = (c: Coord) => Math.abs(c.x - goal.x) + Math.abs(c.y - goal.y);
  const open: { coord: Coord; g: number; f: number }[] = [{ coord: start, g: 0, f: heuristic(start) }];
  const cameFrom = new Map<string, Coord>();
  const gScore = new Map<string, number>();
  gScore.set(key(start), 0);

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!.coord;
    if (current.x === goal.x && current.y === goal.y) {
      const path: Coord[] = [];
      let cur: Coord | undefined = current;
      while (cur) {
        path.unshift(cur);
        cur = cameFrom.get(key(cur));
      }
      return path.slice(1);
    }

    const neighbors: Coord[] = [
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
    ];
    for (const next of neighbors) {
      if (!inBounds(next, width, height) || blocked.has(key(next))) continue;
      const nextKey = key(next);
      const tentativeG = (gScore.get(key(current)) ?? Infinity) + 1;
      if (tentativeG >= (gScore.get(nextKey) ?? Infinity)) continue;
      cameFrom.set(nextKey, current);
      gScore.set(nextKey, tentativeG);
      open.push({ coord: next, g: tentativeG, f: tentativeG + heuristic(next) });
    }
  }
  return [];
}

/** Flood fill from `from`: count reachable cells (4-neighbor), excluding blocked and out-of-bounds. */
function floodFillCount(
  from: Coord,
  width: number,
  height: number,
  blocked: Set<string>
): number {
  const visited = new Set<string>();
  const queue: Coord[] = [from];
  visited.add(coordKey(from));
  let count = 0;
  while (queue.length > 0) {
    const c = queue.shift()!;
    count++;
    const neighbors: Coord[] = [
      { x: c.x, y: c.y + 1 },
      { x: c.x, y: c.y - 1 },
      { x: c.x - 1, y: c.y },
      { x: c.x + 1, y: c.y },
    ];
    for (const n of neighbors) {
      if (!inBounds(n, width, height)) continue;
      const k = coordKey(n);
      if (blocked.has(k) || visited.has(k)) continue;
      visited.add(k);
      queue.push(n);
    }
  }
  return count;
}

// info is called when you create your Battlesnake on play.battlesnake.com
// and controls your Battlesnake's appearance
// TIP: If you open your Battlesnake URL in a browser you should see this data
function info(): InfoResponse {
  console.log("INFO");

  return {
    apiversion: "1",
    author: "",       // TODO: Your Battlesnake Username
    color: "#888888", // TODO: Choose color
    head: "default",  // TODO: Choose head
    tail: "default",  // TODO: Choose tail
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
  const blockedForSafety = getBlockedSet(gameState, true);
  for (const dir of DIRECTIONS) {
    if (!isMoveSafe[dir]) continue;
    const next = getNeighbor(myHead, dir);
    if (!inBounds(next, width, height)) {
      isMoveSafe[dir] = false;
      continue;
    }
    if (blockedForSafety.has(coordKey(next))) {
      isMoveSafe[dir] = false;
    }
  }

  let safeMoves = DIRECTIONS.filter((d) => isMoveSafe[d]);
  if (safeMoves.length === 0) {
    console.log(`MOVE ${gameState.turn}: No safe moves detected! Moving down`);
    return { move: 'down' };
  }

  // Food targeting when health is low: A* to nearest reachable food
  let preferredDirection: Direction | null = null;
  if (you.health <= HEALTH_FOOD_THRESHOLD && food.length > 0) {
    const blockedForPath = getBlockedSet(gameState, true);
    let bestPathLength = Infinity;
    for (const f of food) {
      const path = aStarPath(myHead, f, width, height, blockedForPath);
      if (path.length > 0 && path.length < you.health && path.length < bestPathLength) {
        bestPathLength = path.length;
        const first = path[0];
        if (first.x === myHead.x && first.y === myHead.y + 1) preferredDirection = 'up';
        else if (first.x === myHead.x && first.y === myHead.y - 1) preferredDirection = 'down';
        else if (first.x === myHead.x - 1 && first.y === myHead.y) preferredDirection = 'left';
        else if (first.x === myHead.x + 1 && first.y === myHead.y) preferredDirection = 'right';
      }
    }
  }

  // Flood fill: prefer moves with more reachable space; eliminate traps
  const blockedForFlood = getBlockedSet(gameState, true);
  const scored: { move: Direction; space: number }[] = [];
  for (const dir of safeMoves) {
    const nextHead = getNeighbor(myHead, dir);
    const space = floodFillCount(nextHead, width, height, blockedForFlood);
    if (space >= MIN_FLOOD_FILL_SPACE) {
      scored.push({ move: dir, space });
    }
  }

  const candidates = scored.length > 0 ? scored : safeMoves.map((m) => ({ move: m, space: 0 }));
  candidates.sort((a, b) => b.space - a.space);

  let nextMove: Direction;
  if (preferredDirection && candidates.some((c) => c.move === preferredDirection)) {
    nextMove = preferredDirection;
  } else if (candidates.length > 0) {
    nextMove = candidates[0].move;
  } else {
    nextMove = safeMoves[0];
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
