import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CookieBanner } from "@/components/cookie-banner";
import { LocaleProvider } from "@/components/locale-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Geist } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const siteDescription = "Suivi de budget et de comptes bancaires personnel";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Budget & Comptes",
    // S'applique aux pages enfants qui définissent leur propre `title` (ex. "Transactions — Budget & Comptes") ;
    // sans effet sur les pages qui n'exportent pas de `title` (elles gardent `default` ci-dessus).
    template: "%s — Budget & Comptes",
  },
  description: siteDescription,
  openGraph: {
    title: "Budget & Comptes",
    description: siteDescription,
    url: siteUrl,
    siteName: "Budget & Comptes",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Budget & Comptes",
    description: siteDescription,
  },
};

// `viewport-fit=cover` : nécessaire pour que `env(safe-area-inset-*)` soit non nul (barre du bas sur iPhone).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={cn("h-full antialiased", "font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        {/* Anti-FOUC: apply dark class before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
        {/* Anti-FOUC for <html lang>: keeps it in sync with the persisted locale before first paint, same idiom as the theme script above. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem('locale');if(l==='en')document.documentElement.lang='en'}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>
          <LocaleProvider>
            {children}
            <CookieBanner />
          </LocaleProvider>
        </ThemeProvider>
        {/* Web Vitals réels (LCP, INP, TTFB…) collectés en production sur Vercel. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
