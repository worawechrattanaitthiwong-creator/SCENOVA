import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SCENOVA — AI Movie & Series Studio",
  description: "สตูดิโอ AI สำหรับออกแบบหนังและซีรีส์ด้วย Story, Character Lock, Timeline, Cinematic Prompt และ Multi-model Render Planning",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
