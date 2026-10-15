export type Era = 'triassic' | 'jurassic' | 'cretaceous';
export type Diet = 'herbivore' | 'carnivore' | 'omnivore' | 'piscivore';
export type Tool = 'look' | 'pet' | 'grass' | 'meat';
export type HeadStyle = 'rex' | 'long' | 'blunt' | 'duck' | 'beak';

/** Ridge features are placed along the spine using "extended" coords:
 *  0 = tail tip, 1 = hip, 2 = shoulder, 3 = end of neck. */
export interface RidgeFeat {
  from: number;
  to: number;
  n: number;
  h: number;
}

export interface Feats {
  plates?: RidgeFeat;
  spikes?: RidgeFeat;
  armor?: { from: number; to: number; n: number };
  sail?: { from: number; to: number; h: number; rays?: boolean; membrane?: number };
  club?: number;
  tailSpikes?: number;
  crest?: 'twin' | 'tube' | 'bump' | 'plume';
  hornNose?: number;
  hornBrow?: number;
  frill?: number;
  feathers?: boolean;
  teeth?: boolean;
  stripes?: boolean;
  spots?: boolean;
  beak?: boolean;
  thumbSpike?: boolean;
  wingCrest?: number; // pterosaur head crest length
  longTail?: boolean; // pterosaur with long tail
  flipper?: number; // turtle flipper size
  boxShell?: boolean;
  marine?: 'plesio' | 'ichthyo' | 'mosa'; // sea-reptile body plan
  fluke?: boolean;
}

export interface Shape {
  kind: 'quad' | 'biped' | 'turtle' | 'ptero' | 'marine';
  bodyLen: number;
  bodyH: number;
  legH: number;
  legW: number;
  tilt: number; // >0: shoulders lower than hips
  neck: { len: number; ang: number; thick?: number };
  tail: { len: number; droop: number; lift: number; thick?: number };
  head: { len: number; h: number; style: HeadStyle; ang?: number };
  arms?: number;
  digi?: boolean;
  feats?: Feats;
}

export interface Palette {
  body: string;
  belly: string;
  accent: string;
  stripe?: string;
  extra?: string; // wing / shell colour
}

export interface Species {
  id: string;
  name: string;
  era: Era;
  diet: Diet;
  kind: string; // "Dinosaur", "Pterosaur", ...
  meaning: string;
  length: number; // metres
  weight: string;
  fact: string;
  count: number;
  shape: Shape;
  colors: Palette;
  speed: number; // px/s walking speed at depth 1
  swims?: boolean;
  aquatic?: boolean;
  flies?: boolean;
  homeX?: number;
  size: number; // px (unit length)
  hitW: number;
  hitH: number;
}

export interface Pose {
  phase: number; // walk / flap cycle (radians)
  moving: number; // 0..1 stride amplitude
  headLower: number;
  jaw: number;
  sleep: number;
  swim: number;
  t: number;
  blink: number;
  happy: number;
  fold: number; // pterosaur wings folded (landed)
  flap: number; // pterosaur flap amplitude
  lookAt?: number;
}

export type DinoState =
  | 'idle'
  | 'walk'
  | 'graze'
  | 'sleep'
  | 'swim'
  | 'goFood'
  | 'eat'
  | 'pet'
  | 'refuse'
  | 'fly'
  | 'land'
  | 'perch';

export interface Food {
  id: number;
  kind: 'grass' | 'meat';
  x: number;
  y: number;
  bites: number;
  age: number;
  pop: number;
}
