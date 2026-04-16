"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { signUpWithEmail } from "@/lib/auth-client";
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
import { WalletIcon, Loading03Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { siteConfig } from "@/config";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const prefillEmail = searchParams.get("email") ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState(() => prefillEmail);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signUpWithEmail(email.trim(), password, name.trim());

      if (result.error) {
        toast.error(result.error.message ?? "Inscription impossible");
        setIsLoading(false);
        return;
      }

      if (inviteToken) {
        router.push(`/invite/${inviteToken}/accept`);
        return;
      } else {
        toast.success("Compte créé !");
      }

      router.push("/dashboard");
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
            {inviteToken
              ? "Créez un compte pour accepter l'invitation"
              : "Créez votre compte"}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Créer un compte</CardTitle>
            <CardDescription>
              {inviteToken
                ? `Rejoignez l'espace partagé sur ${siteConfig.name}`
                : "Commencez à suivre vos finances"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Nom</FieldLabel>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Votre nom"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading || !!inviteToken}
                    readOnly={!!inviteToken}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
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
                    <HugeiconsIcon
                      icon={Loading03Icon}
                      className="size-4 animate-spin"
                      data-icon="inline-start"
                    />
                    Création en cours...
                  </>
                ) : inviteToken ? (
                  "Créer un compte et accepter"
                ) : (
                  "Créer un compte"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Vous avez déjà un compte ?{" "}
          <Link
            href={`/login${inviteToken ? `?invite=${inviteToken}&email=${encodeURIComponent(prefillEmail)}` : ""}`}
            className="underline hover:text-foreground"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
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
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="size-8 animate-spin text-muted-foreground"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
