import { ERAS, SPECIES_BY_ERA } from '../game/species';
import type { Era } from '../game/types';
import { Portrait } from './Portrait';

const ORDER: Era[] = ['triassic', 'jurassic', 'cretaceous'];

export function FieldGuide({ discovered, onPick, onClose }: { discovered: Set<string>; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <div className="guide-backdrop" onClick={onClose}>
      <div className="guide" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn guide-close" onClick={onClose} aria-label="Close">✕</button>
        <h1 className="poster-title">AGE OF DINOSAURS</h1>
        <p className="guide-sub">Field guide · tap an animal to fly to it in the park</p>
        <div className="guide-cols">
          {ORDER.map((era) => (
            <section key={era} className="guide-col">
              <header style={{ background: ERAS[era].color, color: ERAS[era].ink }}>{ERAS[era].short}</header>
              <div className="guide-grid">
                {SPECIES_BY_ERA(era).map((sp) => {
                  const seen = discovered.has(sp.id);
                  return (
                    <button key={sp.id} className={`guide-item ${seen ? 'seen' : ''}`} onClick={() => onPick(sp.id)}>
                      <Portrait sp={sp} w={118} h={64} dim={!seen} />
                      <span>{seen ? sp.name : '???'}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
