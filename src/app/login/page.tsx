"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { signInWithEmail } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { HugeiconsIcon } from "@hugeicons/react";
import { WalletIcon } from "@hugeicons/core-free-icons";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { siteConfig } from "@/config";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const prefillEmail = searchParams.get("email") ?? "";

  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const email = (formData.get("email") as string | null)?.trim() ?? "";
    const password = formData.get("password") as string | null ?? "";

    try {
      const result = await signInWithEmail(email, password);

      if (result.error) {
        toast.error(result.error.message ?? "Connexion impossible");
        setIsLoading(false);
        return;
      }

      if (inviteToken) {
        router.push(`/invite/${inviteToken}/accept`);
      } else {
        router.push("/dashboard");
      }
    } catch {
      toast.error("Une erreur est survenue");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={WalletIcon}
              className="size-8 text-foreground"
            />
            <h1 className="text-foreground">{siteConfig.name}</h1>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Connexion à votre compte
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Se connecter</CardTitle>
            <CardDescription>
              {inviteToken
                ? "Acceptez l'invitation après connexion"
                : "Entrez vos identifiants pour accéder à votre espace"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="email@example.com"
                    defaultValue={prefillEmail}
                    required
                    disabled={isLoading}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                  />
                </Field>
              </FieldGroup>

              <Button
                type="submit"
                className="mt-2 w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Connexion...
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Personal finance tracker
        </p>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Vous n&apos;avez pas de compte ?{" "}
          <Link
            href={`/register${inviteToken ? `?invite=${inviteToken}&email=${encodeURIComponent(prefillEmail)}` : ""}`}
            className="underline hover:text-foreground"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="w-full max-w-sm">
            <div className="flex flex-col items-center gap-3 mb-8">
              <div className="flex items-center gap-2">
                <HugeiconsIcon
                  icon={WalletIcon}
                  className="size-8 text-foreground"
                />
                <h1 className="text-foreground">{siteConfig.name}</h1>
              </div>
            </div>
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Spinner className="size-8 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
