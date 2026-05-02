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

- Vercel: einfach fuer Next.js, aber fuer produktive Buchungen bitte externe Datenbank nutzen
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

## Befehle

Lokal:

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Production-Build:

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run start
```

Auf einem Server sollte vorher die produktive Datenbank migriert werden:

```bash
npx prisma migrate deploy
npm run build
npm run start
```

## ENV-Variablen

Pflicht fuer Produktion:

```env
APP_URL=https://buchung.tveuropabad-marbach.de
AUTH_SECRET=ein-langer-zufaelliger-geheimer-wert
ADMIN_EMAILS=admin@beispiel.de,vorstand@beispiel.de
DATABASE_URL=...
NEXT_PUBLIC_CLUB_NAME="TV Europabad Marbach"
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

## Datenbank

Aktuell ist das Projekt lokal auf SQLite konfiguriert:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

Fuer lokale Entwicklung ist das gut. Fuer den Livebetrieb sollte eine persistente Datenbank mit Backup genutzt werden. Empfehlenswert ist PostgreSQL. Dafuer muss in `prisma/schema.prisma` der Provider auf `postgresql` umgestellt und `DATABASE_URL` entsprechend gesetzt werden.

SQLite ist nur dann fuer Produktion vertretbar, wenn der Server persistenten Speicher, Backups und keine serverlosen Dateisystem-Limits hat.

## Statischer Export

**Nicht moeglich fuer diese App, ohne wesentliche Funktionen zu verlieren.**

Grund:

- API-Routes werden gebraucht
- Datenbankzugriffe werden gebraucht
- Login/Session wird gebraucht
- Stripe/Webhook wird gebraucht
- Buchungen muessen serverseitig geprueft und gespeichert werden

Es gibt daher keinen empfohlenen FTP-Upload-Ordner wie `out/` oder `dist/`.

## Production-Check vom 2026-05-02

Ausgefuehrt:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Ergebnis:

- TypeScript: erfolgreich
- Lint: erfolgreich
- Production-Build: erfolgreich
- Node-Dependencies waren bereits installiert, daher war kein erneutes `npm install` noetig
- `.env` enthaelt die benoetigten Schluessel fuer lokale Entwicklung
- Keine Debug-`console.log`-Ausgaben im Frontend gefunden

Hinweis:

- Prisma meldet aktuell eine Warnung, dass `package.json#prisma` in Prisma 7 entfernt wird. Das blockiert den Build nicht, sollte aber vor einem spaeteren Prisma-7-Upgrade auf eine `prisma.config.ts` umgestellt werden.

## Offene Punkte vor Livegang

- Produktionsdatenbank festlegen, idealerweise PostgreSQL
- Prisma-Provider fuer PostgreSQL anpassen, falls Vercel/Render/Railway mit externer DB genutzt wird
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
