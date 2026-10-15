import type { DinoInfo } from '../game/engine';
import { ERAS } from '../game/species';
import { Portrait } from './Portrait';

const DIET_ICON: Record<string, string> = { herbivore: '🌿 Plant eater', carnivore: '🍖 Meat eater', omnivore: '🌿🍖 Eats both', piscivore: '🐟 Fish & meat eater' };

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bar">
      <span>{label}</span>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.round(value * 100)}%`, background: color }} /></div>
    </div>
  );
}

export function InfoCard({ info, onClose, onFollow }: { info: DinoInfo; onClose: () => void; onFollow: () => void }) {
  const sp = info.sp;
  const era = ERAS[sp.era];
  return (
    <aside className="info-card" style={{ ['--era' as string]: era.color, ['--era-ink' as string]: era.ink }}>
      <div className="info-head">
        <span className="era-chip">{era.short}</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="info-portrait"><Portrait sp={sp} w={268} h={130} /></div>
      <h2>{sp.name}</h2>
      <p className="meaning">{sp.meaning} · {sp.kind}</p>
      <div className="facts">
        <div><b>{sp.length} m</b><small>{sp.kind === 'Pterosaur' ? 'wingspan' : 'length'}</small></div>
        <div><b>{sp.weight}</b><small>weight</small></div>
        <div><b>{DIET_ICON[sp.diet].split(' ')[0]}</b><small>{DIET_ICON[sp.diet].split(' ').slice(1).join(' ')}</small></div>
      </div>
      <p className="fact">{sp.fact}</p>
      <p className="era-range">Lived {era.range}</p>
      <div className="status"><span className="dot" /> {info.stateLabel}</div>
      <Bar label="Full" value={info.fullness} color="#7bd05a" />
      <Bar label={`Mood · ${info.moodLabel}`} value={info.mood} color="#ff7aa8" />
      <div className="mini-stats">🍽 Fed {info.fed}× &nbsp; 🤚 Pets {info.pets}×</div>
      <button className={`follow-btn ${info.following ? 'on' : ''}`} onClick={onFollow}>{info.following ? '📷 Following…' : '📷 Follow this dino'}</button>
    </aside>
  );
}
