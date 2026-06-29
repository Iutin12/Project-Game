import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Game",
  description: "Онлайн-платформа party games для компании друзей"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <div className="noise" />
        {children}
      </body>
    </html>
  );
}
