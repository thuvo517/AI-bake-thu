// ChatSession Durable Object - Persistent State Management

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // clear session after 24h of inactivity

// Pure helper so it's testable without spinning up a real Durable Object
export function isSessionExpired(lastActivity, now = Date.now(), ttlMs = SESSION_TTL_MS) {
  return now - lastActivity >= ttlMs;
}

export class ChatSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    
    // Initialize state on first access
    this.state.blockConcurrencyWhile(async () => {
      // Load stored data or initialize defaults
      const stored = await this.state.storage.get([
        'history',
        'preferences', 
        'activeRecipe',
        'currentStep',
        'completedRecipes',
        'createdAt',
        'lastActivity'
      ]);
      
      this.history = stored.get('history') || [];
      this.preferences = stored.get('preferences') || {};
      this.activeRecipe = stored.get('activeRecipe') || null;
      this.currentStep = stored.get('currentStep') || 0;
      this.completedRecipes = stored.get('completedRecipes') || [];
      this.createdAt = stored.get('createdAt') || Date.now();
      this.lastActivity = stored.get('lastActivity') || Date.now();
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let result;

      switch (url.pathname) {
        case '/state':
          result = await this.getState();
          break;
        case '/message':
          if (method !== 'POST') throw new Error('Method not allowed');
          result = await this.addMessage(await request.json());
          break;
        case '/preferences':
          if (method === 'GET') {
            result = await this.getPreferences();
          } else if (method === 'POST' || method === 'PUT') {
            result = await this.setPreferences(await request.json());
          }
          break;
        case '/recipe':
          if (method === 'POST') {
            result = await this.setActiveRecipe(await request.json());
          } else if (method === 'DELETE') {
            result = await this.clearActiveRecipe();
          }
          break;
        case '/step':
          if (method === 'POST') {
            const body = await request.json();
            if (body.action === 'next') {
              result = await this.advanceStep();
            } else if (body.action === 'prev') {
              result = await this.goBackStep();
            } else if (body.action === 'set') {
              result = await this.setStep(body.step);
            }
          }
          break;
        case '/complete':
          if (method === 'POST') {
            result = await this.completeRecipe();
          }
          break;
        case '/clear':
          if (method === 'POST') {
            result = await this.clearSession();
          }
          break;
        default:
          return new Response('Not Found', { 
            status: 404,
            headers: corsHeaders 
          });
      }

      // Some routes only handle specific methods/actions (e.g. GET on
      // /preferences, POST with a known action on /step) and fall through
      // without setting `result` otherwise. Catch that here instead of
      // silently returning an empty/invalid body.
      if (result === undefined) {
        return new Response(JSON.stringify({ error: 'Method not allowed for this endpoint' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Update last activity timestamp and push the expiry alarm out
      this.lastActivity = Date.now();
      await this.state.storage.put('lastActivity', this.lastActivity);
      await this.state.storage.setAlarm(this.lastActivity + SESSION_TTL_MS);

      return new Response(JSON.stringify(result), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }

  // ===== STATE MANAGEMENT =====

  async getState() {
    return {
      history: this.history,
      preferences: this.preferences,
      activeRecipe: this.activeRecipe,
      currentStep: this.currentStep,
      completedRecipes: this.completedRecipes,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
      messageCount: this.history.length
    };
  }

  // ===== CONVERSATION HISTORY =====

  async addMessage({ role, content, metadata = {} }) {
    const message = {
      id: crypto.randomUUID(),
      role, // 'user' or 'assistant'
      content,
      timestamp: Date.now(),
      metadata
    };

    this.history.push(message);
    
    // Keep history manageable (last 100 messages)
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }

    await this.state.storage.put('history', this.history);
    return message;
  }

  async getHistory(limit = 50) {
    return this.history.slice(-limit);
  }

  async clearHistory() {
    this.history = [];
    await this.state.storage.put('history', this.history);
    return { cleared: true };
  }

  // ===== USER PREFERENCES =====

  async getPreferences() {
    return this.preferences;
  }

  async setPreferences(prefs) {
    // Merge with existing preferences
    this.preferences = {
      ...this.preferences,
      ...prefs,
      updatedAt: Date.now()
    };

    // Validate and sanitize
    this.preferences = this.validatePreferences(this.preferences);
    
    await this.state.storage.put('preferences', this.preferences);
    return this.preferences;
  }

  validatePreferences(prefs) {
    const validSkillLevels = ['beginner', 'intermediate', 'advanced'];
    const validUnits = ['metric', 'us', 'uk'];
    const validDietary = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'kosher', 'halal'];

    return {
      skillLevel: validSkillLevels.includes(prefs.skillLevel) 
        ? prefs.skillLevel 
        : 'intermediate',
      units: validUnits.includes(prefs.units) 
        ? prefs.units 
        : 'us',
      dietary: Array.isArray(prefs.dietary)
        ? prefs.dietary.filter(d => validDietary.includes(d))
        : [],
      equipment: Array.isArray(prefs.equipment) 
        ? prefs.equipment.slice(0, 20) // Max 20 items
        : [],
      updatedAt: prefs.updatedAt || Date.now()
    };
  }

  // ===== RECIPE STATE =====

  async setActiveRecipe(recipe) {
    this.activeRecipe = {
      ...recipe,
      startedAt: Date.now(),
      id: recipe.id || crypto.randomUUID()
    };
    this.currentStep = 1;
    
    await this.state.storage.put('activeRecipe', this.activeRecipe);
    await this.state.storage.put('currentStep', this.currentStep);
    
    return { 
      activeRecipe: this.activeRecipe, 
      currentStep: this.currentStep 
    };
  }

  async getActiveRecipe() {
    return {
      recipe: this.activeRecipe,
      currentStep: this.currentStep
    };
  }

  async clearActiveRecipe() {
    this.activeRecipe = null;
    this.currentStep = 0;
    
    await this.state.storage.put('activeRecipe', null);
    await this.state.storage.put('currentStep', 0);
    
    return { cleared: true };
  }

  // ===== STEP PROGRESSION =====

  async advanceStep() {
    if (!this.activeRecipe) {
      return { error: 'No active recipe', currentStep: 0 };
    }

    const totalSteps = this.activeRecipe.steps?.length || 0;
    
    if (this.currentStep < totalSteps) {
      this.currentStep++;
      await this.state.storage.put('currentStep', this.currentStep);
    }

    const isComplete = this.currentStep >= totalSteps;
    
    return {
      currentStep: this.currentStep,
      totalSteps,
      isComplete,
      currentInstruction: this.activeRecipe.steps?.[this.currentStep - 1] || null
    };
  }

  async goBackStep() {
    if (!this.activeRecipe) {
      return { error: 'No active recipe', currentStep: 0 };
    }

    if (this.currentStep > 1) {
      this.currentStep--;
      await this.state.storage.put('currentStep', this.currentStep);
    }

    return {
      currentStep: this.currentStep,
      totalSteps: this.activeRecipe.steps?.length || 0,
      currentInstruction: this.activeRecipe.steps?.[this.currentStep - 1] || null
    };
  }

  async setStep(stepNumber) {
    if (!this.activeRecipe) {
      return { error: 'No active recipe', currentStep: 0 };
    }

    if (!Number.isInteger(stepNumber)) {
      return {
        error: 'step must be an integer',
        currentStep: this.currentStep,
        totalSteps: this.activeRecipe.steps?.length || 0
      };
    }

    const totalSteps = this.activeRecipe.steps?.length || 0;
    const newStep = Math.max(1, Math.min(stepNumber, totalSteps));
    
    this.currentStep = newStep;
    await this.state.storage.put('currentStep', this.currentStep);

    return {
      currentStep: this.currentStep,
      totalSteps,
      currentInstruction: this.activeRecipe.steps?.[this.currentStep - 1] || null
    };
  }

  // ===== RECIPE COMPLETION =====

  async completeRecipe() {
    if (!this.activeRecipe) {
      return { error: 'No active recipe' };
    }

    const completedRecipe = {
      ...this.activeRecipe,
      completedAt: Date.now()
    };

    this.completedRecipes.push(completedRecipe);
    
    // Keep last 20 completed recipes
    if (this.completedRecipes.length > 20) {
      this.completedRecipes = this.completedRecipes.slice(-20);
    }

    await this.state.storage.put('completedRecipes', this.completedRecipes);
    
    // Clear active recipe
    await this.clearActiveRecipe();

    return {
      completed: true,
      recipe: completedRecipe,
      totalCompleted: this.completedRecipes.length
    };
  }

  // ===== SESSION MANAGEMENT =====

  async clearSession() {
    this.history = [];
    this.preferences = {};
    this.activeRecipe = null;
    this.currentStep = 0;
    this.completedRecipes = [];

    await this.state.storage.deleteAll();
    
    // Reinitialize timestamps
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    await this.state.storage.put('createdAt', this.createdAt);
    await this.state.storage.put('lastActivity', this.lastActivity);

    return { cleared: true, newSessionStarted: this.createdAt };
  }

  // Fired by storage.setAlarm() once the session has been idle for SESSION_TTL_MS.
  // If activity slipped in after the alarm was scheduled, just push it back out.
  async alarm() {
    if (isSessionExpired(this.lastActivity)) {
      await this.clearSession();
    } else {
      await this.state.storage.setAlarm(this.lastActivity + SESSION_TTL_MS);
    }
  }
}

export default ChatSession;
