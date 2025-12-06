# D-List Access 💅

**BEAUTIFUL. DIRTY. RICH.**

A delightfully judgemental web app for when someone shows up to your themed party without following the theme. Because if they can't read the dress code, they can at least beg convincingly.

![Status](https://img.shields.io/badge/status-judging-critical)
![Vibe](https://img.shields.io/badge/vibe-exclusive-pink)

## What Is This?

You're throwing an event. You set a theme. Someone didn't follow it. Now what?

Instead of awkwardly turning them away at the door, let them submit a digital plea for entry. This app:

1. **Takes their excuse** via a brutally honest form
2. **Uses AI** to fuzzy-match their name against your guest list (because "Lindsay" might write "LiLo")
3. **Notifies you** via email and text with their plea
4. **Messages the guest** if they're on the list (optional roasting included)

It's giving velvet rope. It's giving "you can't sit with us." It's giving **accountability**.

---

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript
- **Backend**: Vercel Serverless Functions
- **AI**: OpenRouter (GPT-4o-mini) for name matching
- **Notifications**: 
  - Resend for emails
  - Twilio for SMS
- **Hosting**: Vercel (obviously)

---

## Features

✨ **AI-Powered Guest Matching**: Because people never spell their own names correctly  
📧 **Email Alerts**: Get notified when someone's begging at your door  
📱 **SMS Notifications**: For maximum drama in real-time  
🎭 **Vibe Matching UX**: The copy alone is worth the price of admission (free)  
🔒 **Async Submission**: Fire and forget – users don't wait around for judgment  

---

## Setup

### Prerequisites

- Node.js 22+
- pnpm
- Vercel CLI (`npm i -g vercel`)
- API Keys for:
  - [OpenRouter](https://openrouter.ai/)
  - [Twilio](https://www.twilio.com/)
  - [Resend](https://resend.com/)

### Installation

```bash
# Clone the repo
git clone git@github.com:graysoncash/dlist.git
cd dlist

# Install dependencies
pnpm install

# Create your .env file
cp .env.example .env
```

### Environment Variables

Create a `.env` file in the root:

```bash
OPENROUTER_API_KEY=sk-or-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890
RESEND_API_KEY=re_...
HOST_EMAIL=your@email.com
HOST_PHONE=+1234567890
```

### Guest List

Edit `api/guest-list.json` with your actual guest list:

```json
[
  {
    "name": "Jane Doe",
    "phone": "+15551234567",
    "instagram": "@janedoe",
    "status": "vip"
  }
]
```

### Run Locally

```bash
pnpm dev
```

This starts Vercel's dev server which handles both the frontend (Vite) and API routes. Visit `http://localhost:3000`.

---

## Deployment

```bash
# Login to Vercel
vercel login

# Deploy
vercel --prod
```

Set your environment variables in the Vercel dashboard under **Settings → Environment Variables**.

---

## Project Structure

```
dlist/
├── api/
│   ├── guest-list.json       # Your exclusive guest list
│   └── submit-plea.ts         # Serverless function handler
├── src/
│   ├── App.tsx                # Main React component
│   └── App.css                # The aesthetic™
├── public/
└── package.json
```

---

## Why I Built This

![Lady Gaga GIF](https://kagi.com/proxy/ladygaga-gaga.gif?c=0nwlWp1fl93B8auRnbmwZm73vEGrCwGM8LJ_zZYvO7exRatbFa6BOI6eZiTdrQqqAHTVz5AZ6DbJdEb_MUZ-FcDhhYMHb9fDp1NSwmptb3A%3D)

---

## Contributing

This is just a fun personal project.

---

## License

MIT — Use it, remix it, judge with it. Just credit me if you do something cool with it.

---

## Contact

Built by **Grayson Cash** | [LinkedIn](https://linkedin.com/in/graysonlcash)

*No refunds on dignity.*
