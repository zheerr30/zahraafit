import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/Toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MUSCLE STUDIO 3D",
    template: "%s · MUSCLE STUDIO 3D",
  },
  description:
    "Anatomical muscle visualization and illustration studio for coaches, trainers and anatomy educators.",
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-bg text-fg antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
