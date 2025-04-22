/* Logseq Plugin: logseq-google-cal-today-sync
 * Description: Adds a /sync-calendar slash command to insert today's Google Calendar events into Logseq using selected templates.
 */
import "@logseq/libs";
import dayjs from "dayjs";
import fs from "fs/promises";
import { google } from "googleapis";
import open from "open";
import readline from "readline";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];
const TOKEN_PATH = "token.json";
const CREDENTIALS_PATH = "credentials.json";

logseq.useSettingsSchema([
  {
    key: "templateExternal",
    type: "string",
    title: "Template for External Meetings",
    default: "External Meeting Template",
  },
  {
    key: "templateInternal",
    type: "string",
    title: "Template for Internal Meetings (Group)",
    default: "Internal Meeting Template",
  },
  {
    key: "templateOneOnOne",
    type: "string",
    title: "Template for 1:1 Meetings",
    default: "One-on-One Meeting Template",
  },
]);

async function loadCredentials() {
  const data = await fs.readFile(CREDENTIALS_PATH, "utf8");
  return JSON.parse(data);
}

async function getOAuthClient() {
  const credentials = await loadCredentials();
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  try {
    const token = await fs.readFile(TOKEN_PATH, "utf8");
    oAuth2Client.setCredentials(JSON.parse(token));
  } catch (e) {
    return getAccessToken(oAuth2Client);
  }

  return oAuth2Client;
}

async function getAccessToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url:", authUrl);
  await open(authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Enter the code from that page here: ", async (code) => {
      rl.close();
      const tokenResponse = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokenResponse.tokens);
      await fs.writeFile(TOKEN_PATH, JSON.stringify(tokenResponse.tokens));
      resolve(oAuth2Client);
    });
  });
}

async function getUserEmail(auth) {
  const oauth2 = google.oauth2({ version: "v2", auth });
  const res = await oauth2.userinfo.get();
  return res.data.email;
}

async function getTodaysEvents(auth, userEmail) {
  const calendar = google.calendar({ version: "v3", auth });
  const start = dayjs().startOf("day").toISOString();
  const end = dayjs().endOf("day").toISOString();

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: start,
    timeMax: end,
    singleEvents: true,
    orderBy: "startTime",
  });

  return res.data.items
    .filter((event) => event.status !== "cancelled")
    .filter((event) => event.start?.dateTime)
    .filter((event) => {
      const me = (event.attendees || []).find((a) => a.email === userEmail);
      return !me || me.responseStatus !== "declined";
    })
    .map((event) => {
      const time = event.start.dateTime;
      const attendees = (event.attendees || []).map((a) => a.email);
      return {
        time: dayjs(time).format("HH:mm"),
        summary: event.summary,
        description: event.description || "",
        location: event.location || "",
        attendees,
        organizer: event.organizer?.email || "",
        eventLink: `https://www.google.com/calendar/event?eid=${encodeURIComponent(
          event.id
        )}`,
      };
    });
}

function getTemplateType(event, userEmail) {
  const others = event.attendees.filter((email) => email !== userEmail);
  const external = others.some(
    (email) => !email.endsWith("@" + userEmail.split("@")[1])
  );
  if (external) return "templateExternal";
  if (others.length === 1) return "templateOneOnOne";
  return "templateInternal";
}

async function insertEventsWithTemplates(events, userEmail) {
  const currentPage = await logseq.Editor.getCurrentPage();
  if (!currentPage) return;

  const templates = await logseq.Editor.getTemplateBlocks();

  for (const event of events) {
    const templateKey = getTemplateType(event, userEmail);
    const templateName = logseq.settings[templateKey];
    const template = templates.find((t) => t.name === templateName);
    if (!template) {
      logseq.UI.showMsg(`Template '${templateName}' not found.`, "warning");
      continue;
    }

    const blockContent = template.content
      .replaceAll("{{time}}", event.time)
      .replaceAll("{{summary}}", event.summary)
      .replaceAll("{{description}}", event.description)
      .replaceAll("{{location}}", event.location)
      .replaceAll("{{attendees}}", event.attendees.join(", "))
      .replaceAll("{{organizer}}", event.organizer)
      .replaceAll("{{event_link}}", event.eventLink);

    await logseq.Editor.insertBlock(currentPage.uuid, blockContent, {
      sibling: false,
    });
  }
}

function main() {
  logseq.ready(() => {
    logseq.Editor.registerSlashCommand("Sync Google Calendar", async () => {
      try {
        const auth = await getOAuthClient();
        const userEmail = await getUserEmail(auth);
        const events = await getTodaysEvents(auth, userEmail);
        await insertEventsWithTemplates(events, userEmail);
      } catch (err) {
        console.error("Failed to sync calendar:", err);
        logseq.UI.showMsg(
          "Failed to sync calendar. Check console for details.",
          "error"
        );
      }
    });
  });
}

main();
