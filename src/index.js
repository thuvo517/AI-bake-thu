// AI Baking Assistant - Main Worker Entry Point

import { AIService } from './services/ai.js';
import { ChatSession } from './durable-objects/ChatSession.js';

// Export Durable Object class
export { ChatSession };

// CORS headers helper
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Session-ID',
  'Access-Control-Max-Age': '86400',
};

// Helper to create JSON response
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

const MAX_MESSAGE_LENGTH = 4000;

// Helper to get or create session ID
function getSessionId(request) {
  const url = new URL(request.url);

  // Check header first, then query param
  let sessionId = request.headers.get('X-Session-ID') || url.searchParams.get('sessionId');

  // Generate new session ID if none provided
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }

  return sessionId;
}

// Get Durable Object stub for a session
function getSessionStub(env, sessionId) {
  const id = env.CHAT_SESSION.idFromName(sessionId);
  return env.CHAT_SESSION.get(id);
}

// Main fetch handler
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route handling
    try {
      // API routes
      if (url.pathname.startsWith('/api/')) {
        return await handleApiRoute(request, env, url);
      }

      // Health check
      if (url.pathname === '/health') {
        return jsonResponse({
          status: 'healthy',
          timestamp: Date.now(),
          version: '1.0.0'
        });
      }

      // Default: return 404 for unknown routes
      return jsonResponse({ error: 'Not Found' }, 404);

    } catch (error) {
      console.error('Worker Error:', error);

      // Malformed/missing JSON request body
      if (error instanceof SyntaxError) {
        return jsonResponse({ error: 'Invalid JSON in request body' }, 400);
      }

      return jsonResponse({
        error: 'Internal Server Error'
      }, 500);
    }
  }
};

// API Route Handler
async function handleApiRoute(request, env, url) {
  const method = request.method;
  const path = url.pathname.replace('/api', '');
  const sessionId = getSessionId(request);
  const sessionStub = getSessionStub(env, sessionId);

  // ===== CHAT ENDPOINT =====
  if (path === '/chat' && method === 'POST') {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return jsonResponse({ error: 'Message is required' }, 400);
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` }, 400);
    }

    // Get current session state
    const stateResponse = await sessionStub.fetch(new Request('http://internal/state'));
    const sessionState = await stateResponse.json();

    // Add user message to history
    await sessionStub.fetch(new Request('http://internal/message', {
      method: 'POST',
      body: JSON.stringify({ role: 'user', content: message })
    }));

    // Generate AI response
    const aiService = new AIService(env.AI);
    const aiResponse = await aiService.generateResponse(message, sessionState);

    // Handle recipe response - save to session
    if (aiResponse.type === 'recipe' && aiResponse.recipe) {
      await sessionStub.fetch(new Request('http://internal/recipe', {
        method: 'POST',
        body: JSON.stringify(aiResponse.recipe)
      }));
    }

    // Save assistant response to history
    await sessionStub.fetch(new Request('http://internal/message', {
      method: 'POST',
      body: JSON.stringify({
        role: 'assistant',
        content: aiResponse.message,
        metadata: {
          type: aiResponse.type,
          hasRecipe: aiResponse.type === 'recipe'
        }
      })
    }));

    return jsonResponse({
      sessionId,
      response: aiResponse,
      timestamp: Date.now()
    });
  }

  // ===== SESSION STATE =====
  if (path === '/session' && method === 'GET') {
    const response = await sessionStub.fetch(new Request('http://internal/state'));
    const state = await response.json();
    return jsonResponse({ sessionId, ...state });
  }

  // ===== CLEAR SESSION =====
  if (path === '/session' && method === 'DELETE') {
    const response = await sessionStub.fetch(new Request('http://internal/clear', {
      method: 'POST'
    }));
    const result = await response.json();
    return jsonResponse({ sessionId, ...result });
  }

  // ===== PREFERENCES =====
  if (path === '/preferences') {
    if (method === 'GET') {
      const response = await sessionStub.fetch(new Request('http://internal/preferences'));
      const prefs = await response.json();
      return jsonResponse({ sessionId, preferences: prefs });
    }

    if (method === 'POST' || method === 'PUT') {
      const body = await request.json();
      const response = await sessionStub.fetch(new Request('http://internal/preferences', {
        method: 'POST',
        body: JSON.stringify(body)
      }));
      const prefs = await response.json();
      return jsonResponse({ sessionId, preferences: prefs });
    }
  }

  // ===== ACTIVE RECIPE =====
  if (path === '/recipe') {
    if (method === 'GET') {
      const response = await sessionStub.fetch(new Request('http://internal/state'));
      const state = await response.json();
      return jsonResponse({
        sessionId,
        recipe: state.activeRecipe,
        currentStep: state.currentStep
      });
    }

    if (method === 'DELETE') {
      const response = await sessionStub.fetch(new Request('http://internal/recipe', {
        method: 'DELETE'
      }));
      const result = await response.json();
      return jsonResponse({ sessionId, ...result });
    }
  }

  // ===== STEP NAVIGATION =====
  if (path === '/step' && method === 'POST') {
    const body = await request.json();
    const { action, step } = body;

    if (!['next', 'prev', 'set'].includes(action)) {
      return jsonResponse({ error: 'Invalid action. Use: next, prev, or set' }, 400);
    }

    const response = await sessionStub.fetch(new Request('http://internal/step', {
      method: 'POST',
      body: JSON.stringify({ action, step })
    }));
    const result = await response.json();
    return jsonResponse({ sessionId, ...result });
  }

  // ===== COMPLETE RECIPE =====
  if (path === '/complete' && method === 'POST') {
    const response = await sessionStub.fetch(new Request('http://internal/complete', {
      method: 'POST'
    }));
    const result = await response.json();
    return jsonResponse({ sessionId, ...result });
  }

  // ===== STEP HELP (with AI) =====
  if (path === '/help' && method === 'POST') {
    const body = await request.json();
    const { question } = body;

    if (question && typeof question === 'string' && question.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse({ error: `Question too long (max ${MAX_MESSAGE_LENGTH} characters)` }, 400);
    }

    // Get session state
    const stateResponse = await sessionStub.fetch(new Request('http://internal/state'));
    const sessionState = await stateResponse.json();

    if (!sessionState.activeRecipe) {
      return jsonResponse({
        error: 'No active recipe. Start a recipe first!'
      }, 400);
    }

    const currentStepData = sessionState.activeRecipe.steps?.[sessionState.currentStep - 1];

    // Build context-aware prompt
    const helpMessage = question || `Help me with step ${sessionState.currentStep}`;

    const aiService = new AIService(env.AI);
    const aiResponse = await aiService.generateResponse(helpMessage, sessionState);

    return jsonResponse({
      sessionId,
      currentStep: sessionState.currentStep,
      stepInstruction: currentStepData,
      help: aiResponse
    });
  }

  // Route not found
  return jsonResponse({ error: 'Endpoint not found' }, 404);
}
