import { prisma } from "@/lib/auth";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { siteConfig } from "@/config";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? `${siteConfig.name} <noreply@resend.dev>`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export async function GET(request: Request) {
  // Protect the endpoint with a secret key
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const currentHour = now.getUTCHours();

  try {
    // Find users with reminders enabled who haven't been reminded recently
    const usersWithSettings = await prisma.user.findMany({
      where: {
        settings: {
          remindersEnabled: true,
        },
      },
      select: {
        id: true,
        email: true,
        settings: {
          select: {
            timezone: true,
            reminderIntervalDays: true,
            reminderHour: true,
            lastRemindedAt: true,
          },
        },
      },
    });

    const results: { email: string; sent: boolean; reason?: string }[] = [];

    for (const user of usersWithSettings) {
      const settings = user.settings;
      if (!settings) continue;

      const timezone = settings.timezone || "Europe/London";

      // Get the current hour in the user's timezone
      const nowInTz = new Date(
        now.toLocaleString("en-US", { timeZone: timezone })
      );
      const userHour = nowInTz.getHours();

      // Only send if it's the user's configured hour
      if (userHour !== settings.reminderHour) {
        results.push({
          email: user.email,
          sent: false,
          reason: `Current time in ${timezone} is ${userHour}:00, target is ${settings.reminderHour}:00`,
        });
        continue;
      }

      // Check if enough days have passed since last reminder
      if (settings.lastRemindedAt) {
        const last = new Date(settings.lastRemindedAt);
        const diffDays = Math.floor(
          (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDays < settings.reminderIntervalDays) {
          results.push({
            email: user.email,
            sent: false,
            reason: `Last reminded ${diffDays} days ago, interval is ${settings.reminderIntervalDays}`,
          });
          continue;
        }
      }

      // Send the email
      try {
        await resend.emails.send({
          from: FROM,
          to: user.email,
          subject: `Rappel : importez vos transactions sur ${siteConfig.name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #111;">C'est le moment d'importer vos transactions !</h2>
              <p style="color: #333;">
                Vous avez des transactions en attente d'importation sur <strong>${siteConfig.name}</strong>.
              </p>
              <p style="color: #666; font-size: 14px;">
                Importez vos relevés bancaires pour tenir vos comptes à jour.
              </p>
              <a href="${APP_URL}/import"
                 style="display: inline-block; background: #111; color: #fff; padding: 12px 24px;
                        border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;
                        color: white;">
                Importer mes transactions
              </a>
              <p style="color: #999; font-size: 12px;">
                Vous pouvez configurer la fréquence de ce rappel dans vos paramètres.
              </p>
            </div>
          `,
        });

        // Update lastRemindedAt
        await prisma.userSettings.update({
          where: { userId: user.id },
          data: { lastRemindedAt: now },
        });

        results.push({ email: user.email, sent: true });
      } catch (err) {
        console.error(`Failed to send reminder to ${user.email}:`, err);
        results.push({
          email: user.email,
          sent: false,
          reason: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      status: "ok",
      checked: usersWithSettings.length,
      sent: results.filter((r) => r.sent).length,
      results,
    });
  } catch (error) {
    console.error("Reminder cron failed:", error);
    return NextResponse.json(
      { status: "error", error: String(error) },
      { status: 500 }
    );
  }
}
