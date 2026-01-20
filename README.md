# 🧁 Chef Claude - AI Baking Assistant

A full-stack AI cooking assistant built with Cloudflare Workers, Llama 3.3, and Durable Objects. Get personalized recipes and step-by-step cooking guidance in an interactive chat interface.

![Chef Claude Banner](https://via.placeholder.com/800x300/8B5A2B/FDF6E9?text=Chef+Claude+-+AI+Baking+Assistant)

## ✨ Features

- **AI-Powered Recipe Generation**: Get custom recipes based on your preferences using Llama 3.3
- **Step-by-Step Guidance**: Interactive recipe walkthroughs with progress tracking
- **Persistent Sessions**: Conversation history and recipe progress saved via Durable Objects
- **User Preferences**: Customize skill level, dietary restrictions, and measurement units
- **Ingredient Checklist**: Track ingredients as you gather them
- **Troubleshooting Help**: Get AI assistance when things go wrong
- **Mobile Responsive**: Works great on all devices
- **Edge-Optimized**: Deployed globally on Cloudflare's edge network

## 🏗️ Architecture

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

## 📁 Project Structure

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
├── PLAN.md                         # Development plan
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Cloudflare Account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ai-baking-assistant.git
   cd ai-baking-assistant
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

4. **Run locally**
   ```bash
   npm run dev
   ```
   The Worker will start at `http://localhost:8787`

5. **In a separate terminal, serve the frontend**
   ```bash
   npm run pages:dev
   ```
   Frontend will be available at `http://localhost:3000`

### Deployment

1. **Deploy the Worker**
   ```bash
   npm run deploy
   ```

2. **Deploy the Frontend to Cloudflare Pages**
   ```bash
   npm run pages:deploy
   ```

3. **Update the API URL** in `frontend/app.js` to point to your deployed Worker URL.

## 🔌 API Reference

All endpoints require the `X-Session-ID` header for session tracking.

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

**GET /api/session** - Get current session state

**DELETE /api/session** - Clear session and start fresh

### Preferences

**GET /api/preferences** - Get user preferences

**POST /api/preferences** - Update preferences
```json
{
  "skillLevel": "intermediate",
  "units": "metric",
  "dietary": ["vegetarian", "nut-free"]
}
```

### Recipe

**GET /api/recipe** - Get active recipe

**DELETE /api/recipe** - Clear active recipe

### Step Navigation

**POST /api/step**
```json
{ "action": "next" }  // Advance to next step
{ "action": "prev" }  // Go back one step
{ "action": "set", "step": 3 }  // Jump to specific step
```

### Complete Recipe

**POST /api/complete** - Mark recipe as completed

## 🎨 Customization

### Changing the AI Persona

Edit `src/utils/prompts.js` to customize the AI assistant's personality and behavior.

### Theming

The frontend uses CSS variables for easy theming. Edit the `:root` section in `frontend/styles.css`:

```css
:root {
  --cream: #FDF6E9;
  --brown: #8B5A2B;
  --gold: #C4956A;
  /* ... */
}
```

### Adding New Features

1. Add new endpoints in `src/index.js`
2. Add state management methods in `src/durable-objects/ChatSession.js`
3. Update the frontend in `frontend/app.js`

## 🧪 Testing

### Local Testing

```bash
# Start the worker
npm run dev

# In another terminal, test the API
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: test-session" \
  -d '{"message": "Give me a simple cookie recipe"}'
```

### View Logs

```bash
wrangler tail
```

## 📊 Monitoring

After deployment, monitor your Worker in the [Cloudflare Dashboard](https://dash.cloudflare.com/):

- Workers & Pages → Your Worker → Analytics
- View requests, errors, and latency metrics

## 🔐 Security Considerations

- Session IDs are stored in localStorage
- No authentication implemented (add as needed)
- All data is stored in Durable Objects (isolated per session)
- CORS is configured to allow all origins (restrict for production)

## 💡 Tips for Better Results

1. **Be specific**: "I want soft, chewy chocolate chip cookies" works better than "cookies"
2. **Mention restrictions**: "gluten-free banana bread" will get appropriate recipes
3. **Ask for help**: "My cookies are too flat, what went wrong?" for troubleshooting
4. **Use step help**: Ask questions while on a specific step for contextual guidance

## 🛠️ Tech Stack

- **Runtime**: Cloudflare Workers
- **AI**: Workers AI (Llama 3.3 70B Instruct)
- **State**: Durable Objects
- **Frontend**: Vanilla JS + CSS (no frameworks)
- **Hosting**: Cloudflare Pages

## 📝 License

MIT License - feel free to use this for your own projects!

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

---

Built with ❤️ and 🧁 using Cloudflare Workers
