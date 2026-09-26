# Chef Thu - AI Baking Assistant

An AI baking assistant built on Cloudflare Workers, using Llama 3.3 for recipe generation and Durable Objects to keep track of session state. Chat with it about what you want to bake and it walks you through the recipe step by step.

https://ai-baking-assistant-ui.pages.dev/

## Features

- Generates custom recipes from Llama 3.3 based on what you ask for
- Step-by-step walkthrough with progress tracking
- Conversation history and recipe progress persisted per session via Durable Objects
- User preferences for skill level, dietary restrictions, and measurement units
- Ingredient checklist you can tick off as you go
- Troubleshooting help if a step goes wrong
- Responsive layout, works fine on mobile
- Runs on Cloudflare's edge network

## Architecture

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

## Project structure

```
ai-baking-assistant/
├── src/
│   ├── index.js                    # Main Worker entry point
│   ├── durable-objects/
│   │   └── ChatSession.js          # Durable Object for state management
│   ├── services/
│   │   └── ai.js                   # Workers AI wrapper
│   └── utils/
│       └── prompts.js              # AI prompt templates
├── frontend/
│   ├── index.html                  # Main HTML
│   ├── styles.css                  # Styles (warm bakery theme)
│   └── app.js                      # Frontend JavaScript
├── wrangler.toml                   # Cloudflare configuration
├── package.json
└── README.md
```

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Cloudflare Account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### Installation

1. Clone the repo
   ```bash
   git clone git@github.com:VirdVissy/ai-baking.git
   cd ai-baking
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Log in to Cloudflare
   ```bash
   wrangler login
   ```

4. Run the worker locally
   ```bash
   npm run dev
   ```
   Starts at `http://localhost:8787`

5. In a separate terminal, serve the frontend
   ```bash
   npm run pages:dev
   ```
   Available at `http://localhost:3000`

### Deployment

1. Deploy the Worker
   ```bash
   npm run deploy
   ```

2. Deploy the frontend to Cloudflare Pages
   ```bash
   npm run pages:deploy
   ```

3. Update the API URL in `frontend/app.js` to point at your deployed Worker.

## API reference

All endpoints expect an `X-Session-ID` header for session tracking.

### Chat

**POST /api/chat**

Send a message and get an AI response.

```json
// Request
{
  "message": "I want to make chocolate chip cookies"
}

// Response
{
  "sessionId": "uuid",
  "response": {
    "type": "recipe",
    "recipe": {
      "title": "Classic Chocolate Chip Cookies",
      "description": "Soft, chewy cookies with melty chocolate chips",
      "prepTime": "15 mins",
      "cookTime": "12 mins",
      "servings": 24,
      "difficulty": "easy",
      "ingredients": [...],
      "steps": [...]
    },
    "message": "Here's a delicious recipe..."
  },
  "timestamp": 1699123456789
}
```

### Session

**GET /api/session** - get current session state

**DELETE /api/session** - clear session and start fresh

### Preferences

**GET /api/preferences** - get user preferences

**POST /api/preferences** - update preferences
```json
{
  "skillLevel": "intermediate",
  "units": "metric",
  "dietary": ["vegetarian", "nut-free"]
}
```

### Recipe

**GET /api/recipe** - get active recipe

**DELETE /api/recipe** - clear active recipe

### Step navigation

**POST /api/step**
```json
{ "action": "next" }  // advance to next step
{ "action": "prev" }  // go back one step
{ "action": "set", "step": 3 }  // jump to a specific step
```

### Complete recipe

**POST /api/complete** - mark recipe as completed

## Customization

### Changing the AI persona

Edit `src/utils/prompts.js` to change the assistant's personality and behavior.

### Theming

The frontend uses CSS variables. Edit the `:root` section in `frontend/styles.css`:

```css
:root {
  --cream: #FDF6E9;
  --brown: #8B5A2B;
  --gold: #C4956A;
  /* ... */
}
```

### Adding new features

1. Add new endpoints in `src/index.js`
2. Add state management methods in `src/durable-objects/ChatSession.js`
3. Update the frontend in `frontend/app.js`

## Testing

```bash
# start the worker
npm run dev

# in another terminal, hit the API
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: test-session" \
  -d '{"message": "Give me a simple cookie recipe"}'
```

View logs with:
```bash
wrangler tail
```

## Monitoring

After deploying, you can monitor the Worker from the [Cloudflare Dashboard](https://dash.cloudflare.com/) under Workers & Pages → Your Worker → Analytics, which shows requests, errors, and latency.

## Security notes

- Session IDs live in localStorage
- No authentication yet - add it if you need it
- All state is stored in Durable Objects, isolated per session
- CORS currently allows all origins - restrict this before running in production

## Tips for better results

1. Be specific - "soft, chewy chocolate chip cookies" works better than just "cookies"
2. Mention restrictions - "gluten-free banana bread" gets you an appropriate recipe
3. Ask for help - "my cookies are too flat, what went wrong?" for troubleshooting
4. Use step help - ask questions while on a specific step for context-aware answers

## Tech stack

- Runtime: Cloudflare Workers
- AI: Workers AI (Llama 3.3 70B Instruct)
- State: Durable Objects
- Frontend: vanilla JS + CSS, no frameworks
- Hosting: Cloudflare Pages

## License

MIT
