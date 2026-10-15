import { useEffect, useRef } from 'react';
import { drawPortrait } from '../game/draw/dino';
import type { Species } from '../game/types';

export function Portrait({ sp, w = 120, h = 80, dim = false, className }: { sp: Species; w?: number; h?: number; dim?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawPortrait(ref.current, sp, { dim });
  }, [sp, dim, w, h]);
  return <canvas ref={ref} className={className} width={w * 2} height={h * 2} style={{ width: w, height: h }} />;
}
