import { describe, expect, it } from 'vitest';
import { materialCustomerDescription } from '../components/QuoteMaterialLineFields';

describe('quote material customer description', () => {
  it('keeps customer-facing material text to material, thickness, and finish', () => {
    expect(materialCustomerDescription(
      { brand: 'Vicostone', name: 'Alpine' },
      { thickness: '3cm', finish: 'Polished' },
    )).toBe('Vicostone · Alpine · 3cm · Polished');
  });

  it('does not expose slab format or dimensions because they are not customer description inputs', () => {
    const material = { brand: 'Vicostone', name: 'Colorado Ridge' };
    const safe = materialCustomerDescription(material, { thickness: '3cm', finish: 'Polished' });
    expect(safe).not.toContain('Jumbo');
    expect(safe).not.toContain('130');
    expect(safe).toBe('Vicostone · Colorado Ridge · 3cm · Polished');
  });
});
