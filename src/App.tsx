import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Park } from './components/Park';
import { InfoCard } from './components/InfoCard';
import { FieldGuide } from './components/FieldGuide';
import { Portrait } from './components/Portrait';
import type { Callbacks, DinoInfo, Engine, Stats, ViewItem } from './game/engine';
import { ERAS, SPECIES, SPECIES_BY_ID } from './game/species';
import { audio } from './game/audio';
import { SEASONS } from './game/weather';
import type { Era, Species, Tool } from './game/types';

const TOOLS: { id: Tool; icon: string; label: string; key: string; hint: string }[] = [
  { id: 'look', icon: '🔍', label: 'Explore', key: '1', hint: 'Tap a dinosaur for info. Drag to look around.' },
  { id: 'pet', icon: '🤚', label: 'Pet', key: '2', hint: 'Press and hold on a dinosaur to pet it.' },
  { id: 'grass', icon: '🌿', label: 'Grass', key: '3', hint: 'Tap the ground to drop grass for plant eaters.' },
  { id: 'meat', icon: '🍖', label: 'Meat', key: '4', hint: 'Tap the ground to drop meat for hunters.' },
];
const ERA_ORDER: Era[] = ['triassic', 'jurassic', 'cretaceous'];

export default function App() {
  const engineRef = useRef<Engine | null>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('look');
  const [labels, setLabels] = useState(false);
  const [muted, setMuted] = useState(audio.isMuted);
  const [volume, setVolume] = useState(audio.vol);
  const [music, setMusic] = useState(audio.musicOn);
  const [soundOpen, setSoundOpen] = useState(false);
  const [info, setInfo] = useState<DinoInfo | null>(null);
  const [view, setView] = useState<ViewItem[]>([]);
  const [stats, setStats] = useState<Stats>({ fed: 0, pets: 0, discovered: 0, total: SPECIES.length });
  const [zone, setZone] = useState<{ era: Era; name: string }>({ era: 'triassic', name: 'Fern Valley' });
  const [toast, setToast] = useState<string | null>(null);
  const [season, setSeason] = useState(0);
  const [seasonAuto, setSeasonAuto] = useState(true);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [tod, setTod] = useState<'day' | 'night' | 'auto'>('auto');
  const [todOpen, setTodOpen] = useState(false);
  const [found, setFound] = useState<Species | null>(null);
  const [guide, setGuide] = useState(false);
  const [discovered, setDiscovered] = useState<Set<string>>(new Set());
  const [showHelp, setShowHelp] = useState(true);
  const toastT = useRef(0);
  const foundT = useRef(0);

  const flash = useCallback((m: string) => {
    setToast(m);
    window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  const callbacks = useMemo<Callbacks>(() => ({
    onSelect: setInfo,
    onView: setView,
    onStats: setStats,
    onZone: (era, name) => setZone({ era, name }),
    onToast: flash,
    onSeason: (_l, i) => setSeason(i),
    onDiscover: (sp) => {
      setDiscovered((s) => new Set(s).add(sp.id));
      setFound(sp);
      window.clearTimeout(foundT.current);
      foundT.current = window.setTimeout(() => setFound(null), 4200);
    },
  }), [flash]);

  const pickTool = useCallback((t: Tool) => {
    setTool(t);
    engineRef.current?.setTool(t);
    setShowHelp(false);
  }, []);

  useEffect(() => {
    engineRef.current?.setLabels(labels);
  }, [labels]);

  useEffect(() => {
    const wake = () => audio.resume();
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    return () => { window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = TOOLS.find((x) => x.key === e.key);
      if (t) pickTool(t.id);
      if (e.key === 'n' || e.key === 'N') setTod((v) => { const nx = v === 'day' ? 'night' : v === 'night' ? 'auto' : 'day'; engineRef.current?.setTimeMode(nx); return nx; });
      if (e.key === 's' || e.key === 'S') engineRef.current?.nextSeason();
      if (e.key === 'q' || e.key === 'Q') engineRef.current?.triggerQuake();
      if (e.key === 'm' || e.key === 'M') { const m = !audio.isMuted; audio.setMuted(m); setMuted(m); }
      if (e.key === 'l' || e.key === 'L') setLabels((v) => !v);
      if (e.key === 'g' || e.key === 'G') setGuide((v) => !v);
      if (e.key === 'Escape') { setGuide(false); engineRef.current?.deselect(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickTool]);

  const onMiniDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const move = (ev: PointerEvent | React.PointerEvent) => {
      const r = miniRef.current!.getBoundingClientRect();
      engineRef.current?.minimapClick((ev.clientX - r.left) / r.width);
    };
    move(e);
    const mv = (ev: PointerEvent) => move(ev);
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };

  const activeTool = TOOLS.find((t) => t.id === tool)!;

  return (
    <div className="app">
      <Park
        callbacks={callbacks}
        onEngine={(e) => {
          engineRef.current = e;
          e.setMinimap(miniRef.current);
        }}
      />

      {/* ----- top bar ----- */}
      <header className="topbar">
        <div className="title-wrap">
          <h1 className="poster-title">AGE OF DINOSAURS</h1>
          <nav className="era-tabs">
            {ERA_ORDER.map((era) => (
              <button
                key={era}
                className={`era-tab ${zone.era === era ? 'active' : ''}`}
                style={{ ['--c' as string]: ERAS[era].color, ['--ink' as string]: ERAS[era].ink }}
                onClick={() => engineRef.current?.jumpZone(era)}
              >
                <span className="lbl">{ERAS[era].short}</span><span className="ico">{ERAS[era].short[0]}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="top-actions">
          <div className="zone-pill">📍 {zone.name}</div>
          <button className="pill-btn" onClick={() => setGuide(true)} title="Field Guide (G)"><span className="ico">📖</span><span className="lbl"> Field Guide</span> <b>{stats.discovered}/{stats.total}</b></button>
          <button className={`pill-btn ${labels ? 'on' : ''}`} onClick={() => setLabels((v) => !v)} title="Show every name (otherwise names appear on hover)"><span className="ico">🏷</span><span className="lbl"> Names: {labels ? 'always' : 'on hover'}</span></button>
          <div className="sound-wrap">
            <button className="pill-btn" onClick={() => { setTodOpen((v) => !v); setSeasonOpen(false); setSoundOpen(false); }} title="Time of day (N)"><span className="ico">{tod === 'night' ? '🌙' : tod === 'day' ? '☀️' : '🌗'}</span><span className="lbl"> {tod === 'night' ? 'Night' : tod === 'day' ? 'Day' : 'Day & night'}</span></button>
            {todOpen && (
              <div className="sound-pop">
                {([['day', '☀️ Day'], ['night', '🌙 Full moon night'], ['auto', '🌗 Day & night cycle']] as const).map(([m, label]) => (
                  <button key={m} className={`season-opt ${tod === m ? 'on' : ''}`} onClick={() => { engineRef.current?.setTimeMode(m); setTod(m); }}>{label}</button>
                ))}
              </div>
            )}
          </div>
          <div className="sound-wrap">
            <button className="pill-btn" onClick={() => { setSeasonOpen((v) => !v); setSoundOpen(false); setTodOpen(false); }} title="Season"><span className="ico">{SEASONS[season].icon}</span><span className="lbl"> {SEASONS[season].name}</span></button>
            {seasonOpen && (
              <div className="sound-pop">
                {SEASONS.map((s, i) => (
                  <button key={s.id} className={`season-opt ${season === i ? 'on' : ''}`} onClick={() => { engineRef.current?.setSeason(i); setSeason(i); }}>
                    {s.icon} {s.name}
                  </button>
                ))}
                <label className="row">
                  <input type="checkbox" checked={seasonAuto} onChange={(e) => { engineRef.current?.setAutoSeason(e.target.checked); setSeasonAuto(e.target.checked); }} /> Change automatically
                </label>
              </div>
            )}
          </div>
          <div className="sound-wrap">
            <button className={`pill-btn ${muted ? '' : 'on'}`} onClick={() => { audio.resume(); setSoundOpen((v) => !v); setSeasonOpen(false); setTodOpen(false); }} title="Sound (M to mute)"><span className="ico">{muted ? '🔇' : '🔊'}</span><span className="lbl"> Sound</span></button>
            {soundOpen && (
              <div className="sound-pop">
                <label className="row">
                  <input type="checkbox" checked={!muted} onChange={(e) => { audio.resume(); audio.setMuted(!e.target.checked); setMuted(!e.target.checked); }} /> Sound on
                </label>
                <label className="row">
                  <input type="checkbox" checked={music} onChange={(e) => { audio.setMusic(e.target.checked); setMusic(e.target.checked); }} /> Music
                </label>
                <label className="row vol">
                  Volume
                  <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => { const v = Number(e.target.value); audio.setVolume(v); setVolume(v); }} />
                </label>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ----- spotted tray ----- */}
      <aside className="tray">
        <div className="tray-title">In view</div>
        <div className="tray-list">
          {view.map((v) => {
            const sp = SPECIES_BY_ID[v.id];
            return (
              <button key={v.id} className="tray-item" style={{ ['--c' as string]: ERAS[sp.era].color }} onClick={() => engineRef.current?.selectSpecies(v.id)}>
                <Portrait sp={sp} w={64} h={38} />
                <span>{sp.name}{v.count > 1 ? <em> ×{v.count}</em> : null}</span>
              </button>
            );
          })}
          {view.length === 0 && <div className="tray-empty">Pan around to find dinosaurs</div>}
        </div>
      </aside>

      {/* ----- info ----- */}
      {info && <InfoCard info={info} onClose={() => engineRef.current?.deselect()} onFollow={() => engineRef.current?.toggleFollow()} />}

      {/* ----- discovery ----- */}
      {found && (
        <div className="found" key={found.id} style={{ ['--c' as string]: ERAS[found.era].color }}>
          <Portrait sp={found} w={92} h={56} />
          <div>
            <small>New discovery!</small>
            <b>{found.name}</b>
            <span>{found.meaning} · {found.diet}</span>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {/* ----- bottom dock ----- */}
      <footer className="dock-wrap">
        {showHelp && (
          <div className="help">Drag the park to explore · pick a tool below · <b>←/→</b> to walk · <b>G</b> field guide · <b>M</b> mute (sound starts on your first click)</div>
        )}
        <div className="dock-hint">{activeTool.hint}</div>
        <div className="dock">
          {TOOLS.map((t) => (
            <button key={t.id} className={`tool ${tool === t.id ? 'active' : ''} t-${t.id}`} onClick={() => pickTool(t.id)}>
              <span className="tool-icon">{t.icon}</span>
              <span className="tool-label">{t.label}</span>
              <kbd>{t.key}</kbd>
            </button>
          ))}
        </div>
        <div className="counters">🍽 {stats.fed} fed · 🤚 {stats.pets} pets</div>
      </footer>

      {/* ----- minimap ----- */}
      <div className="minimap">
        <canvas ref={miniRef} width={360} height={46} onPointerDown={onMiniDown} />
      </div>

      {guide && (
        <FieldGuide
          discovered={discovered}
          onClose={() => setGuide(false)}
          onPick={(id) => { setGuide(false); engineRef.current?.selectSpecies(id); }}
        />
      )}
    </div>
  );
}
