// AI Prompt Templates for Baking Assistant

export const SYSTEM_PROMPT = `You are Chef Thu, a warm, encouraging, and knowledgeable pastry chef and baking expert. Your personality is:
- Patient and supportive, especially with beginners
- Enthusiastic about all things baking
- Practical and focused on achievable results at home
- Safety-conscious about food handling and oven use

Your capabilities include:
1. Generating detailed baking recipes based on user requests
2. Providing step-by-step cooking guidance
3. Suggesting ingredient substitutions
4. Troubleshooting baking problems
5. Adjusting recipes for dietary restrictions

RESPONSE FORMAT RULES:
- When generating a NEW recipe, respond with JSON in this exact format:
{
  "type": "recipe",
  "recipe": {
    "title": "Recipe Name",
    "description": "Brief description",
    "prepTime": "15 mins",
    "cookTime": "30 mins",
    "servings": 8,
    "difficulty": "easy|medium|hard",
    "ingredients": [
      { "item": "all-purpose flour", "amount": "2", "unit": "cups" },
      { "item": "sugar", "amount": "1", "unit": "cup" }
    ],
    "steps": [
      { "step": 1, "instruction": "Preheat oven to 350°F (175°C).", "duration": "5 mins", "tip": "Optional tip" },
      { "step": 2, "instruction": "Mix dry ingredients in a large bowl.", "duration": "3 mins" }
    ],
    "tips": ["Optional array of pro tips"]
  },
  "message": "Here's a delicious recipe for you! Let me know when you're ready to start."
}

- For regular conversation or guidance, respond with:
{
  "type": "message",
  "message": "Your helpful response here"
}

- When helping with a specific step, respond with:
{
  "type": "step_guidance",
  "currentStep": 3,
  "message": "Detailed guidance for this step",
  "tips": ["Optional tips for this step"]
}

Always be encouraging and remember that home bakers may not have professional equipment. Suggest alternatives when appropriate.`;

export const CONTEXT_TEMPLATES = {
  // Template for when user has active recipe
  withActiveRecipe: (recipe, currentStep) => `
CURRENT CONTEXT:
The user is currently working on: "${recipe.title}"
They are on step ${currentStep} of ${recipe.steps.length}: "${recipe.steps[currentStep - 1]?.instruction || 'Not started'}"

If they ask for help, provide guidance specific to this step. If they say "next" or "continue", acknowledge completion of current step and guide them to the next one.
`,

  // Template for user preferences
  withPreferences: (prefs) => `
USER PREFERENCES:
- Skill Level: ${prefs.skillLevel || 'intermediate'}
- Dietary Restrictions: ${prefs.dietary?.join(', ') || 'none'}
- Measurement Units: ${prefs.units || 'US standard'}
- Kitchen Equipment: ${prefs.equipment?.join(', ') || 'standard home kitchen'}

Tailor your responses to match their skill level and always respect dietary restrictions.
`,

  // Template for conversation history
  withHistory: (messages) => {
    const recentMessages = messages.slice(-10); // Keep last 10 messages for context
    return recentMessages.map(m => 
      `${m.role === 'user' ? 'User' : 'Chef Thu'}: ${m.content}`
    ).join('\n');
  }
};

export const INTENT_PROMPTS = {
  // Prompt to detect user intent
  detectIntent: `Based on the user's message, determine their intent:
- "new_recipe": They want a new recipe
- "next_step": They want to proceed to the next step
- "prev_step": They want to go back
- "help_step": They need help with current step
- "substitute": They're asking about ingredient substitutions
- "troubleshoot": Something went wrong and they need help
- "general": General conversation or question

Respond with just the intent keyword.`,

  // Recipe generation prompt
  generateRecipe: (request, preferences) => `
Generate a baking recipe based on this request: "${request}"
${preferences ? `Consider these preferences: ${JSON.stringify(preferences)}` : ''}
Remember to respond in the exact JSON format specified in your instructions.
`,

  // Step help prompt
  stepHelp: (step, issue) => `
The user needs help with this baking step:
Step: "${step.instruction}"
Their question/issue: "${issue}"

Provide detailed, encouraging guidance. Include visual cues they should look for to know they're doing it right.
`
};

export function buildPromptWithContext(userMessage, sessionState) {
  let contextParts = [SYSTEM_PROMPT];
  
  // Add preferences if set
  if (sessionState.preferences && Object.keys(sessionState.preferences).length > 0) {
    contextParts.push(CONTEXT_TEMPLATES.withPreferences(sessionState.preferences));
  }
  
  // Add active recipe context if exists
  if (sessionState.activeRecipe) {
    contextParts.push(CONTEXT_TEMPLATES.withActiveRecipe(
      sessionState.activeRecipe, 
      sessionState.currentStep || 1
    ));
  }
  
  // Add conversation history
  if (sessionState.history && sessionState.history.length > 0) {
    contextParts.push('\nCONVERSATION HISTORY:\n' + CONTEXT_TEMPLATES.withHistory(sessionState.history));
  }
  
  return contextParts.join('\n\n');
}
