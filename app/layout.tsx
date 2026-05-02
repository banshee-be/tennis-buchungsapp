import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "TV Europabad Marbach Platzbuchung",
  description: "Platzbuchung der Tennisanlage Marburg-Marbach"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const clubName = process.env.NEXT_PUBLIC_CLUB_NAME ?? "TV Europabad Marbach";

  return (
    <html lang="de">
      <body>
        <Header clubName={clubName} />
        <main>{children}</main>
        <footer className="site-footer">
          <div>
            <strong>{clubName}</strong>
            <span>Platzbuchung fuer Mitglieder und Gastspieler</span>
          </div>
          <Link href="/admin">Admin-Bereich</Link>
        </footer>
      </body>
    </html>
  );
}
