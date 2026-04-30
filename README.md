

# Aureus: Eco Dominion

A voxel-based economic simulation game built on a custom modular game engine. Balance resource extraction, ecological sustainability, and public trust while managing autonomous agents in a dynamic world.

**`(|/)` Klaasvaakie**

---

## 🎮 The Game: Eco Dominion

**Eco Dominion** is a strategic simulation where you build and manage a mining colony while balancing three critical metrics:

- **💰 AGT (Aureus Gold Token)** - Your primary currency for construction and operations
- **🌿 Eco Score** - Environmental health that affects income multipliers
- **🤝 Trust** - Public approval that unlocks features and affects profitability

### Core Gameplay

- **Build & Manage**: Place mines, housing, power plants, and research facilities
- **Autonomous Agents**: Colonists with needs (energy, hunger, mood) who work, sleep, and construct buildings
- **Resource Economy**: Mine minerals, manage inventory, trade on markets, and fulfill contracts
- **Dynamic Systems**: Weather effects, day/night cycles, underground mining, and illegal miner threats
- **Tech Tree**: Research upgrades to improve efficiency and unlock new capabilities
- **Tutorial & Goals**: Guided progression system with objectives and news events

### Game Features

- **Isometric voxel rendering** with smooth camera controls
- **Full mobile support** with touch gestures:
  - Single-finger drag to pan
  - Pinch to zoom in/out
  - Two-finger rotate to change camera angle
  - Two-finger pan for precise positioning
- **Real-time simulation** with deterministic fixed-step updates
- **Save/Load system** for persistent progress
- **Debug tools** for development and testing

---

## 🏗️ The Engine: Aureus Engine

A **modular, deterministic voxel game engine** designed for simulation-heavy games with clean separation between rendering and game logic.

### Architecture Philosophy

The engine follows a **strict frame spine order** for predictable, reproducible behavior:

1. **Input** - Capture user interactions
2. **Streaming** - Load/unload world chunks
3. **Jobs Flush** - Apply worker thread results
4. **Simulation** - Fixed-step gameplay updates
5. **Render Sync** - Update visual meshes from state
6. **Draw** - Submit to GPU
7. **Frame End** - Cleanup and telemetry

### Core Modules

#### 🧠 **Kernel** (`engine/kernel`)
The engine's central nervous system:
- **EngineKernel**: Main loop orchestrator with fixed-step simulation
- **StateManager**: Immutable state management with snapshot/restore
- **EventBus**: Decoupled communication between systems
- **FrameScheduler**: Manages update timing and delta accumulation

#### 🌍 **World** (`engine/world`)
High-level game world management:
- **WorldManager**: Coordinates all systems and manages game lifecycle
- **ChunkManager**: Handles spatial partitioning and streaming
- **EntityManager**: Tracks and updates all game entities

#### 📦 **Space** (`engine/space`)
Spatial data structures for voxel worlds:
- **VoxelGrid**: 3D grid representation with efficient lookups
- **ChunkStreamer**: Loads/unloads chunks based on camera position
- **SpatialIndex**: Fast queries for entities in regions

#### ⚙️ **Jobs** (`engine/jobs`)
Worker-based parallel processing:
- **JobQueue**: Manages background tasks (pathfinding, mesh generation)
- **WorkerPool**: Thread pool for CPU-intensive operations
- **PathfindingWorker**: A* pathfinding in web workers
- **MeshBuilder**: Generates voxel meshes off main thread

#### 🎨 **Render** (`engine/render`)
Three.js rendering adapter:
- **ThreeRenderAdapter**: Bridges engine state to Three.js scene
- **CameraSystem**: Isometric camera with smooth controls
- **BuildingRenderSystem**: Manages building meshes and animations
- **VoxelRenderSystem**: Efficient voxel mesh rendering
- **EffectsSystem**: Particles, weather, and visual effects

#### 🎯 **Sim** (`engine/sim`)
Game simulation systems:
- **AgentSystem**: Autonomous agent AI (needs, jobs, pathfinding)
- **JobSystem**: Task assignment and execution
- **ResourceSystem**: Economy and resource flow
- **BuildingSystem**: Construction and building operations
- **ContractSystem**: Dynamic mission generation
- **WeatherSystem**: Environmental effects

#### 🛠️ **Tools** (`engine/tools`)
Development utilities:
- **DebugRenderer**: Visualize pathfinding, grids, and agent states
- **PerformanceMonitor**: FPS, frame time, memory tracking
- **StateInspector**: Runtime state inspection

### Key Design Patterns

**1. Engine-Owned State**
```typescript
// React is a pure view layer - all state lives in the engine
const { world, state, ready } = useAureusEngine({ container });
```

**2. Deterministic Simulation**
```typescript
// Fixed timestep ensures reproducible behavior
const FIXED_TIMESTEP = 1000 / 60; // 60 FPS simulation
```

**3. Worker-Based Parallelism**
```typescript
// Heavy tasks run off main thread
jobQueue.enqueue({ type: 'PATHFIND', from, to });
```

**4. Modular Systems**
```typescript
// Each system is independent and composable
world.addSystem(new AgentSystem());
world.addSystem(new ResourceSystem());
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+)
- Modern browser with WebGL support

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd aureus-eco-dominion
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   - Copy `.env.local.example` to `.env.local`
   - Add your `GEMINI_API_KEY` for AI features (optional)

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   - Navigate to `http://localhost:5173`
   - Press **SPACE** or click **Start Game** to begin

### Build for Production

```bash
npm run build
npm run preview
```

---

## 📁 Project Structure

```
aureus-eco-dominion/
├── engine/              # Core game engine
│   ├── kernel/          # Main loop, state, events
│   ├── world/           # World management
│   ├── space/           # Voxel grid, chunking
│   ├── jobs/            # Worker tasks
│   ├── render/          # Three.js rendering
│   ├── sim/             # Simulation systems
│   ├── tools/           # Debug utilities
│   ├── data/            # Game constants
│   └── utils/           # Shared utilities
├── game/                # Game-specific implementation
│   ├── AureusWorld.ts   # Game world orchestrator
│   ├── bootstrap.ts     # Engine initialization
│   ├── render/          # Game-specific renderers
│   └── useAureusEngine.ts # React integration hook
├── components/          # React UI components
├── services/            # Audio, analytics
├── types.ts             # TypeScript definitions
└── App.tsx              # Main React app
```

---

## 🎯 Tech Stack

- **Engine**: Custom TypeScript engine with modular architecture
- **Rendering**: Three.js for 3D graphics
- **UI**: React 19 + Lucide icons
- **Build**: Vite with TypeScript
- **State**: Engine-owned immutable state
- **Workers**: Web Workers for pathfinding and mesh generation

---

## 🔧 Development

### Verification

Run the focused regression suite:

```bash
npm test
```

Run the full local confidence gate before handing off a change:

```bash
npm run verify
```

### Debug Mode
Press **`** (backtick) in-game to toggle debug overlay:
- FPS and performance metrics
- Agent state visualization
- Job queue monitoring
- Grid and pathfinding overlays

### Key Bindings

**Desktop:**
- **Left Click + Drag** - Pan camera
- **Right Click + Drag** - Rotate camera
- **Mouse Wheel** - Zoom in/out
- **SPACE** - Start game / Pause
- **ESC** - Cancel building placement
- **1-9** - Quick select buildings from inventory
- **M** - Toggle minimap
- **U** - Toggle underground view
- **`** - Toggle debug mode

**Mobile:**
- **Single Finger Drag** - Pan camera
- **Pinch** - Zoom in/out
- **Two Finger Rotate** - Rotate camera angle
- **Two Finger Drag** - Pan camera (precise)

### Extending the Engine

Add a new simulation system:
```typescript
// engine/sim/MySystem.ts
export class MySystem {
  update(state: GameState, dt: number) {
    // Your simulation logic
  }
}

// game/AureusWorld.ts
this.systems.push(new MySystem());
```

---

## 📊 Performance

The engine is optimized for:
- **60 FPS** fixed-step simulation
- **100+ agents** with pathfinding
- **10,000+ voxels** rendered efficiently
- **Worker-based** mesh generation and pathfinding
- **Chunk streaming** for large worlds

---

## 🤝 Contributing

This is proprietary software owned by **Klaasvaakie**. Contributions, modifications, or any use of this software requires explicit written permission from the owner.

---

## 📄 License

**Copyright © 2026 Klaasvaakie. All Rights Reserved.**

This software is proprietary and confidential. Unauthorized copying, distribution, modification, or use of this software, via any medium, is strictly prohibited without explicit written permission from Klaasvaakie.

See the [LICENSE](LICENSE) file for complete terms and conditions.

---

