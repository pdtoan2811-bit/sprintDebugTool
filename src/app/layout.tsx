import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Lora } from "next/font/google";
import "./globals.css";
import { DataProvider } from "@/lib/DataProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "vietnamese"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin", "latin-ext", "vietnamese"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sprint Relay Debugger",
  description: "Workflow-aware diagnostics for sprint management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="light" style={{ colorScheme: 'light' }}>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${lora.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        <DataProvider>
          {children}
        </DataProvider>
      </body>
    </html>
  );
}
