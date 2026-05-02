# Tennisplatz-Buchung

Produktionsnahe Next.js-Web-App fuer die Platzbuchung eines Tennisvereins. Die Oberflaeche ist komplett auf Deutsch und trennt Mitglieder von zahlungspflichtigen Gastspielern.

## Funktionen

- Login und Registrierung mit Name und E-Mail-Adresse.
- Nutzerprofil mit Mitglied/Gastspieler, Rolle und Buchungshistorie.
- Tagesansicht fuer vier Tennisplaetze mit Status: Frei, Belegt, Platz gesperrt, Eigene Buchung.
- Buchungsdauer 30, 60 oder 90 Minuten.
- Serverseitige Verfuegbarkeitspruefung vor jeder Buchung.
- Datenbank-Schutz gegen Doppelbuchungen ueber eindeutige `BookingSlot`-Datensaetze.
- Stripe Checkout fuer externe Gastspieler, inklusive Webhook-Bestaetigung.
- Admin-Bereich fuer Buchungen, Nutzerstatus, Preise, Oeffnungszeiten, Plaetze und Sperren.
- Responsive Layout fuer Desktop und Smartphone.

## Tech-Stack

- Next.js App Router
- React
- Node.js API Routes
- Prisma ORM
- SQLite lokal, PostgreSQL spaeter moeglich
- Stripe Checkout

## Installation

```bash
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Danach ist die App unter `http://localhost:3000` erreichbar.

## Wichtige Umgebungsvariablen

Siehe `.env.example`.

- `AUTH_SECRET`: langer zufaelliger Wert fuer signierte Session-Cookies.
- `ADMIN_EMAILS`: kommaseparierte Liste der Admin-Adressen.
- `EMBEDDED_COOKIE_MODE`: bei echter iframe-Einbettung auf einer anderen Domain `true` setzen. Dann werden Session-Cookies mit `SameSite=None; Secure` gesetzt.
- `DATABASE_URL`: lokal `file:./dev.db`.
- `STRIPE_SECRET_KEY`: Stripe Secret Key.
- `STRIPE_WEBHOOK_SECRET`: Webhook Signing Secret.
- `STRIPE_DEMO_MODE`: lokal `true`, in Produktion `false`.
- `APP_URL`: oeffentliche URL der App, zum Beispiel `https://buchung.verein.de`.

## Stripe

Die App erstellt fuer Gastspieler serverseitig eine Stripe Checkout Session. Die Buchung bleibt bis zur Zahlung im Status `PENDING` und wird erst nach `checkout.session.completed` bestaetigt. Fehlgeschlagene oder abgelaufene Zahlungen geben die reservierten Slots wieder frei.

Webhook-Endpoint:

```text
POST /api/payments/stripe-webhook
```

Lokal kann der Demo-Modus verwendet werden. In Produktion sollte `STRIPE_DEMO_MODE=false` gesetzt und der Stripe Webhook im Dashboard eingetragen werden.

## Beispiel-Daten

Der Seed legt vier Plaetze an:

- Platz 1
- Platz 2
- Platz 3
- Platz 4

Zusaetzlich werden Beispielnutzer angelegt:

- `mitglied@example.org` als Mitglied
- `gast@example.org` als Gastspieler

Adressen aus `ADMIN_EMAILS` werden als Admin und Mitglied angelegt.

## Einbindung in bestehende Webseiten

Die App kann eigenstaendig unter einer Subdomain betrieben werden, zum Beispiel `buchung.tennisverein.de`. Fuer WordPress oder eine klassische HTML-Seite kann sie auch als Modul per `iframe` eingebettet werden:

```html
<iframe
  src="https://buchung.tennisverein.de/buchen"
  title="Tennisplatz buchen"
  style="width: 100%; min-height: 900px; border: 0;"
></iframe>
```

Fuer eine engere Integration kann spaeter eine kleine WordPress-Plugin-Huelle gebaut werden, die diesen iframe per Shortcode ausgibt und die Vereinsfarben zentral konfiguriert.

## PostgreSQL in Produktion

Fuer PostgreSQL in `prisma/schema.prisma` den Datasource-Provider auf `postgresql` setzen und `DATABASE_URL` entsprechend konfigurieren:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Danach Migrationen in der Zielumgebung neu anwenden:

```bash
npx prisma migrate deploy
```

## Sicherheit und Doppelbuchungen

Die App prueft die Verfuegbarkeit nicht nur im Browser, sondern immer erneut im API-Endpunkt. Jede Buchung erzeugt pro kleinem Zeitfenster einen `BookingSlot`. Die Datenbank hat darauf einen eindeutigen Index pro Platz und Slot-Startzeit. Dadurch kann selbst bei parallelen Anfragen nur eine Buchung denselben Platz im selben Zeitfenster belegen.

Stripe-Webhooks verwenden den rohen Request-Body und das `STRIPE_WEBHOOK_SECRET`, damit nur echte Stripe-Ereignisse Buchungen bestaetigen koennen.
