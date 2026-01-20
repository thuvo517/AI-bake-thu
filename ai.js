// Workers AI Service - Llama 3.3 Integration

import { buildPromptWithContext } from '../utils/prompts.js';

export class AIService {
  constructor(aiBinding) {
    this.ai = aiBinding;
    // Using Llama 3.3 70B Instruct model
    this.model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  }

  /**
   * Generate a response from the AI
   * @param {string} userMessage - The user's message
   * @param {Object} sessionState - Current session state (history, preferences, active recipe)
   * @returns {Promise<Object>} - Parsed AI response
   */
  async generateResponse(userMessage, sessionState = {}) {
    const systemPrompt = buildPromptWithContext(userMessage, sessionState);
    
    try {
      const response = await this.ai.run(this.model, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 2048,
        temperature: 0.7,
        top_p: 0.9,
      });

      // Parse the response
      return this.parseResponse(response.response);
    } catch (error) {
      console.error('AI Service Error:', error);
      return {
        type: 'message',
        message: "I'm having a little trouble right now. Could you try asking again? 🍪",
        error: true
      };
    }
  }

  /**
   * Parse AI response and extract structured data
   * @param {string} rawResponse - Raw text response from AI
   * @returns {Object} - Parsed response object
   */
  parseResponse(rawResponse) {
    // Try to extract JSON from the response
    try {
      // Look for JSON block in the response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.validateAndCleanResponse(parsed);
      }
    } catch (e) {
      // JSON parsing failed, treat as plain message
      console.log('JSON parse failed, treating as plain message');
    }

    // If no valid JSON, return as plain message
    return {
      type: 'message',
      message: rawResponse.trim()
    };
  }

  /**
   * Validate and clean the parsed response
   * @param {Object} parsed - Parsed JSON response
   * @returns {Object} - Validated response object
   */
  validateAndCleanResponse(parsed) {
    // Ensure type is valid
    const validTypes = ['recipe', 'message', 'step_guidance'];
    if (!validTypes.includes(parsed.type)) {
      parsed.type = 'message';
    }

    // If it's a recipe, validate the structure
    if (parsed.type === 'recipe' && parsed.recipe) {
      parsed.recipe = this.validateRecipe(parsed.recipe);
    }

    // Ensure message exists
    if (!parsed.message) {
      parsed.message = '';
    }

    return parsed;
  }

  /**
   * Validate recipe structure and fill defaults
   * @param {Object} recipe - Recipe object to validate
   * @returns {Object} - Validated recipe
   */
  validateRecipe(recipe) {
    return {
      title: recipe.title || 'Untitled Recipe',
      description: recipe.description || '',
      prepTime: recipe.prepTime || 'N/A',
      cookTime: recipe.cookTime || 'N/A',
      servings: recipe.servings || 4,
      difficulty: ['easy', 'medium', 'hard'].includes(recipe.difficulty) 
        ? recipe.difficulty 
        : 'medium',
      ingredients: Array.isArray(recipe.ingredients) 
        ? recipe.ingredients.map(ing => ({
            item: ing.item || 'Unknown ingredient',
            amount: ing.amount || '',
            unit: ing.unit || ''
          }))
        : [],
      steps: Array.isArray(recipe.steps)
        ? recipe.steps.map((step, idx) => ({
            step: step.step || idx + 1,
            instruction: step.instruction || '',
            duration: step.duration || '',
            tip: step.tip || null
          }))
        : [],
      tips: Array.isArray(recipe.tips) ? recipe.tips : []
    };
  }

  /**
   * Stream response for real-time output (if needed in future)
   */
  async *streamResponse(userMessage, sessionState = {}) {
    const systemPrompt = buildPromptWithContext(userMessage, sessionState);
    
    const stream = await this.ai.run(this.model, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 2048,
      temperature: 0.7,
      stream: true
    });

    for await (const chunk of stream) {
      yield chunk;
    }
  }
}

export default AIService;
