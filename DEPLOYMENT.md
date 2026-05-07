# Deployment der Tennisplatz-Buchungsapp

Projekt: TV Europabad Marbach / Tennisanlage Marburg-Marbach  
Bestehende Website: https://tveuropabad-marbach.de

## Kurzentscheidung

**Empfohlene Variante: Variante B - separate Buchungsapp auf einer Subdomain**

Empfohlen:

```text
https://buchung.tveuropabad-marbach.de
```

Der WordPress-Menüpunkt **Platz buchen** sollte direkt auf diese Subdomain verlinken.

Ein reiner FTP-Upload in WordPress oder auf klassischen PHP-Webspace reicht fuer diese App nicht aus.

## Warum kein reiner FTP-Upload?

Die App ist keine rein statische HTML-Seite. Sie nutzt:

- Next.js mit App Router
- API-Routes unter `app/api/...`
- serverseitige Buchungslogik
- Login/Session-Cookies
- Prisma-Datenbankzugriffe
- Buchungs- und Admin-APIs
- Zahlungslogik mit Stripe bzw. Demo-Modus
- serverseitige Pruefung gegen Doppelbuchungen

Damit wird ein laufender Server benoetigt. Ein klassischer FTP-Webspace, der nur HTML/CSS/JS/PHP-Dateien ausliefert, kann die Next.js-API-Routes und Prisma-Logik nicht ausfuehren.

## Bewertung der Varianten

### Variante A: Statische Dateien per FTP in WordPress hochladen

**Nicht empfohlen / praktisch nicht geeignet.**

Next.js kann zwar statisch exportieren, aber diese App benoetigt Serverfunktionen. Besonders kritisch:

- `/api/bookings` erstellt Buchungen serverseitig
- `/api/availability` liest echte Verfuegbarkeit aus der Datenbank
- `/api/auth/*` verwaltet Login und Session
- `/api/payments/*` verarbeitet Zahlung und Webhook
- Prisma braucht Zugriff auf eine Datenbank

Ein statischer Export wuerde diese Funktionen verlieren. Es gibt daher keinen sinnvollen `out/`-Ordner, den man fuer diese App per FTP hochladen sollte.

### Variante B: Separate Subdomain

**Empfohlen.**

Die Buchungsapp laeuft eigenstaendig auf einem Node.js-faehigen Hosting:

- Vercel
- Render
- Railway
- Hetzner VPS / Cloud Server
- Docker-Host
- anderer Node.js-Host

WordPress bleibt unveraendert die Vereinswebsite. Im WordPress-Menue wird **Platz buchen** auf die Subdomain gesetzt:

```text
https://buchung.tveuropabad-marbach.de
```

Vorteile:

- volle Next.js-Funktionalitaet
- Login, Buchungen, Admin und Stripe funktionieren sauber
- kein iFrame-Problem mit Cookies, Hoehe oder Stripe
- klare Trennung zwischen Website und Buchungssystem
- einfacher spaeterer Betrieb, Monitoring und Backup

### Variante C: Separate App per iFrame in WordPress einbetten

**Moeglich, aber nur zweite Wahl.**

Die App muss trotzdem separat auf einer Subdomain laufen. WordPress bettet dann nur die laufende App ein.

Beispiel fuer einen WordPress-Custom-HTML-Block:

```html
<iframe
  src="https://buchung.tveuropabad-marbach.de/buchen"
  title="Tennisplatz buchen - TV Europabad Marbach"
  style="width: 100%; min-height: 900px; border: 0; border-radius: 12px;"
  loading="lazy"
></iframe>
```

Nachteile:

- Login-Cookies koennen je nach Browser/Datenschutzeinstellung schwieriger sein
- Mobile Hoehe ist schwer perfekt zu steuern
- Stripe Checkout sollte besser nicht in einem iFrame laufen
- Browser-Zurueck-Button und Scrollverhalten sind weniger sauber
- WordPress darf iFrames je nach Rolle/Editor-Einstellung filtern

Falls iFrame genutzt wird:

```env
APP_URL=https://buchung.tveuropabad-marbach.de
EMBEDDED_COOKIE_MODE=true
```

Ausserdem muss der Hosting-Provider iFrame-Einbettung erlauben, also keine blockierende `X-Frame-Options`- oder `Content-Security-Policy`-Konfiguration setzen.

### Variante D: WordPress-Plugin oder Shortcode

**Nicht empfohlen, ausser als iFrame-Wrapper.**

Ein echtes WordPress-Plugin wuerde bedeuten, dass Login, Buchungslogik, Datenbankmodell, Adminbereich und Stripe-Integration in PHP/WordPress neu implementiert werden. Das waere ein eigenes Projekt.

Realistisch waere nur ein kleiner WordPress-Shortcode, der ein iFrame ausgibt. Die eigentliche App muesste trotzdem separat laufen.

## Empfohlenes Deployment auf Subdomain

### 1. Hosting vorbereiten

Geeignete Optionen:

- Vercel: empfohlen fuer diese Next.js-App, zusammen mit Neon PostgreSQL
- Render/Railway: Node.js-App plus externe Datenbank
- Hetzner VPS: Node.js mit PM2 oder Docker, Datenbank mit Backup
- Docker-Server: App als Container betreiben

### 2. DNS/Subdomain einrichten

Beim Domain-/DNS-Anbieter:

```text
buchung.tveuropabad-marbach.de
```

als CNAME oder A-Record auf den gewaehlten App-Host zeigen lassen.

### 3. WordPress anbinden

Im WordPress-Adminbereich:

1. Design / Menues oeffnen
2. Menuepunkt **Platz buchen** anlegen oder ersetzen
3. Ziel-URL setzen:

```text
https://buchung.tveuropabad-marbach.de
```

Optional kann eine WordPress-Seite "Platz buchen" erstellt werden, die auf die Subdomain weiterleitet oder ein iFrame enthaelt.

## Vercel und Neon PostgreSQL

Das Projekt ist fuer PostgreSQL/Neon konfiguriert:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Die alte SQLite-Migrationshistorie wurde durch eine saubere PostgreSQL-Initialmigration ersetzt:

```text
prisma/migrations/20260503000100_init_postgresql/migration.sql
```

### Neon DATABASE_URL in Vercel setzen

In Vercel:

1. Projekt oeffnen
2. Settings / Environment Variables oeffnen
3. `DATABASE_URL` setzen
4. Neon-Verbindungszeichenfolge eintragen, z. B.:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require
```

5. Variable fuer Production und Preview aktivieren
6. Deployment neu starten

Wichtig: Fuer Neon sollte die URL `sslmode=require` enthalten.

### Migrationen ausfuehren

Vor oder waehrend des Deployments muessen die Prisma-Migrationen gegen Neon ausgefuehrt werden:

```bash
npx prisma migrate deploy
```

Auf Vercel kann der Build Command zum ersten Livegang so gesetzt werden:

```bash
npx prisma migrate deploy && npm run build
```

Alternativ koennen Migrationen manuell oder per CI ausgefuehrt werden. Danach reicht als Build Command:

```bash
npm run build
```

### Beispieldaten einspielen

Die vier Tennisplaetze und Beispielwerte koennen einmalig eingespielt werden:

```bash
npm run db:seed
```

Das Seed-Skript schreibt:

- Platz 1
- Platz 2
- Platz 3
- Platz 4
- Standard-Einstellungen
- Admin-Benutzer aus `ADMIN_EMAILS`

## Befehle

Lokal:

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

Production-Build:

```bash
npm run lint
npx tsc --noEmit
npx prisma generate
npm run build
npm run start
```

Auf Vercel/Server sollte vorher oder im Build die produktive Datenbank migriert werden:

```bash
npx prisma migrate deploy
npm run build
npm run start
```

## ENV-Variablen

Pflicht fuer Produktion:

```env
APP_URL=https://buchung.tveuropabad-marbach.de
NEXT_PUBLIC_APP_URL=https://buchung.tveuropabad-marbach.de
AUTH_SECRET=ein-langer-zufaelliger-geheimer-wert
ADMIN_EMAILS=admin@beispiel.de,vorstand@beispiel.de
DATABASE_URL=...
NEXT_PUBLIC_CLUB_NAME="TV Europabad Marbach"
```

Fuer Neon/Vercel:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require
```

Stripe fuer echte Gastspieler-Zahlungen:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_DEMO_MODE=false
```

Nur fuer Demo/Test:

```env
STRIPE_DEMO_MODE=true
```

Bei iFrame-Einbettung:

```env
EMBEDDED_COOKIE_MODE=true
```

## E-Mail-Versand mit Resend

Die App nutzt Resend fuer:

- Passwort-zuruecksetzen-E-Mails
- Admin-Benachrichtigung bei neuer Registrierung

Einrichtung:

1. Resend-Account erstellen
2. API-Key erzeugen
3. Absenderdomain verifizieren oder einen erlaubten Absender konfigurieren
4. In Vercel unter Settings / Environment Variables setzen:

```env
RESEND_API_KEY=re_...
EMAIL_FROM="TV Europabad Marbach <noreply@deine-domain.de>"
ADMIN_EMAILS=admin@beispiel.de,vorstand@beispiel.de
NEXT_PUBLIC_APP_URL=https://buchung.tveuropabad-marbach.de
```

Danach in Vercel ein neues Deployment ausloesen.

Hinweise:

- `ADMIN_EMAILS` kann mehrere kommagetrennte E-Mail-Adressen enthalten.
- Wenn `RESEND_API_KEY` oder `EMAIL_FROM` fehlen, bricht eine Registrierung nicht ab.
- In Development wird die geplante E-Mail in der Konsole angezeigt.
- In Production wird nur gewarnt, wenn der E-Mail-Versand nicht konfiguriert ist.

## Datenbank

Das Projekt ist auf PostgreSQL konfiguriert und damit passend fuer Neon/Vercel:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Ein reiner SQLite-Betrieb ist fuer Vercel nicht geeignet, weil Vercel serverlos arbeitet und kein persistentes lokales Datenbankfile garantiert. Neon PostgreSQL ist die passende Alternative.

Falls lokal weiterhin ohne Neon entwickelt werden soll, wird eine lokale PostgreSQL-Datenbank benoetigt. Einfacher ist es, lokal ebenfalls eine Neon-Branch-URL in `.env` zu setzen.

Achtung: Wenn in der lokalen `.env` noch `DATABASE_URL="file:./dev.db"` steht, schlagen Prisma- und API-Aufrufe nach der PostgreSQL-Umstellung fehl. Ersetze diesen Wert durch die Neon-URL oder eine lokale PostgreSQL-URL.

## Statischer Export

**Nicht moeglich fuer diese App, ohne wesentliche Funktionen zu verlieren.**

Grund:

- API-Routes werden gebraucht
- Datenbankzugriffe werden gebraucht
- Login/Session wird gebraucht
- Stripe/Webhook wird gebraucht
- Buchungen muessen serverseitig geprueft und gespeichert werden

Es gibt daher keinen empfohlenen FTP-Upload-Ordner wie `out/` oder `dist/`.

## Production-Check vom 2026-05-03

Ausgefuehrt:

```bash
npx prisma generate
npm run build
```

Ergebnis:

- Prisma-Schema ist PostgreSQL-kompatibel
- Prisma Client wurde generiert
- Production-Build wurde mit PostgreSQL-`DATABASE_URL` geprueft
- Fuer lokale Builds muss `DATABASE_URL` auf eine PostgreSQL-Verbindungszeichenfolge zeigen
- Keine Debug-`console.log`-Ausgaben im Frontend gefunden

Hinweis:

- Prisma meldet aktuell eine Warnung, dass `package.json#prisma` in Prisma 7 entfernt wird. Das blockiert den Build nicht, sollte aber vor einem spaeteren Prisma-7-Upgrade auf eine `prisma.config.ts` umgestellt werden.

## Offene Punkte vor Livegang

- Neon-`DATABASE_URL` in Vercel fuer Production und Preview setzen
- PostgreSQL-Migrationen gegen Neon ausfuehren
- Seed-Daten fuer die vier Plaetze einmalig einspielen, falls die Datenbank leer ist
- echte Stripe-Live-Keys setzen
- Stripe-Webhook auf `https://buchung.tveuropabad-marbach.de/api/payments/stripe-webhook` konfigurieren
- `AUTH_SECRET` als langen Zufallswert setzen
- Admin-E-Mail-Adressen final setzen
- Backups fuer Datenbank einrichten
- Datenschutz/Impressum/AGB bzw. Buchungsbedingungen auf der Vereinsseite abstimmen
- Mailversand/E-Mail-Verifizierung ist aktuell nicht produktiv ausgebaut

## Schlussfolgerung

FTP in WordPress moeglich? **Nein, nicht fuer die echte Buchungsapp.**  
Empfohlene Variante: **Variante B - separate Subdomain.**  
iFrame moeglich? **Ja, aber nur als Einbettung einer separat laufenden App.**  
Node.js-Server benoetigt? **Ja.**

## Quellen

- Next.js Static Exports: https://nextjs.org/docs/app/guides/static-exports
- Next.js Self-Hosting: https://nextjs.org/docs/app/guides/self-hosting
- WordPress Custom HTML Block: https://wordpress.org/documentation/article/custom-html-block/
