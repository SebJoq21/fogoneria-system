import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme";
import { ModulesProvider } from "@/components/dashboard/ModulesProvider";
import { initialPayments } from "@/lib/dashboard";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fogonería — Sitios web para restaurantes",
  description:
    "Creamos, alojamos y mantenemos tu sitio web y carta digital mientras tú te enfocas en cocinar.",
};

const themeScript = `(function(){try{var t=localStorage.getItem('fogoneria:theme');if(t==='dark'){document.documentElement.classList.add('dark')}else if(t==='light'){document.documentElement.classList.remove('dark')}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`h-full antialiased ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeProvider>
          <ModulesProvider initialPayments={initialPayments}>{children}</ModulesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
