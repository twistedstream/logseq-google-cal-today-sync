# logseq-google-cal-today-sync

Logseq plugin to sync **today's** Google Calendar events into your daily journal using slash command and templates.

## ✨ Features

- `/sync-calendar` slash command
- Categorizes meetings: internal, external, and 1:1
- Uses configurable Logseq templates for each type
- Skips:
  - Canceled events
  - All-day events
  - Events you've declined
- Includes:
  - Google Calendar link (`{{event_link}}`)
  - Time, location, attendees, description

## 🛠️ Setup

1. Clone this repo:
   ```bash
   git clone https://github.com/twistedstream/logseq-google-cal-today-sync.git
   cd logseq-google-cal-today-sync
   npm install
   ```

2. Create a Google Cloud project:
   - Enable **Google Calendar API**
   - Create **OAuth 2.0 Client ID** (Desktop app)
   - Download the `credentials.json` file and place it in the root of this project

3. In Logseq:
   - Go to `Plugins > Load Unpacked Plugin`
   - Select this folder

4. Run `/sync-calendar` from a journal page and follow the OAuth prompt

## 🧩 Templates

In Logseq, define three templates:
- `External Meeting Template`
- `Internal Meeting Template`
- `One-on-One Meeting Template`

Example content:

```markdown
- {{time}} - {{summary}} ([View]({{event_link}}))
  location:: {{location}}
  attendees:: {{attendees}}
  notes:: {{description}}
```

## 🔐 Token Storage

Your Google OAuth token is stored locally in `token.json`. This file is excluded from Git tracking via `.gitignore`.

## 📜 License

MIT
