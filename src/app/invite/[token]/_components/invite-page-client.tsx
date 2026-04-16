"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users } from "lucide-react";
import { siteConfig } from "@/config";

type Preview =
  | {
      valid: true;
      email: string;
      workspaceName: string;
      inviterName: string | null;
    }
  | {
      valid: false;
      error: string;
    };

type Step = "invite" | "auth-choice";

export default function InvitePageClient({
  token,
  initialPreview,
  serverError,
}: {
  token: string;
  initialPreview: Preview;
  serverError: string | null;
}) {
  const router = useRouter();
  const { data: session } = useSession();

  const [step, setStep] = useState<Step>("invite");
  const [wrongEmailError, setWrongEmailError] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleAcceptInvitation = () => {
    if (!initialPreview.valid) return;

    setIsNavigating(true);

    if (!session?.user) {
      setStep("auth-choice");
      setIsNavigating(false);
      return;
    }

    if (session.user.email.toLowerCase() !== initialPreview.email.toLowerCase()) {
      setWrongEmailError(true);
      setStep("auth-choice");
      setIsNavigating(false);
      return;
    }

    router.push(`/invite/${token}/accept`);
  };

  if (!initialPreview.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex items-center justify-center size-16 rounded-full bg-destructive/10">
                <Users className="size-8 text-destructive" />
              </div>
            </div>
            <CardTitle>Invitation impossible</CardTitle>
            <CardDescription>{initialPreview.error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard">Aller au dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const emailParam = encodeURIComponent(initialPreview.email);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center size-16 rounded-full bg-primary/10">
              <Users className="size-8 text-primary" />
            </div>
          </div>
          <CardTitle>Vous êtes invité(e)</CardTitle>
          <CardDescription>
            <strong>{initialPreview.inviterName ?? "Quelqu'un"}</strong> vous
            invite à rejoindre &quot;
            <strong>{initialPreview.workspaceName}</strong>&quot; sur {siteConfig.name}.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {step === "invite" && (
            <Button onClick={handleAcceptInvitation} disabled={isNavigating} className="w-full">
              Accepter l&apos;invitation
            </Button>
          )}

          {step === "auth-choice" && (
            <>
              {wrongEmailError && (
                <div className="mb-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
                  Vous êtes connecté avec {session?.user?.email} mais cette invitation
                  a été envoyée à {initialPreview.email}.
                </div>
              )}

              {serverError && (
                <div className="mb-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
                  {serverError}
                </div>
              )}

              <p className="text-sm text-muted-foreground text-center">
                Pour continuer, connectez-vous ou créez un compte.
              </p>
              <Button
                variant="outline"
                disabled={isNavigating}
                onClick={() => router.push(`/login?invite=${token}&email=${emailParam}`)}
                className="w-full"
              >
                Se connecter
              </Button>
              <Button
                variant="outline"
                disabled={isNavigating}
                onClick={() => router.push(`/register?invite=${token}&email=${emailParam}`)}
                className="w-full"
              >
                Créer un compte
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}