# Battlesnake Project Context

**Goal:** Build a snake algorithm that can compete with other Battlesnakes. The server responds to the Battlesnake API; the logic in `index.ts` (especially `move()`) is where the competitive algorithm lives.

**Docs:** [docs.battlesnake.com](https://docs.battlesnake.com) · **API:** [docs.battlesnake.com/api](https://docs.battlesnake.com/api)

---

## What is Battlesnake?

- **Your code is the controller.** A live web server receives HTTP webhooks from the game engine and responds with moves.
- **Real-time:** Each turn, the engine sends a request; your server has limited time (e.g. `game.timeout` ms) to respond with the next move.
- **Win condition:** Be the last Battlesnake remaining. You need **space to move** and **health**; running out of either eliminates you.

---

## Game Rules (Summary)

### Board
- Rectangular grid. **(0,0) is bottom-left.** X increases right, Y increases up.
- Board size: `board.width` × `board.height` (e.g. 11×11). Valid coordinates: x in [0, width-1], y in [0, height-1].
- Moving outside the board = **immediate elimination**.

### Health
- Start at full health (typically 100). **Lose 1 health per turn.**
- Health ≤ 0 = **elimination.**
- **Eating food:** move onto a food cell → health reset to max, and you **grow by one segment** on the next turn.
- Eating costs no health; 1 HP is enough to eat and survive.

### Collisions (all cause elimination unless noted)
1. **Self:** Moving into your own body → eliminated.
2. **Other body:** Moving into another snake’s body → eliminated (“unsports-snake-like conduct”).
3. **Head-to-head:** Two heads move to the same cell:
   - **Longer snake wins**, shorter is eliminated.
   - **Same length → both eliminated.**
   - Used by strong players to force eliminations.

### Turn order (engine)
1. Engine sends identical requests to all snakes (in parallel).
2. Each snake responds with a move (`"up"` | `"down"` | `"left"` | `"right"`). Timeout → repeat previous direction.
3. Engine resolves in order:
   - Apply each move: −1 health, remove tail, add new head.
   - Consume food: remove food, add segment at tail, set health to max.
   - Spawn new food (map-dependent).
   - Remove eliminated snakes (head-to-head loser, body/self/out-of-bounds, zero health).

### Hazards (map-dependent, e.g. Royale)
- Some cells are hazards. Entering a hazard drains extra health per turn; can eliminate you.
- Only enter if survivable or no other option.

### Starting / Food spawn
- Snakes can start coiled (multiple segments on one cell) and stretch out.
- Food spawn rules depend on the **map**; see [Battlesnake maps](https://docs.battlesnake.com/maps). Standard maps have initial food and may spawn more over time.

---

## Battlesnake API (This Project)

### Endpoints (implemented in `server.ts`)

| Method | Path   | Purpose |
|--------|--------|--------|
| `GET`  | `/`    | **Info** – Battlesnake metadata (apiversion, author, color, head, tail). Used for display and latency checks. |
| `POST` | `/start` | **Game start** – New game; request includes `game`, `turn` (0), `board`, `you`. Response ignored. |
| `POST` | `/move`  | **Move** – Every turn; request has full `game`, `turn`, `board`, `you`. **Must respond with `{ move: "up"|"down"|"left"|"right", shout?: string }`.** |
| `POST` | `/end`   | **Game end** – Game over; request has final state. Response ignored. |

### Info response (`GET /`)

- **Required:** `apiversion: "1"`.
- **Optional:** `author`, `color` (e.g. `"#888888"`), `head`, `tail`, `version`.

### Move request (`POST /move`) – input types in `types.d.ts`

- **game:** `Game` – `id`, `ruleset`, `map`, `source`, `timeout` (ms).
- **turn:** number – current turn.
- **board:** `Board` – `height`, `width`, `food: Coord[]`, `hazards: Coord[]`, `snakes: Battlesnake[]`.
- **you:** `Battlesnake` – same shape as one of `board.snakes` (your snake).

### Move response

- **move:** `"up"` | `"down"` | `"left"` | `"right"`.
- **shout:** optional string (≤256 chars), broadcast to others next turn.

### Key object shapes (see `types.d.ts`)

- **Coord:** `{ x: number, y: number }`. Board is (0,0) bottom-left.
- **Battlesnake:** `id`, `name`, `health`, `body: Coord[]` (head → tail), `head`, `length`, `latency`, `shout`, `customizations`.
- **Board:** `height`, `width`, `food`, `hazards`, `snakes`.
- **GameState:** `{ game, turn, board, you }` – this is what `move(gameState)` receives.

---

## Project layout (this repo)

- **`index.ts`** – Battlesnake logic: `info()`, `start()`, `move()`, `end()`. **Implement the competitive algorithm in `move()`** using `GameState`.
- **`server.ts`** – Express server; wires `GET /`, `POST /start`, `POST /move`, `POST /end` to the handlers above.
- **`types.d.ts`** – TypeScript types for the API (Coord, Battlesnake, Board, Game, GameState, InfoResponse, MoveResponse).

Algorithm priorities (from starter TODOs and rules):

1. Don’t move backwards (already done in starter).
2. Don’t move out of bounds (`board.width`, `board.height`).
3. Don’t move into your own body (`gameState.you.body`).
4. Don’t move into other snakes’ bodies (`gameState.board.snakes`).
5. Prefer moving toward food when health is low; balance growth (risk) vs survival.
6. Consider head-to-head: when you can win (you’re longer), moving into an opponent head can eliminate them; when you’re shorter or equal, avoid sharing a head cell.
7. On hazard maps, account for `board.hazards` and extra health drain.

---

## References

- Rules: [docs.battlesnake.com/rules](https://docs.battlesnake.com/rules)
- API: [docs.battlesnake.com/api](https://docs.battlesnake.com/api)
- Webhooks: [docs.battlesnake.com/api/webhooks](https://docs.battlesnake.com/api/webhooks)
- Example move: [docs.battlesnake.com/api/example-move](https://docs.battlesnake.com/api/example-move)
- Open-source game logic: [github.com/BattlesnakeOfficial/rules](https://github.com/BattlesnakeOfficial/rules)
