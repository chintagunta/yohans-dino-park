# Dino Park 2D — Age of Dinosaurs

An **infinite**, procedurally generated 2D prehistoric park (React + TypeScript + Canvas 2D + Web Audio).

```bash
npm install
npm run dev
npm run build
```

## World
- Walk forever in either direction: the world is generated in chunks from hashes (`src/game/world.ts`). Regions cycle through
  Triassic fern valleys, Jurassic volcano valleys (erupting volcanoes, lava streams) and Cretaceous blossom meadows, each with random
  lakes, rivers, rocks and plants. Animals spawn as you arrive and despawn as you leave; every herd gets random colour variants.
- 39 species (33 from the poster + Coelophysis, Brachiosaurus, Triceratops, Parasaurolophus, Spinosaurus, Gallimimus) drawn procedurally.

## Controls
- Drag / `←→` / `A D` / wheel / minimap / era tabs to travel. Tools `1`–`4`: Explore, Pet, Grass, Meat. `G` field guide, `L` names always on
  (otherwise names show on hover), `M` mute.

## Sound
All audio is synthesised (no files): an original adventure-style orchestral theme, wind, birds, insects, water, volcano rumble and eruption
booms, footsteps scaled by animal size, roars, calls, munching and purring. Sound starts after your first click (browser rule).
