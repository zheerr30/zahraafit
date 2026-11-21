import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import { Toaster } from "@/components/ui/Toaster";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MUSCLE STUDIO 3D — استوديو العضلات",
    template: "%s · MUSCLE STUDIO 3D",
  },
  description: "استوديو لتلوين العضلات على نماذج تشريحية ثلاثية الأبعاد وتصدير رسوم توضيحية للمدربين ومعلمي التشريح.",
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className="h-full" suppressHydrationWarning>
      <body className="min-h-full bg-bg text-fg antialiased">
        {/* the theme asked for in the address (?theme=zahraafit), set before the first paint */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
