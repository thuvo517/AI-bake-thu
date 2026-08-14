import { describe, it, expect } from 'vitest';
import { ChatSession, isSessionExpired } from './ChatSession.js';

// validatePreferences doesn't touch `this`, so we can call it directly
// off the prototype without constructing a real Durable Object instance.
const validatePreferences = (prefs) => ChatSession.prototype.validatePreferences(prefs);

// The step-navigation methods only touch `this.activeRecipe`, `this.currentStep`,
// and `this.state.storage.put`. Rather than construct a real Durable Object
// (which needs a platform-provided state/storage implementation), build a
// minimal fake with an in-memory storage.put so the methods run unmodified.
function makeSession({ activeRecipe = null, currentStep = 0 } = {}) {
  const stored = {};
  const session = Object.create(ChatSession.prototype);
  session.activeRecipe = activeRecipe;
  session.currentStep = currentStep;
  session.state = { storage: { put: async (key, value) => { stored[key] = value; } } };
  session._stored = stored;
  return session;
}

const RECIPE_3_STEPS = {
  title: 'Cookies',
  steps: [{ step: 1, instruction: 'Mix' }, { step: 2, instruction: 'Shape' }, { step: 3, instruction: 'Bake' }]
};

// Minimal in-memory stand-in for the platform-provided Durable Object state,
// sufficient to exercise the real constructor + fetch() routing.
function makeFakeState() {
  const store = new Map();
  const fakeState = {
    blockConcurrencyWhile: (fn) => {
      fakeState._ready = fn();
      return fakeState._ready;
    },
    storage: {
      get: async (keys) => {
        const result = new Map();
        for (const key of keys) result.set(key, store.get(key));
        return result;
      },
      put: async (key, value) => { store.set(key, value); },
      setAlarm: async () => {},
      deleteAll: async () => { store.clear(); }
    }
  };
  return fakeState;
}

// The real platform queues incoming requests until blockConcurrencyWhile's
// promise resolves; our fake doesn't, so tests await it explicitly.
async function makeReadySession(env = {}) {
  const state = makeFakeState();
  const session = new ChatSession(state, env);
  await state._ready;
  return session;
}

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

describe('isSessionExpired', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it('is not expired right after activity', () => {
    const now = Date.now();
    expect(isSessionExpired(now, now)).toBe(false);
  });

  it('is not expired just under the TTL', () => {
    const now = Date.now();
    expect(isSessionExpired(now - (DAY - 1000), now)).toBe(false);
  });

  it('is expired once the TTL has fully elapsed', () => {
    const now = Date.now();
    expect(isSessionExpired(now - DAY, now)).toBe(true);
  });

  it('respects a custom ttl', () => {
    const now = Date.now();
    expect(isSessionExpired(now - 5000, now, 1000)).toBe(true);
    expect(isSessionExpired(now - 500, now, 1000)).toBe(false);
  });
});

describe('ChatSession.advanceStep', () => {
  it('returns an error when there is no active recipe', async () => {
    const session = makeSession({ activeRecipe: null, currentStep: 0 });
    const result = await session.advanceStep();
    expect(result).toEqual({ error: 'No active recipe', currentStep: 0 });
  });

  it('increments currentStep and reports isComplete once the last step is reached', async () => {
    const session = makeSession({ activeRecipe: RECIPE_3_STEPS, currentStep: 1 });

    const step2 = await session.advanceStep();
    expect(step2).toMatchObject({ currentStep: 2, totalSteps: 3, isComplete: false });

    const step3 = await session.advanceStep();
    expect(step3).toMatchObject({ currentStep: 3, totalSteps: 3, isComplete: true });
  });

  it('does not advance past the last step', async () => {
    const session = makeSession({ activeRecipe: RECIPE_3_STEPS, currentStep: 3 });
    const result = await session.advanceStep();
    expect(result.currentStep).toBe(3);
    expect(result.isComplete).toBe(true);
  });
});

describe('ChatSession.goBackStep', () => {
  it('returns an error when there is no active recipe', async () => {
    const session = makeSession({ activeRecipe: null, currentStep: 0 });
    const result = await session.goBackStep();
    expect(result).toEqual({ error: 'No active recipe', currentStep: 0 });
  });

  it('decrements currentStep', async () => {
    const session = makeSession({ activeRecipe: RECIPE_3_STEPS, currentStep: 2 });
    const result = await session.goBackStep();
    expect(result.currentStep).toBe(1);
  });

  it('does not go below step 1', async () => {
    const session = makeSession({ activeRecipe: RECIPE_3_STEPS, currentStep: 1 });
    const result = await session.goBackStep();
    expect(result.currentStep).toBe(1);
  });
});

describe('ChatSession.setStep', () => {
  it('returns an error when there is no active recipe', async () => {
    const session = makeSession({ activeRecipe: null, currentStep: 0 });
    const result = await session.setStep(2);
    expect(result).toEqual({ error: 'No active recipe', currentStep: 0 });
  });

  it('jumps directly to the requested step', async () => {
    const session = makeSession({ activeRecipe: RECIPE_3_STEPS, currentStep: 1 });
    const result = await session.setStep(3);
    expect(result.currentStep).toBe(3);
  });

  it('clamps out-of-range step numbers into [1, totalSteps]', async () => {
    const session = makeSession({ activeRecipe: RECIPE_3_STEPS, currentStep: 1 });
    expect((await session.setStep(99)).currentStep).toBe(3);
    expect((await session.setStep(-5)).currentStep).toBe(1);
  });

  it('rejects non-integer step values instead of storing NaN', async () => {
    const session = makeSession({ activeRecipe: RECIPE_3_STEPS, currentStep: 2 });
    const result = await session.setStep(undefined);
    expect(result.error).toBe('step must be an integer');
    // currentStep must be untouched, not NaN
    expect(result.currentStep).toBe(2);
    expect(Number.isNaN(session.currentStep)).toBe(false);
  });
});

describe('ChatSession.fetch routing', () => {
  it('returns a working response for a recognized path/method', async () => {
    const session = await makeReadySession();
    const res = await session.fetch(new Request('http://internal/state'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ history: [], currentStep: 0 });
  });

  it('returns 404 for an unknown path', async () => {
    const session = await makeReadySession();
    const res = await session.fetch(new Request('http://internal/nope'));
    expect(res.status).toBe(404);
  });

  it('returns 405 with a valid JSON body for a known path with an unhandled method', async () => {
    // /recipe only handles POST and DELETE; GET falls through with no result set.
    const session = await makeReadySession();
    const res = await session.fetch(new Request('http://internal/recipe', { method: 'GET' }));
    expect(res.status).toBe(405);
    // Must be valid, parseable JSON rather than an empty/"undefined" body.
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('returns 405 for /preferences with an unhandled method', async () => {
    const session = await makeReadySession();
    const res = await session.fetch(new Request('http://internal/preferences', { method: 'DELETE' }));
    expect(res.status).toBe(405);
    await expect(res.json()).resolves.toMatchObject({ error: expect.any(String) });
  });
});
