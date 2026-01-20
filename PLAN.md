# AI Baking Assistant - 24-Hour Development Plan

## Project Overview
A full-stack AI cooking assistant using Cloudflare Workers, Llama 3.3, and Durable Objects with persistent conversation state.

---

## Hour-by-Hour Breakdown

### Phase 1: Setup & Infrastructure (Hours 1-4)

#### Hour 1: Project Initialization
- [ ] Create Cloudflare account (if needed) and set up Workers AI access
- [ ] Install Wrangler CLI: `npm install -g wrangler`
- [ ] Authenticate: `wrangler login`
- [ ] Initialize project: `wrangler init ai-baking-assistant`
- [ ] Set up Git repository

#### Hour 2: Durable Objects Configuration
- [ ] Configure `wrangler.toml` with Durable Objects bindings
- [ ] Create ChatSession Durable Object class skeleton
- [ ] Define state schema for:
  - Conversation history
  - User preferences (dietary restrictions, skill level)
  - Active recipe context
  - Current step progression

#### Hour 3: Workers AI Integration
- [ ] Enable Workers AI in Cloudflare dashboard
- [ ] Test basic Llama 3.3 connection
- [ ] Create AI service wrapper with:
  - System prompt for baking expertise
  - Message formatting
  - Response parsing

#### Hour 4: API Route Structure
- [ ] Design RESTful endpoints:
  - `POST /api/chat` - Send message, get response
  - `GET /api/session/:id` - Retrieve session state
  - `POST /api/session/:id/preferences` - Update preferences
  - `DELETE /api/session/:id` - Clear session
- [ ] Implement basic routing logic

---

### Phase 2: Core Backend Development (Hours 5-10)

#### Hour 5: Durable Object - State Management
- [ ] Implement `ChatSession` class:
  ```javascript
  class ChatSession {
    constructor(state, env) { ... }
    async fetch(request) { ... }
  }
  ```
- [ ] Add methods for state persistence:
  - `getHistory()`
  - `addMessage(role, content)`
  - `getPreferences()`
  - `setPreferences(prefs)`

#### Hour 6: Durable Object - Recipe Context
- [ ] Implement recipe state tracking:
  - `setActiveRecipe(recipe)`
  - `getCurrentStep()`
  - `advanceStep()`
  - `goBackStep()`
  - `completeRecipe()`
- [ ] Store recipe metadata (ingredients, steps, timing)

#### Hour 7: AI Prompt Engineering
- [ ] Craft system prompt for baking assistant:
  - Persona: Warm, encouraging pastry chef
  - Capabilities: Recipe generation, step guidance, troubleshooting
  - Format: Structured responses with ingredients/steps
- [ ] Create prompt templates for:
  - Recipe generation
  - Step-by-step guidance
  - Ingredient substitutions
  - Troubleshooting

#### Hour 8: AI Response Processing
- [ ] Implement response parser:
  - Extract recipe JSON from LLM output
  - Parse step numbers and instructions
  - Identify when user wants to start/stop recipes
- [ ] Add conversation context injection
- [ ] Handle multi-turn conversations

#### Hour 9: Main Worker Logic
- [ ] Connect all components:
  - Receive request → Get/create session → Build context → Call AI → Store response → Return
- [ ] Implement error handling
- [ ] Add request validation

#### Hour 10: Testing & Debugging Backend
- [ ] Test with `wrangler dev`
- [ ] Verify Durable Object persistence
- [ ] Test conversation continuity
- [ ] Fix any integration issues

---

### Phase 3: Frontend Development (Hours 11-18)

#### Hour 11: Frontend Setup
- [ ] Create `/frontend` directory
- [ ] Initialize with Vite or vanilla HTML/CSS/JS
- [ ] Set up Cloudflare Pages deployment config
- [ ] Create basic file structure

#### Hour 12-13: Chat Interface UI
- [ ] Build chat container component
- [ ] Style message bubbles (user vs. assistant)
- [ ] Add message input with send button
- [ ] Implement auto-scroll behavior
- [ ] Add typing indicator

#### Hour 14-15: Recipe Display Component
- [ ] Create recipe card component:
  - Title and description
  - Ingredients list with checkboxes
  - Steps with current step highlighting
  - Timer integration (optional)
- [ ] Add step navigation controls
- [ ] Style for readability during cooking

#### Hour 16: User Preferences Panel
- [ ] Build preferences sidebar/modal:
  - Dietary restrictions (vegan, gluten-free, etc.)
  - Skill level selector
  - Measurement units preference
- [ ] Persist preferences to backend

#### Hour 17: API Integration
- [ ] Create fetch wrapper for API calls
- [ ] Implement session management (localStorage for session ID)
- [ ] Handle loading states
- [ ] Add error handling and retry logic

#### Hour 18: Polish & Responsive Design
- [ ] Mobile-responsive layout
- [ ] Dark/light mode toggle
- [ ] Loading animations
- [ ] Empty states
- [ ] Keyboard shortcuts (Enter to send)

---

### Phase 4: Integration & Deployment (Hours 19-22)

#### Hour 19: Connect Frontend to Backend
- [ ] Configure CORS in Worker
- [ ] Test full flow locally
- [ ] Debug any integration issues
- [ ] Verify state persistence works

#### Hour 20: Cloudflare Pages Deployment
- [ ] Build frontend for production
- [ ] Deploy to Cloudflare Pages
- [ ] Configure custom domain (optional)
- [ ] Set up environment variables

#### Hour 21: Worker Deployment
- [ ] Deploy Worker: `wrangler deploy`
- [ ] Verify Durable Objects are working in production
- [ ] Test edge latency
- [ ] Monitor for errors

#### Hour 22: End-to-End Testing
- [ ] Test complete user flows:
  - New user starts conversation
  - Generate a recipe
  - Follow step-by-step
  - Return to conversation later (persistence)
  - Update preferences
- [ ] Fix any production bugs

---

### Phase 5: Documentation & Finishing (Hours 23-24)

#### Hour 23: Documentation
- [ ] Write README.md with:
  - Project overview
  - Setup instructions
  - Architecture diagram
  - API documentation
- [ ] Add inline code comments
- [ ] Create .env.example

#### Hour 24: Final Polish
- [ ] Performance optimization
- [ ] Add rate limiting (optional)
- [ ] Final bug fixes
- [ ] Record demo video/GIF
- [ ] Push to GitHub

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge Network                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐    ┌──────────────┐  │
│  │  Cloudflare  │────▶│   Worker     │───▶│  Workers AI  │  │
│  │    Pages     │     │  (Backend)   │    │  (Llama 3.3) │  │
│  │  (Frontend)  │◀────│              │◀───│              │  │
│  └──────────────┘     └──────┬───────┘    └──────────────┘  │
│                              │                               │
│                              ▼                               │
│                    ┌──────────────────┐                     │
│                    │  Durable Object  │                     │
│                    │  (ChatSession)   │                     │
│                    │                  │                     │
│                    │ • History        │                     │
│                    │ • Preferences    │                     │
│                    │ • Active Recipe  │                     │
│                    │ • Step Progress  │                     │
│                    └──────────────────┘                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Files Structure

```
ai-baking-assistant/
├── src/
│   ├── index.js              # Main Worker entry
│   ├── durable-objects/
│   │   └── ChatSession.js    # Durable Object class
│   ├── services/
│   │   └── ai.js             # Workers AI wrapper
│   └── utils/
│       └── prompts.js        # AI prompt templates
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── wrangler.toml
├── package.json
└── README.md
```

---

## Quick Commands Reference

```bash
# Development
wrangler dev                    # Start local dev server
wrangler tail                   # View live logs

# Deployment
wrangler deploy                 # Deploy Worker
wrangler pages deploy frontend  # Deploy frontend

# Durable Objects
wrangler d1 migrations apply    # If using D1 for additional storage
```

---

## Environment Variables Needed

```toml
# wrangler.toml
[vars]
ENVIRONMENT = "production"

[[durable_objects.bindings]]
name = "CHAT_SESSION"
class_name = "ChatSession"

[ai]
binding = "AI"
```

---

## Success Criteria

- [ ] User can start a new conversation
- [ ] AI generates baking recipes based on requests
- [ ] Recipes display in a structured, readable format
- [ ] User can navigate through recipe steps
- [ ] Conversation persists across browser refreshes
- [ ] User preferences are saved and applied
- [ ] Works on mobile devices
- [ ] Deployed and accessible via public URL
