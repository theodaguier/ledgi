import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { auth, prisma } from "@/lib/auth";
import { getHtmlLang, normalizeAppLocale } from "@/lib/locale";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/config";

const geistHeading = Geist({
  subsets: ["latin"],
  variable: "--font-heading",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let locale = normalizeAppLocale(siteConfig.locale);

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session?.user) {
      const userSettings = await prisma.userSettings.findUnique({
        where: { userId: session.user.id },
        select: { locale: true },
      });

      locale = normalizeAppLocale(userSettings?.locale ?? siteConfig.locale);
    }
  } catch {
    locale = normalizeAppLocale(siteConfig.locale);
  }

  return (
    <html
      lang={getHtmlLang(locale)}
      className={`${geistHeading.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="h-full font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
