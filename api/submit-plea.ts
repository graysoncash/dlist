import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import twilio from "twilio";
import { Resend } from "resend";
import guestList from "./guest-list.json";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const resend = new Resend(process.env.RESEND_API_KEY);

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
    console.debug(`[D-LIST] Checking guest list for: ${name}`);
    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a bouncer at an exclusive club. You have a guest list. 
        When given a name, check if it matches anyone on the guest list vaguely or exactly.
        Return ONLY the JSON object of the matched guest from the list, or null if no match.
        
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
    let matchedGuest: { name: string; phone?: string; status: string } | null =
      null;

    try {
      if (content && content.trim() !== "null") {
        const cleanContent = content
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        matchedGuest = JSON.parse(cleanContent);
      }
    } catch {
      console.error("Failed to parse LLM response:", content);
    }

    const notifications: Promise<unknown>[] = [];

    if (process.env.HOST_EMAIL) {
      console.debug(
        `[D-LIST] Queuing email to host: ${process.env.HOST_EMAIL}`
      );
      notifications.push(
        resend.emails.send({
          from: "D-List Bouncer <dlist@grayson.cash>",
          to: process.env.HOST_EMAIL,
          subject: `New Plea: ${name}`,
          html: `
          <h1>New Plea for Entry</h1>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Excuse:</strong> ${excuse}</p>
          <p><strong>Guest List Match:</strong> ${
            matchedGuest
              ? matchedGuest.name + " (" + matchedGuest.status + ")"
              : "No Match"
          }</p>
          `,
        })
      );
    }

    if (process.env.HOST_PHONE) {
      console.debug(`[D-LIST] Queuing text to host: ${process.env.HOST_PHONE}`);
      notifications.push(
        twilioClient.messages.create({
          body: `D-LIST ALERT:\n${name} wants in.\nPlea: "${excuse}"\nMatch: ${
            matchedGuest ? matchedGuest.name : "None"
          }`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: process.env.HOST_PHONE,
        })
      );
    }

    if (matchedGuest && matchedGuest.phone) {
      console.debug(`[D-LIST] Queuing text to guest: ${matchedGuest.phone}`);
      notifications.push(
        twilioClient.messages.create({
          body: `Hey ${matchedGuest.name}. We see you begging outside. It's cute. We're reviewing your plea: "${excuse}". Standby.`,
          from: process.env.TWILIO_PHONE_NUMBER,
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
