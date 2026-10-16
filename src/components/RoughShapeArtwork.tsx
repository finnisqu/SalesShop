import { useEffect, useRef } from 'react';
import rough from 'roughjs/bin/rough';
import type { ShapeObject } from '../types/notebook';

function seedFromId(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return (hash % 2_147_483_646) + 1;
}

export function RoughShapeArtwork({ object }: { object: ShapeObject }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.replaceChildren();

    const rc = rough.svg(svg);
    const options = {
      seed: seedFromId(object.id),
      roughness: object.style === 'pencil' ? 1.35 : 0.75,
      bowing: object.style === 'pencil' ? 1.25 : 0.6,
      stroke: 'rgba(59, 57, 51, .78)',
      strokeWidth: object.shape === 'arrow' ? 2.2 : 1.8,
      fill: undefined,
    };

    let node: SVGGElement;
    if (object.shape === 'arrow') {
      node = rc.path('M 7 24 C 30 20, 56 24, 84 19 M 72 9 L 86 19 L 74 31', options);
    } else if (object.shape === 'cloud') {
      node = rc.path('M18 45 C4 39 8 24 22 23 C20 10 38 5 47 17 C57 4 78 10 78 24 C95 23 99 41 84 47 C69 54 35 54 18 45 Z', options);
    } else if (object.shape === 'oval') {
      node = rc.ellipse(50, 30, 88, 48, options);
    } else {
      node = rc.rectangle(7, 7, 87, 48, options);
    }

    svg.appendChild(node);
  }, [object.id, object.shape, object.style]);

  return (
    <svg
      ref={ref}
      className="shape-artwork rough-shape-artwork"
      viewBox={object.shape === 'arrow' ? '0 0 100 40' : '0 0 100 60'}
      preserveAspectRatio="none"
      aria-hidden="true"
    />
  );
}
