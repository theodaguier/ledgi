import { redirect } from "next/navigation";
import { acceptInvitation } from "@/actions/workspace";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  try {
    await acceptInvitation(token);
    redirect("/dashboard");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    redirect(`/invite/${token}?error=${encodeURIComponent(message)}`);
  }
}
