import { Suspense } from "react";
import type { Metadata } from "next";
import { getInvitationPreview } from "@/actions/workspace";
import InvitePageClient from "./_components/invite-page-client";

export const metadata: Metadata = {
  title: "Invitation",
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const preview = await getInvitationPreview(token);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="w-full max-w-sm animate-pulse">
            <div className="h-48 bg-muted rounded-lg" />
          </div>
        </div>
      }
    >
      <InvitePageClient token={token} initialPreview={preview} serverError={error ?? null} />
    </Suspense>
  );
}
