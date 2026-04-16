import { Resend } from "resend";
import { siteConfig } from "@/config";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM ?? `${siteConfig.name} <noreply@resend.dev>`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const result = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
  });

  if (result.error) {
    console.error("Email send error:", result.error);
    throw new Error(`Failed to send email: ${result.error.message}`);
  }

  return result;
}

export async function sendInvitationEmail({
  to,
  inviterName,
  workspaceName,
  token,
}: {
  to: string;
  inviterName: string;
  workspaceName: string;
  token: string;
}) {
  const inviteUrl = `${APP_URL}/invite/${token}`;

  return sendEmail({
    to,
    subject: `${inviterName} vous invite à rejoindre "${workspaceName}" sur ${siteConfig.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111;">Vous êtes invité(e)</h2>
        <p style="color: #333;">
          <strong>${inviterName}</strong> vous invite à rejoindre l'espace
          <strong>"${workspaceName}"</strong> sur ${siteConfig.name}.
        </p>
        <p style="color: #666; font-size: 14px;">
          Cliquez sur le bouton ci-dessous pour accepter l'invitation :
        </p>
        <a href="${inviteUrl}"
           style="display: inline-block; background: #111; color: #fff; padding: 12px 24px;
                  border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;
                  color: white;">
          Accepter l'invitation
        </a>
        <p style="color: #999; font-size: 12px;">
          Ce lien expire dans 7 jours.<br/>
          Si vous n'avez pas demandé cette invitation, vous pouvez ignorer ce message.
        </p>
      </div>
    `,
  });
}

export async function sendVerificationEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}) {
  return sendEmail({
    to,
    subject: `Confirmez votre adresse email sur ${siteConfig.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111;">Confirmez votre email</h2>
        <p style="color: #333;">
          Cliquez sur le bouton ci-dessous pour confirmer votre adresse email :
        </p>
        <a href="${url}"
           style="display: inline-block; background: #111; color: #fff; padding: 12px 24px;
                  border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;
                  color: white;">
          Confirmer mon email
        </a>
        <p style="color: #999; font-size: 12px;">
          Si vous n'avez pas créé de compte sur ${siteConfig.name}, ignorez ce message.
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}) {
  return sendEmail({
    to,
    subject: `Réinitialisez votre mot de passe sur ${siteConfig.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111;">Réinitialisation du mot de passe</h2>
        <p style="color: #333;">
          Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe :
        </p>
        <a href="${url}"
           style="display: inline-block; background: #111; color: #fff; padding: 12px 24px;
                  border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;
                  color: white;">
          Réinitialiser le mot de passe
        </a>
        <p style="color: #999; font-size: 12px;">
          Si vous n'avez pas demandé de réinitialisation, ignorez ce message.<br/>
          Ce lien expire dans 1 heure.
        </p>
      </div>
    `,
  });
}
