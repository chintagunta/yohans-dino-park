# Dino Park 2D — Age of Dinosaurs

A 2D prehistoric park built with React + TypeScript + Canvas, inspired by the "Age of Dinosaurs" poster.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## How to play
- **Drag** the park (or use `←/→`, `A/D`, mouse wheel, the era tabs, or the minimap) to explore Fern Valley (Triassic), Volcano Valley (Jurassic) and Blossom Meadows (Cretaceous).
- **Tools** (`1`–`4`): Explore (tap for info), Pet (press & hold), Grass, Meat (tap the ground to drop food).
  Herbivores eat grass, carnivores eat meat, omnivores eat both — feed the wrong thing and they refuse!
- Dinosaurs graze, wander, sleep, swim in lakes and rivers, and pterosaurs soar and land.
- The **In view** panel and discovery pop-ups tell you about every species that appears on screen; `G` opens the Field Guide, `L` toggles name tags.

All 33 species are drawn procedurally (no image assets): see `src/game/draw/dino.ts`, species data in `src/game/species.ts`.
