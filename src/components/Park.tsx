import { useEffect, useRef } from 'react';
import { Engine, Callbacks } from '../game/engine';

interface Props {
  callbacks: Callbacks;
  onEngine: (e: Engine) => void;
}

export function Park({ callbacks, onEngine }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    const canvas = ref.current!;
    const engine = new Engine(canvas, {
      onSelect: (i) => cbRef.current.onSelect(i),
      onView: (v) => cbRef.current.onView(v),
      onDiscover: (s) => cbRef.current.onDiscover(s),
      onStats: (s) => cbRef.current.onStats(s),
      onZone: (e, n) => cbRef.current.onZone(e, n),
      onToast: (m) => cbRef.current.onToast(m),
      onSeason: (l, i) => cbRef.current.onSeason?.(l, i),
    });
    onEngine(engine);
    engine.start();

    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(canvas);

    const key = (down: boolean) => (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') engine.setKey('left', down);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') engine.setKey('right', down);
    };
    const kd = key(true), ku = key(false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      ro.disconnect();
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      engine.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} className="park-canvas" />;
}
