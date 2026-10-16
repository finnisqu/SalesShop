import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MobileBoardStagePicker } from './MobileBoardStagePicker';

describe('mobile board stage picker', () => {
  it('lists stage names, live counts, and a selected stage', () => {
    const html = renderToStaticMarkup(
      <MobileBoardStagePicker
        boardRef={createRef<HTMLElement>()}
        stages={['Discovery', 'Quoted', 'Awarded']}
        counts={[3, 2, 1]}
      />,
    );
    expect(html).toContain('Board stage navigation');
    expect(html).toContain('Discovery · 3');
    expect(html).toContain('Quoted · 2');
    expect(html).toContain('Awarded · 1');
    expect(html).toContain('1 / 3');
  });

  it('handles an empty stage list without throwing', () => {
    const html = renderToStaticMarkup(
      <MobileBoardStagePicker boardRef={createRef<HTMLElement>()} stages={[]} counts={[]} />,
    );
    expect(html).toContain('Board stage navigation');
  });
});
