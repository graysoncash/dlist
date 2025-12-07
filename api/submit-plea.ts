import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import twilio from "twilio";
import { Resend, type CreateEmailOptions } from "resend";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// --- Constants & Config ---

const STYLES = {
  body: "margin: 0; padding: 20px; background-color: #f0f0f0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;",
  container:
    "max-width: 500px; margin: 0 auto; background: white; border: 4px solid #000; box-shadow: 15px 15px 0px #000; padding: 40px; text-align: left;",
  h1: "font-size: 32px; font-weight: 900; text-transform: uppercase; letter-spacing: -2px; margin: 0; line-height: 0.9; color: #000;",
  subtitle:
    "font-size: 11px; font-weight: 800; letter-spacing: 0.2em; margin-top: 12px; margin-bottom: 0; color: #000; text-transform: uppercase; border-bottom: 2px solid #000; display: inline-block; padding-bottom: 6px;",
  content: "font-size: 16px; line-height: 1.5; font-weight: 400; color: #000;",
  footer:
    "margin-top: 40px; text-align: center; font-size: 10px; font-weight: 900; color: #000; letter-spacing: 1px; text-transform: uppercase; opacity: 0.5;",
  link: "color: #000; text-decoration: underline;",
  p: "margin-bottom: 16px;",
};

const MESSAGES = {
  vip: {
    subject: "You're on the list, sweetie",
    title: "You're Fine",
    sms: (name: string) =>
      `${name}, bestie. You're FINE. Honestly it's worse if you don't show up at all. Just come through.`,
    email: (name: string) =>
      `${name}, bestie.\n\nYou're FINE. Honestly it's worse if you don't show up at all.\nJust come through.`,
    html: `
      <p style="${STYLES.p}">Honestly it's worse if you don't show up at all.</p>
      <p style="${STYLES.p}">Just come through.</p>
    `,
  },
  regular: {
    subject: "We received your plea",
    title: "We received your plea",
    sms: (name: string, content: string) =>
      `Hey ${name}. ${content}\n\nWe'll review and let you know.\nDon't hold your breath though.`,
    email: (name: string, content: string) =>
      `Hey ${name}.\n\n${content}\n\nWe'll review and let you know.\nDon't hold your breath though.`,
    html: (content: string) => `
      <p style="${STYLES.p}">${content}</p>
      <p style="${STYLES.p}">We'll review and let you know.</p>
      <p style="${STYLES.p}">Don't hold your breath though.</p>
    `,
  },
};

interface Guest {
  name: string;
  phone?: string;
  email?: string;
  status?: string;
}

interface MatchResult {
  matches: {
    guest: Guest | string;
    confidence: string;
  }[];
}

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const resend = new Resend(process.env.RESEND_API_KEY);

// --- Helpers ---

async function sendEmail(payload: CreateEmailOptions) {
  const { data, error } = await resend.emails.send(payload);
  if (error) {
    throw new Error(`Resend error: ${error.name} - ${error.message}`);
  }
  return data;
}

function generateEmailHtml(title: string, subtitle: string, content: string) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="${STYLES.body}">
        <div style="${STYLES.container}">
          <header style="margin-bottom: 30px;">
            <h1 style="${STYLES.h1}">${title}</h1>
            <p style="${STYLES.subtitle}">${subtitle}</p>
          </header>
          
          <div style="${STYLES.content}">
            ${content}
          </div>

          <footer style="${STYLES.footer}">
            <p style="margin: 0;">NO GUARANTEES. NO REFUNDS ON DIGNITY.</p>
            <p style="margin-top: 10px; font-weight: 400; font-size: 9px; opacity: 0.8; text-transform: none;">
              You received this because you submitted a plea to D-List.<br>
              <a href="https://dlist.grayson.cash" style="${STYLES.link}">dlist.grayson.cash</a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  `;
}

async function getGuestList(): Promise<Guest[]> {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV;
  console.info(`[D-LIST] Loading guest list - env: ${env}`);

  if (env === "development") {
    console.info(`[D-LIST] Loading local guest list`);
    const list = require("./guest-list.local.json");
    console.info(`[D-LIST] Local guest list loaded successfully`);
    return list;
  }

  if (!process.env.BLOB_URL) {
    throw new Error("BLOB_URL environment variable not set in production");
  }

  console.info(`[D-LIST] Fetching from: ${process.env.BLOB_URL}`);
  const response = await fetch(process.env.BLOB_URL);
  const data = await response.json();
  console.info(`[D-LIST] Blob data parsed successfully`);
  return data;
}

// --- Handler ---

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  // Check Expiry
  if (process.env.EVENT_CUTOFF_DATE) {
    if (new Date() > new Date(process.env.EVENT_CUTOFF_DATE)) {
      return response
        .status(410)
        .json({ error: "Event has passed", expired: true });
    }
  }

  const { name, excuse, phone } = request.body;
  if (!name || !excuse || !phone) {
    return response
      .status(400)
      .json({ error: "Missing name, phone, or excuse" });
  }

  console.info(`[D-LIST] Processing plea for: ${name}`);

  try {
    const guestList = await getGuestList();
    const sanitizedGuestList = guestList.map(({ name, status }) => ({
      name,
      status,
    }));

    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a bouncer at an exclusive club checking a guest list.
Given a name, return ALL potential matches with a confidence level.
Confidence levels:
- "high": Exact match or unique first/last name match
- "medium": Probable match (nickname, partial)
- "low": Unlikely match

Return JSON: { "matches": [{ "guest": <guest>, "confidence": "high|medium|low" }] }
Guest List: ${JSON.stringify(sanitizedGuestList)}`,
        },
        { role: "user", content: `Check this name: ${name}` },
      ],
    });

    const content = completion.choices[0]?.message?.content || "";
    let matchedGuest: Guest | null = null;
    let matchResult: MatchResult | null = null;

    try {
      const cleanContent = content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      matchResult = JSON.parse(cleanContent);
      console.info(
        "[D-LIST] Match result:",
        JSON.stringify(matchResult, null, 2)
      );

      const matches = matchResult?.matches || [];
      const highConfidence = matches.filter((m) => m.confidence === "high");
      const mediumConfidence = matches.filter((m) => m.confidence === "medium");

      let selectedMatch;
      if (highConfidence.length === 1) {
        selectedMatch = highConfidence[0];
      } else if (highConfidence.length === 0 && mediumConfidence.length === 1) {
        selectedMatch = mediumConfidence[0];
      }

      if (selectedMatch) {
        const guestName =
          typeof selectedMatch.guest === "string"
            ? selectedMatch.guest
            : selectedMatch.guest.name;
        matchedGuest = guestList.find((g) => g.name === guestName) || null;
      }
      console.info(`[D-LIST] Matched Guest: ${matchedGuest?.name || "None"}`);
    } catch (e) {
      console.error("Failed to parse LLM response", e);
    }

    // Generate Roast if needed
    let roast: string | null = null;
    const isVip = matchedGuest?.status?.toLowerCase() === "vip";

    if (matchedGuest && !isVip) {
      try {
        console.log(`[D-LIST] Generating roast for ${matchedGuest.name}`);
        const roastPromise = openai.chat.completions.create({
          model: "openai/gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a bouncer at an exclusive club. Analyze the tone of the guest's excuse.\n\nIf they are nice/polite:\n- Be polite but firm. You are still the gatekeeper.\n- Acknowledge their excuse but remind them it's a strict list.\n\nIf they are rude, bitchy, or entitled:\n- Roast them back. Match their energy.\n- Be witty, mean, and dismissive.\n\nOutput plain text only. No quotes. Use first name only. Keep it under 40 words. Do NOT include a sign-off like 'We'll review it'.",
            },
            {
              role: "user",
              content: `Guest Name: ${matchedGuest.name}\nExcuse: ${excuse}`,
            },
          ],
        });

        // Timeout after 4 seconds to prevent Vercel timeout
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 4000)
        );

        const result = await Promise.race([roastPromise, timeoutPromise]);

        if (!result) {
          console.warn("[D-LIST] Roast generation timed out");
        } else {
          // @ts-expect-error - Promise race type inference
          roast = result.choices[0]?.message?.content?.trim() || null;
        }
      } catch (error) {
        console.error("Failed to generate roast:", error);
      }
    }

    console.info("[D-LIST] Preparing notifications...");
    const notifications: Promise<unknown>[] = [];

    // Host Notifications
    if (process.env.HOST_EMAIL) {
      console.info(
        `[D-LIST] Adding Host Email notification to ${process.env.HOST_EMAIL}`
      );
      const matchInfo = matchResult?.matches?.length
        ? matchResult.matches
            .map((m) => `${m.guest.name} (${m.confidence})`)
            .join(", ")
        : "No Match";

      const contactMethods = [
        matchedGuest?.phone && "text",
        matchedGuest?.email && "email",
      ].filter(Boolean);

      const guestNotified = contactMethods.length
        ? `✅ Guest was notified via ${contactMethods.join(" and ")}`
        : matchedGuest
        ? "⚠️ Guest matched but has no contact info"
        : "⚠️ Guest was NOT notified";

      notifications.push(
        sendEmail({
          from: "D-List Bouncer <dlist@grayson.cash>",
          to: process.env.HOST_EMAIL,
          replyTo: process.env.HOST_EMAIL,
          subject: `New Plea: ${name}`,
          text: `New Plea from ${name}\nPhone: ${phone}\nExcuse: ${excuse}\nMatch: ${matchInfo}\n\n${guestNotified}`,
          html: generateEmailHtml(
            "New Plea",
            "Someone wants in",
            `
           <p style="${STYLES.p}"><strong>Name:</strong> ${name}</p>
           <p style="${STYLES.p}"><strong>Phone:</strong> ${phone}</p>
           <p style="${STYLES.p}"><strong>Excuse:</strong> ${excuse}</p>
           <p style="${STYLES.p}"><strong>Match:</strong> ${matchInfo}</p>
           <p style="${STYLES.p}"><em>${guestNotified}</em></p>
         `
          ),
        })
      );
    }

    if (process.env.HOST_PHONE) {
      console.info(
        `[D-LIST] Adding Host SMS notification to ${process.env.HOST_PHONE}`
      );
      const matchText =
        matchResult?.matches && matchResult.matches.length === 1
          ? `${matchResult.matches[0].guest.name} (${matchResult.matches[0].confidence})`
          : matchResult?.matches && matchResult.matches.length > 1
          ? `${matchResult.matches.length} matches`
          : "None";

      notifications.push(
        twilioClient.messages.create({
          body: `D-LIST ALERT:\n${name} wants in.\nPhone: ${phone}\nPlea: "${excuse}"\nMatch: ${matchText}${
            matchedGuest ? "\n✅ Guest notified" : ""
          }`,
          to: process.env.HOST_PHONE,
          messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
        })
      );
    }

    // Guest Notifications
    if (matchedGuest) {
      const firstName = matchedGuest.name.split(" ")[0];
      const messageConfig = isVip ? MESSAGES.vip : MESSAGES.regular;

      const smsBody = isVip
        ? MESSAGES.vip.sms(firstName)
        : MESSAGES.regular.sms(
            firstName,
            roast || `Got your plea: "${excuse}"`
          );

      const emailBody = isVip
        ? MESSAGES.vip.email(firstName)
        : MESSAGES.regular.email(
            firstName,
            roast || `Got your plea: "${excuse}"`
          );

      const htmlContent = isVip
        ? MESSAGES.vip.html
        : MESSAGES.regular.html(
            roast ? roast : `Got your plea: "<em>${excuse}</em>"`
          );

      if (matchedGuest.phone) {
        notifications.push(
          twilioClient.messages.create({
            body: smsBody,
            to: matchedGuest.phone,
            messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
          })
        );
      }

      if (matchedGuest.email) {
        notifications.push(
          sendEmail({
            from: "D-List Bouncer <dlist@grayson.cash>",
            to: matchedGuest.email,
            replyTo: process.env.HOST_EMAIL,
            subject: messageConfig.subject,
            text: emailBody,
            html: generateEmailHtml(
              `Hey ${firstName}`,
              messageConfig.title,
              htmlContent
            ),
          })
        );
      }
    }

    console.info(`[D-LIST] Sending ${notifications.length} notifications...`);
    const results = await Promise.allSettled(notifications);
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`[D-LIST] Notification ${index} failed:`, result.reason);
      } else {
        console.info(`[D-LIST] Notification ${index} sent successfully`);
      }
    });

    return response
      .status(200)
      .json({ success: true, matched: !!matchedGuest });
  } catch (error) {
    console.error("[D-LIST] Error:", error);
    return response.status(500).json({ error: "Internal Server Error" });
  }
}
