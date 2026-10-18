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


## Update: more life, quakes and phone mode

- **Sea reptiles** (Nothosaurus, Ichthyosaurus, Liopleurodon, Elasmosaurus, Mosasaurus) live in the lakes and rivers.
- **Flyers and birds** (Eudimorphodon, Rhamphorhynchus, Archaeopteryx, Quetzalcoatlus, Confuciusornis, Microraptor) fly in flocks.
- **Earthquakes** strike at random (more often near volcanoes): the screen shakes, cracks open and dinosaurs panic. Press **Q** to trigger one.
- **Background herds** of running dinosaurs (sometimes chased by raiders) and bird flocks cross the scenery.
- **Music** is `public/theme.mp3` (looped). Replace that file to change the track.
- **Phones**: only a music button is shown; drag to look around.

## Update: seasons, weather and liquids

- **Seasons** cycle every 90 s (spring, summer, autumn, winter) with a colour tint, falling petals or leaves, and winter snow that settles on the ground (not near volcanoes). Click the season pill or press **S** to skip ahead.
- **Weather**: rain showers (with thunder and lightning) come every minute or so, and snowstorms in winter.
- **Water bodies** vary in size, shape (ponds, lakes, winding lagoons, twin ponds, rivers) and colour, and hold fish that swim around and sometimes leap.
- **Lava** comes as streams, pools, lakes, scattered pools and calderas, with bubbles that swell and pop.
- T-Rex (Tyrannosaurus) shows up more often.
- **Season picker**: the season button opens a menu to choose any season, with an "automatic change" switch. On phones the top options (eras, Field Guide, Names, Season, Sound) shrink to icons.
- **Night mode**: the moon button (or **N**) switches between day, a full-moon night, and an automatic day and night cycle. Nights have stars, a full moon, fireflies, glowing lava, crickets, and more sleeping dinosaurs.

- **Noah's ark**: a far-background plateau (parallax 0.58) with an ark about 75% built (finished hull and roof, bare ribs and rafters, scaffolding, builders, a derrick, log piles, a campfire). Pairs of animals walk slowly to its ramp and board. It recurs every few thousand pixels, and the first one is near the start.
- **Phone music**: audio is now unlocked on touchend/pointerup/click, and the MP3 plays as a plain media element (so iOS/Android autoplay rules and the iOS silent switch no longer block it).
