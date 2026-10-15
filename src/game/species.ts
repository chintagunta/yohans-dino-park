import type { Era, Feats, HeadStyle, Palette, Shape, Species } from './types';
import { hueShift } from './draw/util';

export const ERAS: Record<Era, { name: string; short: string; range: string; color: string; ink: string }> = {
  triassic: { name: 'Triassic Era', short: 'TRIASSIC ERA', range: '252 – 201 million years ago', color: '#62cbe8', ink: '#0a4a63' },
  jurassic: { name: 'Jurassic Period', short: 'JURASSIC PERIOD', range: '201 – 145 million years ago', color: '#f6c431', ink: '#6b4a00' },
  cretaceous: { name: 'Cretaceous Period', short: 'CRETACEOUS PERIOD', range: '145 – 66 million years ago', color: '#f58a1f', ink: '#6a2f00' },
};

interface Def {
  id: string;
  name: string;
  era: Era;
  diet: Species['diet'];
  kind?: string;
  meaning: string;
  length: number;
  weight: string;
  fact: string;
  count?: number;
  speed?: number;
  swims?: boolean;
  aquatic?: boolean;
  flies?: boolean;
  homeX?: number;
  sizeMul?: number;
  colors: Palette;
  shape: Shape;
}

const head = (len: number, h: number, style: HeadStyle, ang?: number) => ({ len, h, style, ang });
const F = (f: Feats): Feats => f;

/* -------------------------------------------------------------------------- */
/*  Reusable body plans                                                       */
/* -------------------------------------------------------------------------- */

const theropod = (o: Partial<Shape> & { feats?: Feats } = {}): Shape => ({
  kind: 'biped',
  bodyLen: 0.3,
  bodyH: 0.15,
  legH: 0.2,
  legW: 0.05,
  tilt: 0.1,
  neck: { len: 0.13, ang: 0.95, thick: 0.55 },
  tail: { len: 0.36, droop: 0.02, lift: 0.04, thick: 0.62 },
  head: head(0.19, 0.11, 'rex', 0.12),
  arms: 0.5,
  digi: true,
  ...o,
});

const sauropod = (o: Partial<Shape> & { feats?: Feats } = {}): Shape => ({
  kind: 'quad',
  bodyLen: 0.27,
  bodyH: 0.12,
  legH: 0.13,
  legW: 0.045,
  tilt: -0.04,
  neck: { len: 0.36, ang: 1.0, thick: 0.45 },
  tail: { len: 0.34, droop: 0.12, lift: 0.0, thick: 0.6 },
  head: head(0.06, 0.035, 'blunt', 0.2),
  ...o,
});

/* -------------------------------------------------------------------------- */
/*  The Age of Dinosaurs roster (matches the poster)                          */
/* -------------------------------------------------------------------------- */

const DEFS: Def[] = [
  /* ------------------------------- TRIASSIC ------------------------------- */
  {
    id: 'plateosaurus', name: 'Plateosaurus', era: 'triassic', diet: 'herbivore', meaning: '"Flat lizard"',
    length: 8, weight: '4 tonnes', count: 2, swims: true, homeX: 500, speed: 34,
    fact: 'One of the first big dinosaurs. More than 100 skeletons have been found in Germany and Switzerland, so scientists know it very well.',
    colors: { body: '#c9733a', belly: '#f3dcae', accent: '#5d7a3a', stripe: '#8a4a22' },
    shape: {
      kind: 'biped', bodyLen: 0.27, bodyH: 0.13, legH: 0.17, legW: 0.045, tilt: 0.05,
      neck: { len: 0.25, ang: 0.9, thick: 0.38 }, tail: { len: 0.34, droop: 0.04, lift: 0.05, thick: 0.6 },
      head: head(0.07, 0.04, 'blunt', 0.18), arms: 0.6, feats: F({ stripes: true }),
    },
  },
  {
    id: 'henodus', name: 'Henodus', era: 'triassic', diet: 'omnivore', kind: 'Marine reptile', meaning: '"Single tooth"',
    length: 1.2, weight: '25 kg', count: 2, aquatic: true, homeX: 770, speed: 22, sizeMul: 2.3,
    fact: 'Not a dinosaur at all! This turtle-like reptile had a wide, boxy shell and a toothless beak that it used to scoop up lake-bottom snacks.',
    colors: { body: '#4aa38c', belly: '#d9ecb5', accent: '#e8c15a', extra: '#2d7a77' },
    shape: {
      kind: 'turtle', bodyLen: 0.5, bodyH: 0.2, legH: 0.04, legW: 0.04, tilt: 0,
      neck: { len: 0.1, ang: 0.2 }, tail: { len: 0.1, droop: 0, lift: 0 }, head: head(0.12, 0.07, 'beak', 0.05),
      feats: F({ boxShell: true, flipper: 0.7 }),
    },
  },
  {
    id: 'coloradisaurus', name: 'Coloradisaurus', era: 'triassic', diet: 'herbivore', meaning: '"Colorado lizard"',
    length: 3.4, weight: '70 kg', homeX: 1000, speed: 38,
    fact: 'Named after the Los Colorados rock formation in Argentina. It was an early long-necked plant eater that could rear up to nibble leaves.',
    colors: { body: '#3a9bb5', belly: '#f1e2b0', accent: '#1f6f8f', stripe: '#1b5d7a' },
    shape: {
      kind: 'biped', bodyLen: 0.26, bodyH: 0.12, legH: 0.17, legW: 0.04, tilt: 0.04,
      neck: { len: 0.27, ang: 0.85, thick: 0.38 }, tail: { len: 0.34, droop: 0.05, lift: 0.04, thick: 0.6 },
      head: head(0.08, 0.04, 'blunt', 0.2), arms: 0.55, feats: F({ stripes: true }),
    },
  },
  {
    id: 'lotosaurus', name: 'Lotosaurus', era: 'triassic', diet: 'omnivore', kind: 'Archosaur', meaning: '"Lotus lizard"',
    length: 2.5, weight: '300 kg', homeX: 1300, speed: 30,
    fact: 'This toothless, beaked reptile from China carried a tall sail on its back. The sail may have helped it show off or control its body heat.',
    colors: { body: '#7a5aa6', belly: '#ecc9a8', accent: '#e5566a', stripe: '#5a3d86' },
    shape: {
      kind: 'quad', bodyLen: 0.3, bodyH: 0.13, legH: 0.1, legW: 0.045, tilt: 0.0,
      neck: { len: 0.1, ang: 0.4, thick: 0.6 }, tail: { len: 0.4, droop: 0.04, lift: 0.0, thick: 0.62 },
      head: head(0.09, 0.05, 'beak', 0.18), feats: F({ sail: { from: 1.0, to: 2.0, h: 0.16, membrane: 0.9 }, stripes: true }),
    },
  },
  {
    id: 'melanorosaurus', name: 'Melanorosaurus', era: 'triassic', diet: 'herbivore', meaning: '"Black mountain lizard"',
    length: 8, weight: '2.5 tonnes', swims: true, homeX: 1450, speed: 30,
    fact: 'A step on the road to the giant sauropods. It already walked on four thick, pillar-like legs to carry its heavy body.',
    colors: { body: '#2f78a8', belly: '#f0cf6a', accent: '#f0cf6a', stripe: '#215c86' },
    shape: sauropod({ bodyLen: 0.3, bodyH: 0.15, legH: 0.12, legW: 0.05, neck: { len: 0.3, ang: 1.05, thick: 0.45 }, tail: { len: 0.32, droop: 0.08, lift: 0, thick: 0.6 }, head: head(0.07, 0.04, 'blunt', 0.2), feats: F({ stripes: true }) }),
  },
  {
    id: 'shansisuchus', name: 'Shansisuchus', era: 'triassic', diet: 'carnivore', kind: 'Archosaur', meaning: '"Shanxi crocodile"',
    length: 2.5, weight: '200 kg', swims: true, homeX: 1100, speed: 40,
    fact: 'A crocodile-like hunter that stalked rivers and lakes of ancient China. It was a cousin of dinosaurs and crocodiles alike.',
    colors: { body: '#b3402e', belly: '#f1d3a0', accent: '#f0a03a', stripe: '#7a2a1e' },
    shape: {
      kind: 'quad', bodyLen: 0.34, bodyH: 0.1, legH: 0.06, legW: 0.035, tilt: 0.0,
      neck: { len: 0.1, ang: 0.15, thick: 0.7 }, tail: { len: 0.4, droop: 0.0, lift: 0.0, thick: 0.7 },
      head: head(0.16, 0.06, 'long', 0.1),
      feats: F({ spikes: { from: 0.8, to: 2.0, n: 10, h: 0.035 }, teeth: true, stripes: true }),
    },
  },
  {
    id: 'eoraptor', name: 'Eoraptor', era: 'triassic', diet: 'omnivore', meaning: '"Dawn thief"',
    length: 1.7, weight: '10 kg', count: 2, homeX: 250, speed: 70,
    fact: 'One of the earliest known dinosaurs. Eoraptor was about the size of a coyote and could sprint on two legs.',
    colors: { body: '#6fb7e0', belly: '#f4f0dc', accent: '#2f6fa8', stripe: '#2f6fa8' },
    shape: theropod({ bodyLen: 0.28, bodyH: 0.12, legH: 0.2, legW: 0.04, neck: { len: 0.12, ang: 0.9, thick: 0.5 }, tail: { len: 0.4, droop: 0.02, lift: 0.04, thick: 0.6 }, head: head(0.11, 0.06, 'long', 0.1), feats: F({ stripes: true, teeth: true }) }),
  },

  /* ------------------------------- JURASSIC ------------------------------- */
  {
    id: 'dimorphodon', name: 'Dimorphodon', era: 'jurassic', diet: 'carnivore', kind: 'Pterosaur', meaning: '"Two-form tooth"',
    length: 1.6, weight: '2 kg', count: 2, flies: true, homeX: 2300, speed: 45, sizeMul: 1.6,
    fact: 'This flying reptile had a huge head and two different kinds of teeth. It likely snapped up insects and small lizards.',
    colors: { body: '#f0a94c', belly: '#fbe2b0', accent: '#d94f87', extra: '#c75b9b' },
    shape: {
      kind: 'ptero', bodyLen: 0.3, bodyH: 0.1, legH: 0.1, legW: 0.02, tilt: 0,
      neck: { len: 0.08, ang: 0.5 }, tail: { len: 0.4, droop: 0, lift: 0 }, head: head(0.2, 0.12, 'rex', 0.1),
      feats: F({ longTail: true, wingCrest: 0, teeth: true }),
    },
  },
  {
    id: 'allosaurus', name: 'Allosaurus', era: 'jurassic', diet: 'carnivore', meaning: '"Different lizard"',
    length: 9, weight: '2 tonnes', homeX: 3100, speed: 52,
    fact: 'The top predator of the Jurassic. Its skull could open extra wide, letting it slash at prey with a hatchet-like bite.',
    colors: { body: '#4fa36a', belly: '#f0e6a8', accent: '#e4893a', stripe: '#2e6e4a' },
    shape: theropod({ feats: F({ hornBrow: 0.7, stripes: true, teeth: true }) }),
  },
  {
    id: 'kentrosaurus', name: 'Kentrosaurus', era: 'jurassic', diet: 'herbivore', meaning: '"Spiked lizard"',
    length: 4.5, weight: '1.5 tonnes', homeX: 3400, speed: 30,
    fact: 'A spiky cousin of Stegosaurus from Africa. Pairs of long spikes guarded its hips and tail from hungry predators.',
    colors: { body: '#d4503f', belly: '#f6d9a0', accent: '#f2a43a', stripe: '#8e2f25' },
    shape: {
      kind: 'quad', bodyLen: 0.3, bodyH: 0.15, legH: 0.1, legW: 0.042, tilt: 0.12,
      neck: { len: 0.14, ang: 0.35, thick: 0.55 }, tail: { len: 0.4, droop: 0.01, lift: 0.0, thick: 0.6 },
      head: head(0.09, 0.045, 'beak', 0.4),
      feats: F({ plates: { from: 1.3, to: 2.4, n: 6, h: 0.1 }, spikes: { from: 0.1, to: 1.2, n: 8, h: 0.08 }, stripes: true }),
    },
  },
  {
    id: 'dilophosaurus', name: 'Dilophosaurus', era: 'jurassic', diet: 'carnivore', meaning: '"Two-crested lizard"',
    length: 7, weight: '400 kg', homeX: 2150, speed: 55,
    fact: 'Its two thin head crests were probably for display, not fighting. It was fast, light and one of the biggest hunters of its time.',
    colors: { body: '#27508c', belly: '#9ed0e8', accent: '#ea4f3f', stripe: '#1a3866' },
    shape: theropod({ bodyH: 0.13, legH: 0.2, head: head(0.2, 0.09, 'long', 0.1), feats: F({ crest: 'twin', stripes: true, teeth: true }) }),
  },
  {
    id: 'vulcanodon', name: 'Vulcanodon', era: 'jurassic', diet: 'herbivore', meaning: '"Volcano tooth"',
    length: 11, weight: '3.5 tonnes', homeX: 2450, speed: 28, swims: false,
    fact: 'Its bones were found between layers of volcanic lava in Zimbabwe, hence the name. It was one of the earliest true sauropods.',
    colors: { body: '#a9917e', belly: '#e0d1ba', accent: '#6e5e50', stripe: '#7d6857' },
    shape: sauropod({ bodyH: 0.14, legH: 0.12, neck: { len: 0.32, ang: 0.95, thick: 0.42 }, tail: { len: 0.36, droop: 0.1, lift: 0, thick: 0.6 }, feats: F({ stripes: true }) }),
  },
  {
    id: 'barapasaurus', name: 'Barapasaurus', era: 'jurassic', diet: 'herbivore', meaning: '"Big-leg lizard"',
    length: 14, weight: '15 tonnes', homeX: 3000, speed: 26,
    fact: 'Named for its enormous thigh bone found in India. At 14 metres long it was among the first real giants.',
    colors: { body: '#37a3b0', belly: '#f2dc7a', accent: '#1f6f86', stripe: '#217d8e' },
    shape: sauropod({ bodyLen: 0.26, bodyH: 0.13, legH: 0.14, neck: { len: 0.38, ang: 1.1, thick: 0.44 }, tail: { len: 0.3, droop: 0.1, lift: 0, thick: 0.6 }, feats: F({ stripes: true }) }),
  },
  {
    id: 'compsognathus', name: 'Compsognathus', era: 'jurassic', diet: 'carnivore', meaning: '"Elegant jaw"',
    length: 1, weight: '3 kg', count: 3, homeX: 2700, speed: 90, sizeMul: 1.7,
    fact: 'About the size of a chicken, it was one of the smallest dinosaurs. It chased lizards and insects on quick legs.',
    colors: { body: '#2f9a96', belly: '#f4efc8', accent: '#f08a3a' },
    shape: theropod({ bodyLen: 0.26, bodyH: 0.11, legH: 0.22, legW: 0.035, tilt: 0.12, neck: { len: 0.17, ang: 0.8, thick: 0.45 }, tail: { len: 0.45, droop: 0.02, lift: 0.05, thick: 0.55 }, head: head(0.14, 0.06, 'long', 0.1), arms: 0.35, feats: F({ spots: true, teeth: true }) }),
  },
  {
    id: 'kileskus', name: 'Kileskus', era: 'jurassic', diet: 'carnivore', meaning: '"Lizard" (in Khakas)',
    length: 3, weight: '150 kg', homeX: 2000, speed: 58,
    fact: 'A relative of the tyrannosaurs from Siberia. Its name is a Khakas word for lizard, after the local Khakassia region.',
    colors: { body: '#3aa87a', belly: '#d9eab0', accent: '#1f6f55', stripe: '#1f7a56' },
    shape: theropod({ bodyLen: 0.28, bodyH: 0.13, legH: 0.2, head: head(0.2, 0.09, 'long', 0.1), feats: F({ stripes: true, teeth: true, crest: 'bump' }) }),
  },
  {
    id: 'scutellosaurus', name: 'Scutellosaurus', era: 'jurassic', diet: 'herbivore', meaning: '"Little-shield lizard"',
    length: 1.2, weight: '10 kg', count: 2, homeX: 3250, speed: 55, sizeMul: 1.7,
    fact: 'A tiny armored dinosaur. Rows of bony studs covered its back, and it could run on two legs or walk on four.',
    colors: { body: '#e79a3b', belly: '#f8e3b0', accent: '#8a5a22' },
    shape: {
      kind: 'biped', bodyLen: 0.22, bodyH: 0.1, legH: 0.18, legW: 0.035, tilt: 0.1,
      neck: { len: 0.1, ang: 0.6, thick: 0.55 }, tail: { len: 0.5, droop: 0.0, lift: 0.04, thick: 0.6 },
      head: head(0.1, 0.055, 'beak', 0.2), arms: 0.5, feats: F({ armor: { from: 0.2, to: 2.2, n: 14 } }),
    },
  },
  {
    id: 'stegosaurus', name: 'Stegosaurus', era: 'jurassic', diet: 'herbivore', meaning: '"Roofed lizard"',
    length: 9, weight: '5 tonnes', homeX: 2850, speed: 28,
    fact: 'Its brain was only about the size of a lime! The big back plates may have helped it warm up, cool down and impress others.',
    colors: { body: '#6bb54a', belly: '#d3e8a0', accent: '#e8832e', stripe: '#3f8a35' },
    shape: {
      kind: 'quad', bodyLen: 0.32, bodyH: 0.19, legH: 0.11, legW: 0.05, tilt: 0.16,
      neck: { len: 0.14, ang: 0.3, thick: 0.5 }, tail: { len: 0.36, droop: 0.0, lift: 0.0, thick: 0.6 },
      head: head(0.1, 0.05, 'beak', 0.5),
      feats: F({ plates: { from: 1.0, to: 2.45, n: 9, h: 0.17 }, spikes: { from: 0.12, to: 0.55, n: 4, h: 0.1 }, stripes: true }),
    },
  },
  {
    id: 'diplodocus', name: 'Diplodocus', era: 'jurassic', diet: 'herbivore', meaning: '"Double beam"',
    length: 26, weight: '15 tonnes', swims: true, homeX: 3480, speed: 26,
    fact: 'One of the longest dinosaurs ever found. Its whip-like tail may have cracked louder than a thunderclap!',
    colors: { body: '#d9b07a', belly: '#f6e6c0', accent: '#b8854f', stripe: '#bf955f' },
    shape: sauropod({ bodyLen: 0.22, bodyH: 0.1, legH: 0.13, tilt: -0.1, neck: { len: 0.4, ang: 0.75, thick: 0.4 }, tail: { len: 0.45, droop: 0.12, lift: 0.0, thick: 0.6 }, feats: F({ spots: true }) }),
  },

  /* ------------------------------ CRETACEOUS ------------------------------ */
  {
    id: 'amargasaurus', name: 'Amargasaurus', era: 'cretaceous', diet: 'herbivore', meaning: '"La Amarga lizard"',
    length: 10, weight: '3 tonnes', homeX: 4000, speed: 28,
    fact: 'Two rows of tall spines ran down its neck and back. They may have supported skin sails used for display.',
    colors: { body: '#3c8fd0', belly: '#f5d4a0', accent: '#e5586a', stripe: '#2b6fa8' },
    shape: sauropod({ bodyH: 0.12, legH: 0.12, neck: { len: 0.3, ang: 0.85, thick: 0.45 }, tail: { len: 0.36, droop: 0.06, lift: 0, thick: 0.6 }, head: head(0.07, 0.04, 'blunt', 0.3), feats: F({ sail: { from: 1.3, to: 2.9, h: 0.15, rays: true, membrane: 0.35 }, stripes: true }) }),
  },
  {
    id: 'alectrosaurus', name: 'Alectrosaurus', era: 'cretaceous', diet: 'carnivore', meaning: '"Unmarried lizard"',
    length: 5, weight: '1 tonne', homeX: 4950, speed: 56,
    fact: 'A long-legged tyrannosaur relative from Mongolia. Its name means "unmarried" because no one knew its relatives at first.',
    colors: { body: '#6a5bb8', belly: '#f2d9ec', accent: '#ea5a5a', stripe: '#4a3d8e' },
    shape: theropod({ legH: 0.24, bodyH: 0.14, head: head(0.17, 0.09, 'rex', 0.12), feats: F({ stripes: true, teeth: true }) }),
  },
  {
    id: 'pteranodon', name: 'Pteranodon', era: 'cretaceous', diet: 'piscivore', kind: 'Pterosaur', meaning: '"Toothless wing"',
    length: 6, weight: '25 kg', count: 2, flies: true, homeX: 4400, speed: 50, sizeMul: 0.8,
    fact: 'A giant flying reptile with a wingspan of about 6 metres. It swooped over the sea snatching fish, and it had no teeth.',
    colors: { body: '#e9806a', belly: '#f8d2b8', accent: '#c94d3d', extra: '#f2a58f' },
    shape: {
      kind: 'ptero', bodyLen: 0.3, bodyH: 0.1, legH: 0.12, legW: 0.02, tilt: 0,
      neck: { len: 0.1, ang: 0.5 }, tail: { len: 0.1, droop: 0, lift: 0 }, head: head(0.32, 0.07, 'long', 0.08),
      feats: F({ wingCrest: 0.22 }),
    },
  },
  {
    id: 'styracosaurus', name: 'Styracosaurus', era: 'cretaceous', diet: 'herbivore', meaning: '"Spiked lizard"',
    length: 5.5, weight: '3 tonnes', homeX: 4300, speed: 30,
    fact: 'Six long spikes crowned its neck frill and one big horn rose from its nose. They were great for showing off and for defence.',
    colors: { body: '#3fa0a0', belly: '#f2e0b0', accent: '#f2b23a', stripe: '#2a7c7c', extra: '#e85a3a' },
    shape: {
      kind: 'quad', bodyLen: 0.3, bodyH: 0.17, legH: 0.1, legW: 0.05, tilt: 0.04,
      neck: { len: 0.1, ang: 0.35, thick: 0.7 }, tail: { len: 0.28, droop: 0.02, lift: 0.0, thick: 0.6 },
      head: head(0.15, 0.1, 'beak', 0.25), feats: F({ frill: 0.16, hornNose: 0.1, stripes: true }),
    },
  },
  {
    id: 'tyrannosaurus', name: 'Tyrannosaurus', era: 'cretaceous', diet: 'carnivore', meaning: '"Tyrant lizard"',
    length: 12, weight: '8 tonnes', homeX: 4700, speed: 50,
    fact: 'The king of the dinosaurs! Its bite was strong enough to crush bone, and teeth as long as bananas (including the root).',
    colors: { body: '#d2812f', belly: '#f2d8a0', accent: '#8a4a1a', stripe: '#8a4a1a' },
    shape: theropod({ bodyLen: 0.3, bodyH: 0.18, legH: 0.22, legW: 0.065, neck: { len: 0.1, ang: 0.95, thick: 0.7 }, head: head(0.22, 0.14, 'rex', 0.12), arms: 0.25, feats: F({ stripes: true, teeth: true }) }),
  },
  {
    id: 'ankylosaurus', name: 'Ankylosaurus', era: 'cretaceous', diet: 'herbivore', meaning: '"Fused lizard"',
    length: 7, weight: '6 tonnes', homeX: 4650, speed: 24,
    fact: 'A living tank! Bony armor covered its back and its heavy tail club could break the leg of an attacker.',
    colors: { body: '#5b6fb5', belly: '#d7d0ea', accent: '#e5603a', stripe: '#43548f', extra: '#e5603a' },
    shape: {
      kind: 'quad', bodyLen: 0.34, bodyH: 0.2, legH: 0.07, legW: 0.05, tilt: 0.0,
      neck: { len: 0.08, ang: 0.2, thick: 0.8 }, tail: { len: 0.32, droop: 0.0, lift: 0.0, thick: 0.6 },
      head: head(0.12, 0.08, 'blunt', 0.25),
      feats: F({ armor: { from: 1.0, to: 2.4, n: 12 }, spikes: { from: 0.9, to: 2.2, n: 8, h: 0.045 }, club: 0.07, stripes: true }),
    },
  },
  {
    id: 'baryonyx', name: 'Baryonyx', era: 'cretaceous', diet: 'piscivore', meaning: '"Heavy claw"',
    length: 8, weight: '1.2 tonnes', swims: true, homeX: 4500, speed: 48,
    fact: 'A fishing dinosaur with a croc-like snout and a giant 30 cm thumb claw. A fossil was found with fish scales in its belly!',
    colors: { body: '#4a9a4a', belly: '#e2e8a0', accent: '#d9553a', stripe: '#2b6a3a' },
    shape: theropod({ bodyH: 0.14, legH: 0.18, head: head(0.22, 0.08, 'long', 0.15), arms: 0.7, feats: F({ crest: 'bump', stripes: true, teeth: true }) }),
  },
  {
    id: 'lambeosaurus', name: 'Lambeosaurus', era: 'cretaceous', diet: 'herbivore', meaning: '"Lambe\'s lizard"',
    length: 9.5, weight: '3 tonnes', count: 2, swims: true, homeX: 4150, speed: 40,
    fact: 'This duck-billed dinosaur had a hatchet-shaped hollow crest that worked like a trumpet to call to the herd.',
    colors: { body: '#3aa59b', belly: '#f2d68b', accent: '#ee9a35', stripe: '#27796f' },
    shape: {
      kind: 'biped', bodyLen: 0.3, bodyH: 0.15, legH: 0.18, legW: 0.05, tilt: 0.06,
      neck: { len: 0.17, ang: 0.8, thick: 0.45 }, tail: { len: 0.36, droop: 0.04, lift: 0.05, thick: 0.6 },
      head: head(0.13, 0.065, 'duck', 0.28), arms: 0.5, feats: F({ crest: 'tube', stripes: true }),
    },
  },
  {
    id: 'panoplosaurus', name: 'Panoplosaurus', era: 'cretaceous', diet: 'herbivore', meaning: '"Fully armored lizard"',
    length: 7, weight: '3.5 tonnes', homeX: 5000, speed: 24,
    fact: 'Unlike its cousin Ankylosaurus it had no tail club, but large spikes on its shoulders kept predators away.',
    colors: { body: '#5f87a8', belly: '#e6e3d2', accent: '#d9703a', stripe: '#456b8a' },
    shape: {
      kind: 'quad', bodyLen: 0.33, bodyH: 0.18, legH: 0.07, legW: 0.05, tilt: 0.02,
      neck: { len: 0.08, ang: 0.2, thick: 0.8 }, tail: { len: 0.3, droop: 0.0, lift: 0.0, thick: 0.6 },
      head: head(0.12, 0.08, 'blunt', 0.2), feats: F({ armor: { from: 1.0, to: 2.5, n: 14 }, spikes: { from: 1.6, to: 2.5, n: 5, h: 0.06 } }),
    },
  },
  {
    id: 'iguanodon', name: 'Iguanodon', era: 'cretaceous', diet: 'herbivore', meaning: '"Iguana tooth"',
    length: 10, weight: '3.5 tonnes', count: 2, swims: true, homeX: 3800, speed: 40,
    fact: 'One of the first dinosaurs ever named, in 1825. Its thumb spike was a handy tool for defence and maybe for getting at food.',
    colors: { body: '#6c87c4', belly: '#f0dfc0', accent: '#d9703a', stripe: '#4b64a0' },
    shape: {
      kind: 'biped', bodyLen: 0.3, bodyH: 0.15, legH: 0.18, legW: 0.052, tilt: 0.06,
      neck: { len: 0.14, ang: 0.8, thick: 0.5 }, tail: { len: 0.36, droop: 0.04, lift: 0.05, thick: 0.6 },
      head: head(0.14, 0.07, 'duck', 0.3), arms: 0.6, feats: F({ thumbSpike: true, stripes: true }),
    },
  },
  {
    id: 'carnotaurus', name: 'Carnotaurus', era: 'cretaceous', diet: 'carnivore', meaning: '"Meat-eating bull"',
    length: 8, weight: '1.5 tonnes', homeX: 4850, speed: 62,
    fact: 'Two bull-like horns above its eyes and tiny arms. Carnotaurus was one of the fastest big predators.',
    colors: { body: '#c2403c', belly: '#f2cfa0', accent: '#7a1f2a', stripe: '#8a2a2a' },
    shape: theropod({ legH: 0.23, bodyH: 0.16, head: head(0.18, 0.11, 'rex', 0.12), arms: 0.15, feats: F({ hornBrow: 1.0, stripes: true, teeth: true }) }),
  },
  {
    id: 'ouranosaurus', name: 'Ouranosaurus', era: 'cretaceous', diet: 'herbivore', meaning: '"Brave lizard"',
    length: 8, weight: '4 tonnes', homeX: 5200, speed: 36,
    fact: 'A big plant eater from Africa with a tall sail on its back, probably used to regulate temperature.',
    colors: { body: '#d4473f', belly: '#f6d9a0', accent: '#f0a03a', stripe: '#9a2f2a' },
    shape: {
      kind: 'biped', bodyLen: 0.3, bodyH: 0.14, legH: 0.18, legW: 0.05, tilt: 0.06,
      neck: { len: 0.14, ang: 0.8, thick: 0.5 }, tail: { len: 0.36, droop: 0.04, lift: 0.04, thick: 0.6 },
      head: head(0.14, 0.07, 'duck', 0.3), arms: 0.6, feats: F({ sail: { from: 0.95, to: 2.1, h: 0.17, rays: true, membrane: 0.9 }, stripes: true }),
    },
  },
  {
    id: 'oviraptor', name: 'Oviraptor', era: 'cretaceous', diet: 'omnivore', meaning: '"Egg thief"',
    length: 2, weight: '35 kg', homeX: 4250, speed: 70, count: 2,
    fact: 'The "egg thief" got its bad name by mistake. It was found sitting on its own nest, protecting its eggs like a bird.',
    colors: { body: '#5ab89a', belly: '#f4efc8', accent: '#e8573d', stripe: '#3e8c74' },
    shape: theropod({ bodyLen: 0.26, bodyH: 0.13, legH: 0.22, head: head(0.1, 0.09, 'beak', 0.1), neck: { len: 0.17, ang: 0.85, thick: 0.4 }, arms: 0.6, feats: F({ crest: 'plume', feathers: true, stripes: true }) }),
  },
  {
    id: 'archelon', name: 'Archelon', era: 'cretaceous', diet: 'omnivore', kind: 'Marine reptile', meaning: '"Ruler turtle"',
    length: 4.6, weight: '2.2 tonnes', aquatic: true, homeX: 4560, speed: 28, sizeMul: 1.3,
    fact: 'The biggest sea turtle that ever lived, as long as a small car. Its shell was leathery instead of hard.',
    colors: { body: '#52a779', belly: '#e8e0a8', accent: '#e0a940', extra: '#3f7d5f' },
    shape: {
      kind: 'turtle', bodyLen: 0.5, bodyH: 0.2, legH: 0.04, legW: 0.04, tilt: 0,
      neck: { len: 0.1, ang: 0.2 }, tail: { len: 0.1, droop: 0, lift: 0 }, head: head(0.12, 0.08, 'beak', 0.05), feats: F({ flipper: 1.2 }),
    },
  },
  {
    id: 'velociraptor', name: 'Velociraptor', era: 'cretaceous', diet: 'carnivore', meaning: '"Swift thief"',
    length: 2, weight: '15 kg', count: 3, homeX: 4000, speed: 95,
    fact: 'Only turkey-sized, and covered in feathers! Velociraptor was fast, smart and had a sickle-shaped claw on each foot.',
    colors: { body: '#e8963a', belly: '#f8e3b0', accent: '#c1452b', stripe: '#a8442a' },
    shape: theropod({ bodyLen: 0.25, bodyH: 0.11, legH: 0.22, legW: 0.04, tilt: 0.12, neck: { len: 0.14, ang: 0.85, thick: 0.45 }, tail: { len: 0.42, droop: 0.02, lift: 0.05, thick: 0.55 }, head: head(0.14, 0.065, 'long', 0.12), arms: 0.7, feats: F({ feathers: true, stripes: true, teeth: true }) }),
  },

  /* ------------------------- bonus species (not on the poster) ------------------------- */
  {
    id: 'coelophysis', name: 'Coelophysis', era: 'triassic', diet: 'carnivore', meaning: '"Hollow form"',
    length: 3, weight: '20 kg', count: 2, speed: 85,
    fact: 'A slim, fast hunter that lived in packs. Its bones were hollow, which kept it light and quick.',
    colors: { body: '#d9b84a', belly: '#fbf0c8', accent: '#8a5a22', stripe: '#a8782e' },
    shape: theropod({ bodyLen: 0.24, bodyH: 0.09, legH: 0.22, legW: 0.035, neck: { len: 0.17, ang: 0.8, thick: 0.45 }, tail: { len: 0.5, droop: 0.02, lift: 0.05, thick: 0.55 }, head: head(0.14, 0.055, 'long', 0.1), arms: 0.5, feats: F({ stripes: true, teeth: true }) }),
  },
  {
    id: 'brachiosaurus', name: 'Brachiosaurus', era: 'jurassic', diet: 'herbivore', meaning: '"Arm lizard"',
    length: 26, weight: '40 tonnes', swims: true, speed: 24,
    fact: 'Its front legs were longer than its back legs, so its neck towered like a giraffe’s, high above the treetops.',
    colors: { body: '#7cae5a', belly: '#e8e2a0', accent: '#4f7c3a', stripe: '#5f9446' },
    shape: sauropod({ bodyLen: 0.24, bodyH: 0.15, legH: 0.17, tilt: -0.14, neck: { len: 0.46, ang: 1.25, thick: 0.38 }, tail: { len: 0.2, droop: 0.06, lift: 0, thick: 0.6 }, head: head(0.07, 0.045, 'blunt', 0.3), feats: F({ stripes: true }) }),
  },
  {
    id: 'triceratops', name: 'Triceratops', era: 'cretaceous', diet: 'herbivore', meaning: '"Three-horned face"',
    length: 9, weight: '6 tonnes', speed: 34,
    fact: 'Three horns and a bony neck shield protected it from Tyrannosaurus. It had up to 800 teeth for chewing tough plants!',
    colors: { body: '#b0794a', belly: '#f2e0b0', accent: '#f2c14a', stripe: '#7e5230', extra: '#e0524c' },
    shape: {
      kind: 'quad', bodyLen: 0.34, bodyH: 0.2, legH: 0.09, legW: 0.055, tilt: 0.04,
      neck: { len: 0.08, ang: 0.3, thick: 0.8 }, tail: { len: 0.26, droop: 0.0, lift: 0.0, thick: 0.6 },
      head: head(0.19, 0.12, 'beak', 0.25), feats: F({ frill: 0.2, hornNose: 0.07, hornBrow: 1.4, stripes: true }),
    },
  },
  {
    id: 'parasaurolophus', name: 'Parasaurolophus', era: 'cretaceous', diet: 'herbivore', meaning: '"Near crested lizard"',
    length: 10, weight: '3 tonnes', count: 2, swims: true, speed: 42,
    fact: 'Its long hollow crest worked like a trombone, letting herds honk warnings across the plains.',
    colors: { body: '#c4553f', belly: '#f6dca0', accent: '#3a9bb5', stripe: '#8a3326' },
    shape: {
      kind: 'biped', bodyLen: 0.3, bodyH: 0.15, legH: 0.18, legW: 0.05, tilt: 0.06,
      neck: { len: 0.17, ang: 0.8, thick: 0.45 }, tail: { len: 0.36, droop: 0.04, lift: 0.05, thick: 0.6 },
      head: head(0.13, 0.065, 'duck', 0.28), arms: 0.5, feats: F({ crest: 'tube', stripes: true }),
    },
  },
  {
    id: 'spinosaurus', name: 'Spinosaurus', era: 'cretaceous', diet: 'piscivore', meaning: '"Spine lizard"',
    length: 15, weight: '7 tonnes', swims: true, speed: 46,
    fact: 'The biggest meat-eating dinosaur known. It hunted fish in rivers, using a crocodile-like snout and a giant sail on its back.',
    colors: { body: '#2f8f8f', belly: '#e6e8b0', accent: '#e8573d', stripe: '#1d6a6a' },
    shape: theropod({ bodyH: 0.16, legH: 0.17, head: head(0.25, 0.08, 'long', 0.15), arms: 0.7, feats: F({ sail: { from: 1.0, to: 2.1, h: 0.2, rays: true, membrane: 0.85 }, stripes: true, teeth: true }) }),
  },
  {
    id: 'gallimimus', name: 'Gallimimus', era: 'cretaceous', diet: 'omnivore', meaning: '"Chicken mimic"',
    length: 6, weight: '450 kg', count: 2, speed: 115,
    fact: 'Built like an ostrich, Gallimimus could sprint at about 50 km/h to outrun predators.',
    colors: { body: '#e8a04a', belly: '#fbeed0', accent: '#c1452b', stripe: '#b87428' },
    shape: theropod({ bodyLen: 0.22, bodyH: 0.1, legH: 0.3, legW: 0.035, tilt: 0.1, neck: { len: 0.26, ang: 0.95, thick: 0.4 }, tail: { len: 0.35, droop: 0.02, lift: 0.05, thick: 0.55 }, head: head(0.08, 0.05, 'beak', 0.1), arms: 0.5, feats: F({ stripes: true }) }),
  },

  /* ------------------------- sea reptiles ------------------------- */
  {
    id: 'nothosaurus', name: 'Nothosaurus', era: 'triassic', diet: 'piscivore', kind: 'Marine reptile', meaning: '"False lizard"',
    length: 4, weight: '250 kg', count: 1, aquatic: true, speed: 36, sizeMul: 1.2,
    fact: 'A Triassic sea hunter with webbed paddles and a mouth full of needle teeth. It hauled out on beaches like a seal.',
    colors: { body: '#6a8f4a', belly: '#e6e3a8', accent: '#d98a2c', stripe: '#476a30' },
    shape: {
      kind: 'marine', bodyLen: 0.34, bodyH: 0.1, legH: 0.04, legW: 0.04, tilt: 0,
      neck: { len: 0.22, ang: 0.45, thick: 0.4 }, tail: { len: 0.22, droop: 0, lift: 0 }, head: head(0.14, 0.05, 'long', 0.1),
      feats: F({ marine: 'plesio', teeth: true, stripes: true }),
    },
  },
  {
    id: 'ichthyosaurus', name: 'Ichthyosaurus', era: 'jurassic', diet: 'piscivore', kind: 'Marine reptile', meaning: '"Fish lizard"',
    length: 2, weight: '90 kg', count: 2, aquatic: true, speed: 70, sizeMul: 1.8,
    fact: 'It looked just like a dolphin but was a reptile! Ichthyosaurs had huge eyes and gave birth to live young in the sea.',
    colors: { body: '#4a86b8', belly: '#e8f1f2', accent: '#f0b44a', stripe: '#2f5f8f' },
    shape: {
      kind: 'marine', bodyLen: 0.46, bodyH: 0.13, legH: 0.04, legW: 0.04, tilt: 0,
      neck: { len: 0.08, ang: 0.1, thick: 0.75 }, tail: { len: 0.26, droop: 0, lift: 0 }, head: head(0.19, 0.06, 'long', 0.05),
      feats: F({ marine: 'ichthyo', teeth: true, fluke: true }),
    },
  },
  {
    id: 'liopleurodon', name: 'Liopleurodon', era: 'jurassic', diet: 'carnivore', kind: 'Marine reptile', meaning: '"Smooth-sided teeth"',
    length: 7, weight: '1 tonne', count: 1, aquatic: true, speed: 46, sizeMul: 1.2,
    fact: 'A fearsome sea predator with four big paddles and a massive crushing bite. Few things in the Jurassic ocean were safe from it.',
    colors: { body: '#4f5d8e', belly: '#d9dcee', accent: '#e85a4a', stripe: '#323d66' },
    shape: {
      kind: 'marine', bodyLen: 0.44, bodyH: 0.15, legH: 0.04, legW: 0.04, tilt: 0,
      neck: { len: 0.12, ang: 0.3, thick: 0.75 }, tail: { len: 0.18, droop: 0, lift: 0 }, head: head(0.28, 0.1, 'rex', 0.08),
      feats: F({ marine: 'plesio', teeth: true }),
    },
  },
  {
    id: 'elasmosaurus', name: 'Elasmosaurus', era: 'cretaceous', diet: 'piscivore', kind: 'Marine reptile', meaning: '"Thin-plate lizard"',
    length: 10, weight: '2 tonnes', count: 1, aquatic: true, speed: 32, sizeMul: 1.0,
    fact: 'Half of its 10 metre body was neck! It swam gracefully with four flippers, snapping up fish with its tiny head.',
    colors: { body: '#3d9a9a', belly: '#f1ecc2', accent: '#f08a4a', stripe: '#27706f' },
    shape: {
      kind: 'marine', bodyLen: 0.32, bodyH: 0.1, legH: 0.04, legW: 0.04, tilt: 0,
      neck: { len: 0.62, ang: 0.62, thick: 0.35 }, tail: { len: 0.24, droop: 0, lift: 0 }, head: head(0.1, 0.045, 'long', 0.1),
      feats: F({ marine: 'plesio', teeth: true }),
    },
  },
  {
    id: 'mosasaurus', name: 'Mosasaurus', era: 'cretaceous', diet: 'carnivore', kind: 'Marine reptile', meaning: '"Meuse lizard"',
    length: 13, weight: '5 tonnes', count: 1, aquatic: true, speed: 58, sizeMul: 0.9,
    fact: 'The giant lizard of the Cretaceous seas. Mosasaurus swept its tail like a shark and had two rows of teeth on its roof.',
    colors: { body: '#4c7a68', belly: '#e0e6c4', accent: '#d9553a', stripe: '#2f5546' },
    shape: {
      kind: 'marine', bodyLen: 0.6, bodyH: 0.12, legH: 0.04, legW: 0.04, tilt: 0,
      neck: { len: 0.1, ang: 0.1, thick: 0.7 }, tail: { len: 0.34, droop: 0, lift: 0 }, head: head(0.22, 0.08, 'rex', 0.06),
      feats: F({ marine: 'mosa', teeth: true, fluke: true, stripes: true }),
    },
  },

  /* ------------------------- flyers and birds ------------------------- */
  {
    id: 'eudimorphodon', name: 'Eudimorphodon', era: 'triassic', diet: 'piscivore', kind: 'Pterosaur', meaning: '"True two-form tooth"',
    length: 1, weight: '10 kg', count: 2, flies: true, speed: 48, sizeMul: 1.7,
    fact: 'One of the oldest flying reptiles. Fish scales were found in its stomach, so it likely skimmed the sea for dinner.',
    colors: { body: '#4a9ad8', belly: '#e0f0fa', accent: '#f0a030', extra: '#6fb8e8' },
    shape: { kind: 'ptero', bodyLen: 0.28, bodyH: 0.09, legH: 0.09, legW: 0.02, tilt: 0, neck: { len: 0.07, ang: 0.5 }, tail: { len: 0.36, droop: 0, lift: 0 }, head: head(0.18, 0.08, 'long', 0.1), feats: F({ longTail: true, teeth: true }) },
  },
  {
    id: 'rhamphorhynchus', name: 'Rhamphorhynchus', era: 'jurassic', diet: 'piscivore', kind: 'Pterosaur', meaning: '"Beak snout"',
    length: 1.3, weight: '2 kg', count: 2, flies: true, speed: 52, sizeMul: 1.7,
    fact: 'It had a long stiff tail with a diamond-shaped rudder and sharp curved teeth that locked together to trap slippery fish.',
    colors: { body: '#7a5fb8', belly: '#e8dcf6', accent: '#f2c14a', extra: '#9a7fd8' },
    shape: { kind: 'ptero', bodyLen: 0.26, bodyH: 0.08, legH: 0.09, legW: 0.02, tilt: 0, neck: { len: 0.07, ang: 0.5 }, tail: { len: 0.46, droop: 0, lift: 0 }, head: head(0.2, 0.07, 'long', 0.1), feats: F({ longTail: true, teeth: true }) },
  },
  {
    id: 'archaeopteryx', name: 'Archaeopteryx', era: 'jurassic', diet: 'omnivore', kind: 'Early bird', meaning: '"Ancient wing"',
    length: 0.5, weight: '1 kg', count: 4, flies: true, speed: 60, sizeMul: 2.2,
    fact: 'The famous first bird! It had feathered wings like a modern bird but also teeth and a long bony tail like a dinosaur.',
    colors: { body: '#3a8f6a', belly: '#f4edc0', accent: '#e8573d', extra: '#2f6fb0' },
    shape: { kind: 'ptero', bodyLen: 0.22, bodyH: 0.1, legH: 0.12, legW: 0.02, tilt: 0, neck: { len: 0.08, ang: 0.6 }, tail: { len: 0.3, droop: 0, lift: 0 }, head: head(0.12, 0.07, 'beak', 0.1), feats: F({ longTail: true, feathers: true }) },
  },
  {
    id: 'quetzalcoatlus', name: 'Quetzalcoatlus', era: 'cretaceous', diet: 'piscivore', kind: 'Pterosaur', meaning: '"Feathered serpent god"',
    length: 11, weight: '200 kg', count: 1, flies: true, speed: 44, sizeMul: 0.75,
    fact: 'The largest flying animal ever, with wings as wide as a small plane. It stood as tall as a giraffe when walking on the ground.',
    colors: { body: '#d8654a', belly: '#f8d8bc', accent: '#2f8f9a', extra: '#ec9a78' },
    shape: { kind: 'ptero', bodyLen: 0.3, bodyH: 0.1, legH: 0.16, legW: 0.025, tilt: 0, neck: { len: 0.14, ang: 0.6 }, tail: { len: 0.08, droop: 0, lift: 0 }, head: head(0.4, 0.07, 'long', 0.06), feats: F({ wingCrest: 0.3 }) },
  },
  {
    id: 'confuciusornis', name: 'Confuciusornis', era: 'cretaceous', diet: 'omnivore', kind: 'Early bird', meaning: '"Confucius bird"',
    length: 0.5, weight: '0.5 kg', count: 5, flies: true, speed: 64, sizeMul: 2.2,
    fact: 'One of the first birds with a toothless beak. Males grew two long ribbon-like tail feathers to impress their mates.',
    colors: { body: '#e8a83a', belly: '#fff0c8', accent: '#d9453a', extra: '#58a8c8' },
    shape: { kind: 'ptero', bodyLen: 0.2, bodyH: 0.1, legH: 0.12, legW: 0.02, tilt: 0, neck: { len: 0.07, ang: 0.6 }, tail: { len: 0.24, droop: 0, lift: 0 }, head: head(0.11, 0.07, 'beak', 0.1), feats: F({ longTail: true, feathers: true }) },
  },
  {
    id: 'microraptor', name: 'Microraptor', era: 'cretaceous', diet: 'carnivore', kind: 'Feathered glider', meaning: '"Tiny thief"',
    length: 0.8, weight: '1 kg', count: 3, flies: true, speed: 58, sizeMul: 2.0,
    fact: 'A four-winged glider with long feathers on both its arms and legs. It leapt from tree to tree to hunt.',
    colors: { body: '#2f5f9a', belly: '#d8e6f4', accent: '#e8b53a', extra: '#3f7fc0' },
    shape: { kind: 'ptero', bodyLen: 0.24, bodyH: 0.09, legH: 0.12, legW: 0.02, tilt: 0, neck: { len: 0.08, ang: 0.6 }, tail: { len: 0.34, droop: 0, lift: 0 }, head: head(0.13, 0.07, 'long', 0.1), feats: F({ longTail: true, feathers: true, teeth: true }) },
  },
];

/* -------------------------------------------------------------------------- */

function build(d: Def): Species {
  const s = d.shape;
  const size = Math.max(54, 28 * Math.pow(d.length, 0.8)) * (d.sizeMul ?? 1) * 1.7;
  const neckRise = Math.max(0, s.neck.len * Math.sin(s.neck.ang)) * 0.9;
  const base = s.kind === 'ptero' ? 0.3 : s.kind === 'turtle' || s.kind === 'marine' ? s.bodyH * 0.8 : s.legH + s.bodyH + neckRise + s.head.h * 0.4;
  const hitW = s.kind === 'ptero' ? 0.8 : s.kind === 'turtle' ? 0.6 : s.kind === 'marine' ? 0.7 : Math.min(1.0, s.bodyLen + s.neck.len * 0.5 + s.tail.len * 0.3);
  return {
    id: d.id, name: d.name, era: d.era, diet: d.diet, kind: d.kind ?? 'Dinosaur', meaning: d.meaning,
    length: d.length, weight: d.weight, fact: d.fact, count: d.count ?? 1, shape: s, colors: d.colors,
    speed: (d.speed ?? 36) * 1.3, swims: d.swims, aquatic: d.aquatic, flies: d.flies, homeX: d.homeX, size,
    hitW, hitH: base + 0.04,
  };
}

export const SPECIES: Species[] = DEFS.map(build);
export const SPECIES_BY_ID: Record<string, Species> = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
export const SPECIES_BY_ERA = (era: Era) => SPECIES.filter((s) => s.era === era);

const variantCache = new Map<string, Species>();
/** Colour variant of a species (different hue/lightness) so no two herds look identical. */
export function variantOf(sp: Species, deg: number, light: number): Species {
  if (deg === 0 && light === 0) return sp;
  const key = `${sp.id}:${deg}:${light}`;
  let v = variantCache.get(key);
  if (!v) {
    const c = sp.colors;
    v = {
      ...sp,
      colors: {
        body: hueShift(c.body, deg, light),
        belly: hueShift(c.belly, deg * 0.4),
        accent: hueShift(c.accent, deg * 1.3),
        stripe: c.stripe ? hueShift(c.stripe, deg, light) : undefined,
        extra: c.extra ? hueShift(c.extra, deg * 1.1) : undefined,
      },
    };
    variantCache.set(key, v);
  }
  return v;
}
