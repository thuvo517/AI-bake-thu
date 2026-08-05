import { describe, it, expect } from 'vitest';
import { ChatSession } from './ChatSession.js';

// validatePreferences doesn't touch `this`, so we can call it directly
// off the prototype without constructing a real Durable Object instance.
const validatePreferences = (prefs) => ChatSession.prototype.validatePreferences(prefs);

describe('ChatSession.validatePreferences', () => {
  it('defaults skillLevel and units when missing or invalid', () => {
    const result = validatePreferences({});
    expect(result.skillLevel).toBe('intermediate');
    expect(result.units).toBe('us');
  });

  it('keeps valid skillLevel and units', () => {
    const result = validatePreferences({ skillLevel: 'advanced', units: 'metric' });
    expect(result.skillLevel).toBe('advanced');
    expect(result.units).toBe('metric');
  });

  it('rejects invalid skillLevel and units', () => {
    const result = validatePreferences({ skillLevel: 'wizard', units: 'furlongs' });
    expect(result.skillLevel).toBe('intermediate');
    expect(result.units).toBe('us');
  });

  it('filters dietary tags to the known allow-list', () => {
    const result = validatePreferences({ dietary: ['vegan', 'gluten-free', 'made-up-diet'] });
    expect(result.dietary).toEqual(['vegan', 'gluten-free']);
  });

  it('ignores non-array dietary and equipment values', () => {
    const result = validatePreferences({ dietary: 'vegan', equipment: 'stand mixer' });
    expect(result.dietary).toEqual([]);
    expect(result.equipment).toEqual([]);
  });

  it('caps equipment list at 20 items', () => {
    const equipment = Array.from({ length: 25 }, (_, i) => `item${i}`);
    const result = validatePreferences({ equipment });
    expect(result.equipment).toHaveLength(20);
  });
});
