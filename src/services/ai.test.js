import { describe, it, expect } from 'vitest';
import { AIService } from './ai.js';

describe('AIService.validateRecipe', () => {
  const ai = new AIService(null);

  it('fills in defaults for missing fields', () => {
    const result = ai.validateRecipe({});
    expect(result.title).toBe('Untitled Recipe');
    expect(result.difficulty).toBe('medium');
    expect(result.servings).toBe(4);
    expect(result.ingredients).toEqual([]);
    expect(result.steps).toEqual([]);
  });

  it('keeps valid difficulty and drops invalid ones', () => {
    expect(ai.validateRecipe({ difficulty: 'hard' }).difficulty).toBe('hard');
    expect(ai.validateRecipe({ difficulty: 'impossible' }).difficulty).toBe('medium');
  });

  it('normalizes ingredients and steps', () => {
    const result = ai.validateRecipe({
      ingredients: [{ item: 'flour', amount: '2', unit: 'cups' }, {}],
      steps: [{ instruction: 'mix' }, { step: 5, instruction: 'bake', duration: '20 min' }]
    });

    expect(result.ingredients).toEqual([
      { item: 'flour', amount: '2', unit: 'cups' },
      { item: 'Unknown ingredient', amount: '', unit: '' }
    ]);
    expect(result.steps[0]).toMatchObject({ step: 1, instruction: 'mix' });
    expect(result.steps[1]).toMatchObject({ step: 5, instruction: 'bake', duration: '20 min' });
  });

  it('ignores non-array ingredients/steps/tips', () => {
    const result = ai.validateRecipe({ ingredients: 'flour', steps: null, tips: 'do it' });
    expect(result.ingredients).toEqual([]);
    expect(result.steps).toEqual([]);
    expect(result.tips).toEqual([]);
  });
});

describe('AIService.parseResponse', () => {
  const ai = new AIService(null);

  it('parses a plain JSON message response', () => {
    const raw = '{"type": "message", "message": "Preheat the oven to 350F"}';
    expect(ai.parseResponse(raw)).toEqual({ type: 'message', message: 'Preheat the oven to 350F' });
  });

  it('finds JSON embedded in surrounding prose', () => {
    const raw = 'Sure thing! Here you go: {"type": "message", "message": "Enjoy!"} Hope that helps.';
    expect(ai.parseResponse(raw)).toEqual({ type: 'message', message: 'Enjoy!' });
  });

  it('is not tripped up by braces inside prose before the real JSON', () => {
    const raw = 'This recipe uses {curly brace notation} sometimes. {"type": "message", "message": "ok"}';
    expect(ai.parseResponse(raw)).toEqual({ type: 'message', message: 'ok' });
  });

  it('falls back to a plain message when there is no valid JSON', () => {
    const raw = 'Just preheat your oven, no JSON here.';
    expect(ai.parseResponse(raw)).toEqual({ type: 'message', message: raw.trim() });
  });

  it('normalizes an unrecognized type to message', () => {
    const raw = '{"type": "unknown_type", "message": "hi"}';
    expect(ai.parseResponse(raw)).toEqual({ type: 'message', message: 'hi' });
  });

  it('validates nested recipe data when type is recipe', () => {
    const raw = '{"type": "recipe", "message": "here", "recipe": {"title": "Cookies"}}';
    const result = ai.parseResponse(raw);
    expect(result.type).toBe('recipe');
    expect(result.recipe.title).toBe('Cookies');
    expect(result.recipe.difficulty).toBe('medium');
  });
});
