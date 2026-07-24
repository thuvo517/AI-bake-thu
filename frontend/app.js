// AI Baking Assistant - Frontend Application

// Configuration
const CONFIG = {
  // Update this to your deployed Worker URL
  API_URL: window.location.hostname === 'localhost' 
    ? 'http://localhost:8787/api'
    : '/api', // Same origin when deployed
  SESSION_KEY: 'chef_thu_session_id'
};

// State
const state = {
  sessionId: null,
  isLoading: false,
  activeRecipe: null,
  currentStep: 0,
  preferences: {}
};

// DOM Elements
const elements = {
  chatMessages: document.getElementById('chatMessages'),
  chatContainer: document.getElementById('chatContainer'),
  messageInput: document.getElementById('messageInput'),
  chatForm: document.getElementById('chatForm'),
  sendBtn: document.getElementById('sendBtn'),
  typingIndicator: document.getElementById('typingIndicator'),
  recipePanel: document.getElementById('recipePanel'),
  recipeTitle: document.getElementById('recipeTitle'),
  recipeMeta: document.getElementById('recipeMeta'),
  ingredientsList: document.getElementById('ingredientsList'),
  stepsList: document.getElementById('stepsList'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  prevStepBtn: document.getElementById('prevStepBtn'),
  nextStepBtn: document.getElementById('nextStepBtn'),
  closeRecipeBtn: document.getElementById('closeRecipeBtn'),
  preferencesToggle: document.getElementById('preferencesToggle'),
  preferencesPanel: document.getElementById('preferencesPanel'),
  savePrefsBtn: document.getElementById('savePrefsBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  menuToggle: document.getElementById('menuToggle'),
  sidebar: document.getElementById('sidebar')
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Get or create session ID
  state.sessionId = localStorage.getItem(CONFIG.SESSION_KEY);
  if (!state.sessionId) {
    state.sessionId = generateUUID();
    localStorage.setItem(CONFIG.SESSION_KEY, state.sessionId);
  }

  // Load existing session state
  await loadSessionState();

  // Setup event listeners
  setupEventListeners();

  // Auto-resize textarea
  setupTextareaAutoResize();
}

function setupEventListeners() {
  // Chat form submission
  elements.chatForm.addEventListener('submit', handleSendMessage);

  // Quick actions
  document.querySelectorAll('.quick-action').forEach(btn => {
    btn.addEventListener('click', () => {
      elements.messageInput.value = btn.dataset.prompt;
      elements.messageInput.focus();
    });
  });

  // Step navigation
  elements.prevStepBtn.addEventListener('click', () => navigateStep('prev'));
  elements.nextStepBtn.addEventListener('click', () => navigateStep('next'));
  elements.closeRecipeBtn.addEventListener('click', closeRecipe);

  // Preferences
  elements.preferencesToggle.addEventListener('click', togglePreferences);
  elements.savePrefsBtn.addEventListener('click', savePreferences);

  // New chat
  elements.newChatBtn.addEventListener('click', startNewChat);

  // Mobile menu
  elements.menuToggle.addEventListener('click', toggleSidebar);

  // Click outside sidebar to close on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && 
        elements.sidebar.classList.contains('open') &&
        !elements.sidebar.contains(e.target) &&
        !elements.menuToggle.contains(e.target)) {
      elements.sidebar.classList.remove('open');
    }
  });

  // Enter to send (Shift+Enter for new line)
  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  });
}

function setupTextareaAutoResize() {
  elements.messageInput.addEventListener('input', () => {
    elements.messageInput.style.height = 'auto';
    elements.messageInput.style.height = Math.min(elements.messageInput.scrollHeight, 150) + 'px';
  });
}

// API Calls
async function apiCall(endpoint, options = {}) {
  const url = `${CONFIG.API_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': state.sessionId
    }
  };

  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

async function loadSessionState() {
  try {
    const data = await apiCall('/session');
    
    if (data.activeRecipe) {
      state.activeRecipe = data.activeRecipe;
      state.currentStep = data.currentStep || 1;
      renderRecipePanel();
    }

    if (data.preferences) {
      state.preferences = data.preferences;
      populatePreferencesForm();
    }

    // Restore chat history
    if (data.history && data.history.length > 0) {
      // Clear welcome message if there's history
      elements.chatMessages.innerHTML = '';
      data.history.forEach(msg => {
        addMessageToUI(msg.role, msg.content, msg.metadata);
      });
      scrollToBottom();
    }
  } catch (error) {
    console.log('Could not load session state:', error.message);
    // Continue with fresh state
  }
}

// Message Handling
async function handleSendMessage(e) {
  e.preventDefault();
  
  const message = elements.messageInput.value.trim();
  if (!message || state.isLoading) return;

  // Clear input
  elements.messageInput.value = '';
  elements.messageInput.style.height = 'auto';

  // Add user message to UI
  addMessageToUI('user', message);
  scrollToBottom();

  // Show typing indicator
  setLoading(true);

  try {
    const data = await apiCall('/chat', {
      method: 'POST',
      body: JSON.stringify({ message })
    });

    // Hide typing indicator
    setLoading(false);

    // Handle response
    const response = data.response;
    
    // Add assistant message
    addMessageToUI('assistant', response.message, { 
      type: response.type,
      recipe: response.recipe 
    });

    // If recipe was returned, update state and show panel
    if (response.type === 'recipe' && response.recipe) {
      state.activeRecipe = response.recipe;
      state.currentStep = 1;
      renderRecipePanel();
    }

    scrollToBottom();
  } catch (error) {
    setLoading(false);
    addMessageToUI('assistant', "I'm having trouble connecting right now. Please try again in a moment! 🍪");
    scrollToBottom();
  }
}

function addMessageToUI(role, content, metadata = {}) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  
  const avatar = role === 'user' ? '👤' : '👨‍🍳';
  
  let contentHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">
      <div class="message-text">
        ${formatMessageContent(content)}
      </div>
  `;

  // Add recipe card if present
  if (metadata.type === 'recipe' && metadata.recipe) {
    contentHTML += renderRecipeCard(metadata.recipe);
  }

  contentHTML += '</div>';
  messageDiv.innerHTML = contentHTML;

  // Add event listener for recipe start button
  if (metadata.recipe) {
    const startBtn = messageDiv.querySelector('.start-recipe-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        state.activeRecipe = metadata.recipe;
        state.currentStep = 1;
        renderRecipePanel();
        // On mobile, open sidebar to show recipe
        if (window.innerWidth <= 768) {
          elements.sidebar.classList.add('open');
        }
      });
    }
  }

  elements.chatMessages.appendChild(messageDiv);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMessageContent(content) {
  if (!content) return '';

  // Basic markdown-style formatting
  let formatted = content
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  
  // Wrap in paragraph
  if (!formatted.startsWith('<p>')) {
    formatted = `<p>${formatted}</p>`;
  }
  
  return formatted;
}

function renderRecipeCard(recipe) {
  return `
    <div class="recipe-card">
      <h4>${escapeHtml(recipe.title)}</h4>
      <div class="recipe-card-meta">
        <span>⏱️ Prep: ${escapeHtml(recipe.prepTime)}</span>
        <span>🔥 Cook: ${escapeHtml(recipe.cookTime)}</span>
        <span>🍽️ Serves: ${escapeHtml(recipe.servings)}</span>
        <span>📊 ${escapeHtml(capitalizeFirst(recipe.difficulty))}</span>
      </div>
      <p>${escapeHtml(recipe.description)}</p>
      <button class="btn btn-primary start-recipe-btn start-btn">
        Start Cooking! 🧑‍🍳
      </button>
    </div>
  `;
}

// Recipe Panel
function renderRecipePanel() {
  if (!state.activeRecipe) {
    elements.recipePanel.classList.remove('active');
    return;
  }

  const recipe = state.activeRecipe;
  elements.recipePanel.classList.add('active');

  elements.recipeTitle.textContent = recipe.title;
  
  elements.recipeMeta.innerHTML = `
    <span>⏱️ ${escapeHtml(recipe.prepTime)}</span>
    <span>🔥 ${escapeHtml(recipe.cookTime)}</span>
    <span>🍽️ ${escapeHtml(recipe.servings)}</span>
  `;

  // Render ingredients
  elements.ingredientsList.innerHTML = recipe.ingredients
    .map((ing, idx) => `
      <li data-index="${idx}">
        ${escapeHtml(ing.amount)} ${escapeHtml(ing.unit)} ${escapeHtml(ing.item)}
      </li>
    `).join('');

  // Click to check off ingredients
  elements.ingredientsList.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => li.classList.toggle('checked'));
  });

  // Render steps
  renderSteps();
  updateProgress();
}

function renderSteps() {
  const recipe = state.activeRecipe;
  if (!recipe || !recipe.steps) return;

  elements.stepsList.innerHTML = recipe.steps
    .map((step, idx) => {
      const stepNum = idx + 1;
      let className = '';
      if (stepNum < state.currentStep) className = 'completed';
      if (stepNum === state.currentStep) className = 'current';
      
      return `
        <li class="${className}" data-step="${stepNum}">
          ${escapeHtml(step.instruction)}
          ${step.duration ? `<br><small>⏱️ ${escapeHtml(step.duration)}</small>` : ''}
          ${step.tip ? `<br><small>💡 ${escapeHtml(step.tip)}</small>` : ''}
        </li>
      `;
    }).join('');
}

function updateProgress() {
  if (!state.activeRecipe || !state.activeRecipe.steps) return;

  const total = state.activeRecipe.steps.length;
  const progress = (state.currentStep / total) * 100;
  
  elements.progressFill.style.width = `${progress}%`;
  elements.progressText.textContent = `Step ${state.currentStep} of ${total}`;

  // Update button states
  elements.prevStepBtn.disabled = state.currentStep <= 1;
  elements.nextStepBtn.textContent = state.currentStep >= total ? 'Complete! 🎉' : 'Next Step →';
}

async function navigateStep(direction) {
  try {
    const data = await apiCall('/step', {
      method: 'POST',
      body: JSON.stringify({ action: direction })
    });

    if (data.isComplete && direction === 'next') {
      // Recipe completed!
      await completeRecipe();
      return;
    }

    state.currentStep = data.currentStep;
    renderSteps();
    updateProgress();

    // Scroll to current step in sidebar
    const currentStepEl = elements.stepsList.querySelector('.current');
    if (currentStepEl) {
      currentStepEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } catch (error) {
    console.error('Step navigation error:', error);
  }
}

async function completeRecipe() {
  try {
    await apiCall('/complete', { method: 'POST' });
    
    // Add congratulations message
    addMessageToUI('assistant', 
      `🎉 **Congratulations!** You've completed "${state.activeRecipe.title}"! ` +
      `I hope it turned out delicious. Let me know how it went, or ask me for another recipe whenever you're ready to bake again! 🧁`
    );

    // Clear recipe state
    state.activeRecipe = null;
    state.currentStep = 0;
    elements.recipePanel.classList.remove('active');
    
    scrollToBottom();
  } catch (error) {
    console.error('Complete recipe error:', error);
  }
}

async function closeRecipe() {
  try {
    await apiCall('/recipe', { method: 'DELETE' });
    
    state.activeRecipe = null;
    state.currentStep = 0;
    elements.recipePanel.classList.remove('active');
  } catch (error) {
    console.error('Close recipe error:', error);
  }
}

// Preferences
function togglePreferences() {
  elements.preferencesPanel.classList.toggle('active');
}

function populatePreferencesForm() {
  if (state.preferences.skillLevel) {
    document.getElementById('skillLevel').value = state.preferences.skillLevel;
  }
  if (state.preferences.units) {
    document.getElementById('units').value = state.preferences.units;
  }
  if (state.preferences.dietary) {
    document.querySelectorAll('.checkbox-group input').forEach(cb => {
      cb.checked = state.preferences.dietary.includes(cb.value);
    });
  }
}

async function savePreferences() {
  const dietary = Array.from(
    document.querySelectorAll('.checkbox-group input:checked')
  ).map(cb => cb.value);

  const prefs = {
    skillLevel: document.getElementById('skillLevel').value,
    units: document.getElementById('units').value,
    dietary
  };

  try {
    const data = await apiCall('/preferences', {
      method: 'POST',
      body: JSON.stringify(prefs)
    });
    
    state.preferences = data.preferences;
    elements.preferencesPanel.classList.remove('active');
    
    // Show confirmation
    addMessageToUI('assistant', 
      `✅ Got it! I've saved your preferences. I'll tailor my suggestions to your ` +
      `${prefs.skillLevel} skill level` +
      (prefs.dietary.length > 0 ? ` and keep in mind your ${prefs.dietary.join(', ')} requirements` : '') + 
      `. Let's bake something amazing! 🍪`
    );
    scrollToBottom();
  } catch (error) {
    console.error('Save preferences error:', error);
  }
}

// Session Management
async function startNewChat() {
  if (!confirm('Start a new conversation? This will clear your current chat history.')) {
    return;
  }

  try {
    await apiCall('/session', { method: 'DELETE' });
    
    // Generate new session ID
    state.sessionId = generateUUID();
    localStorage.setItem(CONFIG.SESSION_KEY, state.sessionId);
    
    // Clear UI
    state.activeRecipe = null;
    state.currentStep = 0;
    elements.recipePanel.classList.remove('active');
    
    elements.chatMessages.innerHTML = `
      <div class="message assistant">
        <div class="message-avatar">👨‍🍳</div>
        <div class="message-content">
          <div class="message-text">
            <p>Welcome back to my kitchen! 🧁</p>
            <p>What shall we bake today?</p>
          </div>
        </div>
      </div>
    `;
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
      elements.sidebar.classList.remove('open');
    }
  } catch (error) {
    console.error('New chat error:', error);
  }
}

// UI Helpers
function setLoading(loading) {
  state.isLoading = loading;
  elements.sendBtn.disabled = loading;
  elements.typingIndicator.classList.toggle('active', loading);
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
  });
}

function toggleSidebar() {
  elements.sidebar.classList.toggle('open');
}

// Utilities
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function capitalizeFirst(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}
