import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import twilio from "twilio";
import { Resend } from "resend";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const resend = new Resend(process.env.RESEND_API_KEY);

async function getGuestList() {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "development") {
    // Local
    const localGuestList = await import("./guest-list.local.json");
    return localGuestList.default;
  }

  // Deployed
  if (!process.env.BLOB_URL) {
    throw new Error("BLOB_URL environment variable not set in production");
  }

  const response = await fetch(process.env.BLOB_URL);
  return await response.json();
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  // Check if the event has already passed
  if (process.env.EVENT_CUTOFF_DATE) {
    const cutoffDate = new Date(process.env.EVENT_CUTOFF_DATE);
    const now = new Date();

    if (now > cutoffDate) {
      const roasts = [
        "Baby, the party's OVER. You're literally trying to get into a venue that's already been cleaned and closed. The janitor left two hours ago.",
        "Bestie, you missed it. The DJ packed up, the lights came on, and everyone saw how crusty they looked. You're late to a party that already ended.",
        "Girl... the event already happened. This is giving 'showed up to prom the next morning' energy and it's deeply embarrassing.",
        "Ma'am/Sir, the party was YESTERDAY. You're out here begging to get into an empty room with confetti on the floor. Read the room!",
        "Sweetie, you're literally trying to RSVP to history. The event is done, finished, finito. Take the L and go home.",
      ];

      const roast = roasts[Math.floor(Math.random() * roasts.length)];

      return response.status(410).json({
        error: roast,
        expired: true,
      });
    }
  }

  const { name, excuse } = request.body;

  if (!name || !excuse) {
    return response.status(400).json({ error: "Missing name or excuse" });
  }

  try {
    const guestList = await getGuestList();
    console.debug(`[D-LIST] Checking guest list for: ${name}`);
    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a bouncer at an exclusive club checking a guest list.

Given a name, return ALL potential matches with a confidence level for each.

Confidence levels:
- "high": Exact match or extremely clear match (same first + last name, or unique first name)
- "medium": Could be the person but not certain (matching nickname, partial name match)
- "low": Might be them but unlikely (similar spelling, ambiguous)

Return a JSON object with this structure:
{
  "matches": [
    { "guest": <guest object from list>, "confidence": "high|medium|low" }
  ]
}

If no matches at all, return: { "matches": [] }

Guest List: ${JSON.stringify(guestList)}`,
        },
        {
          role: "user",
          content: `Check this name: ${name}`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;

    console.debug(`[D-LIST] LLM Response: ${content}`);

    let matchedGuest: { name: string; phone?: string; status?: string } | null =
      null;
    let matchResult: {
      matches: {
        guest: { name: string; phone?: string; status?: string };
        confidence: string;
      }[];
    } | null = null;

    try {
      if (content) {
        const cleanContent = content
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        matchResult = JSON.parse(cleanContent);

        // Only set matchedGuest if there's exactly ONE high-confidence match
        if (
          matchResult?.matches &&
          matchResult.matches.length === 1 &&
          matchResult.matches[0].confidence === "high"
        ) {
          matchedGuest = matchResult.matches[0].guest;
          console.debug(
            `[D-LIST] Single high-confidence match found: ${matchedGuest.name}`
          );
        } else if (matchResult?.matches && matchResult.matches.length > 1) {
          console.debug(
            `[D-LIST] Multiple matches found, not sending to guest`
          );
        } else if (
          matchResult?.matches &&
          matchResult.matches.length === 1 &&
          matchResult.matches[0].confidence !== "high"
        ) {
          console.debug(
            `[D-LIST] Match found but confidence too low: ${matchResult.matches[0].confidence}`
          );
        }
      }
    } catch {
      console.error("Failed to parse LLM response:", content);
    }

    const notifications: Promise<unknown>[] = [];

    if (process.env.HOST_EMAIL) {
      console.debug(
        `[D-LIST] Queuing email to host: ${process.env.HOST_EMAIL}`
      );

      let matchInfo = "No Match";
      if (matchResult?.matches && matchResult.matches.length > 0) {
        if (matchResult.matches.length === 1) {
          const match = matchResult.matches[0];
          const statusText = match.guest.status
            ? ` (${match.guest.status})`
            : "";
          matchInfo = `${match.guest.name}${statusText} - ${match.confidence} confidence`;
        } else {
          matchInfo = `Multiple matches (${
            matchResult.matches.length
          }): ${matchResult.matches
            .map((m) => {
              const statusText = m.guest.status ? ` (${m.guest.status})` : "";
              return `${m.guest.name}${statusText} - ${m.confidence}`;
            })
            .join(", ")}`;
        }
      }

      notifications.push(
        resend.emails.send({
          from: "D-List Bouncer <dlist@grayson.cash>",
          to: process.env.HOST_EMAIL,
          subject: `New Plea: ${name}`,
          html: `
          <h1>New Plea for Entry</h1>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Excuse:</strong> ${excuse}</p>
          <p><strong>Guest List Match:</strong> ${matchInfo}</p>
          ${
            matchedGuest
              ? "<p><em>✅ Guest was notified</em></p>"
              : "<p><em>⚠️ Guest was NOT notified (multiple matches or low confidence)</em></p>"
          }
          `,
        })
      );
    }

    if (process.env.HOST_PHONE) {
      console.debug(`[D-LIST] Queuing text to host: ${process.env.HOST_PHONE}`);

      let matchText = "None";
      if (matchResult?.matches && matchResult.matches.length > 0) {
        if (matchResult.matches.length === 1) {
          const match = matchResult.matches[0];
          matchText = `${match.guest.name} (${match.confidence})`;
        } else {
          matchText = `${matchResult.matches.length} matches - see email`;
        }
      }

      notifications.push(
        twilioClient.messages.create({
          body: `D-LIST ALERT:\n${name} wants in.\nPlea: "${excuse}"\nMatch: ${matchText}${
            matchedGuest ? "\n✅ Guest notified" : ""
          }`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: process.env.HOST_PHONE,
        })
      );
    }

    if (matchedGuest && matchedGuest.phone) {
      console.debug(`[D-LIST] Queuing text to guest: ${matchedGuest.phone}`);

      const messageBody =
        matchedGuest.status?.toLowerCase() === "vip"
          ? `${matchedGuest.name}, bestie. You're FINE. Honestly it's worse if you don't show up at all. Just come through.`
          : `Hey ${matchedGuest.name}. Got your plea: "${excuse}". We'll review and let you know. Don't hold your breath though.`;

      notifications.push(
        twilioClient.messages.create({
          body: messageBody,
          to: matchedGuest.phone,
        })
      );
    }

    await Promise.allSettled(notifications);
    console.debug(`[D-LIST] All notifications sent (or failed gracefully).`);

    return response.status(200).json({
      success: true,
      matched: !!matchedGuest,
    });
  } catch (error) {
    console.error("Error processing plea:", error);
    return response.status(500).json({ error: "Internal Server Error" });
  }
}
