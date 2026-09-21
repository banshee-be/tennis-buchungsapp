# Tennisplatz-Buchung

Produktionsnahe Next.js-Web-App fuer die Platzbuchung eines Tennisvereins. Die Oberflaeche ist komplett auf Deutsch und trennt Mitglieder von zahlungspflichtigen Gastspielern.

## Funktionen

- Login und Registrierung fuer Mitglieder; Gastbuchungen funktionieren auch ohne Konto.
- Nutzerprofil mit Mitglied/Gastspieler, Rolle und Buchungshistorie.
- Tagesansicht fuer vier Tennisplaetze mit Status: Frei, Belegt, Platz gesperrt, Eigene Buchung.
- Buchungsdauer 30, 60 oder 90 Minuten.
- Serverseitige Verfuegbarkeitspruefung vor jeder Buchung.
- Datenbank-Schutz gegen Doppelbuchungen ueber eindeutige `BookingSlot`-Datensaetze.
- PayPal Checkout fuer externe Gastspieler, inklusive serverseitigem Capture und verifiziertem Webhook.
- Automatische PayPal-Rueckerstattung bei fristgerechter Stornierung oder verspaeteter Zahlung nach Ablauf der Reservierung.
- Vollständige Mitgliederverwaltung mit Stammdaten, Lebenszyklus, Beiträgen, Arbeitsstunden, Schlüsseln, Kommunikation und nuLiga-Verknüpfung.
- Rollen und serverseitige Berechtigungen für Super-Admin, Mitgliederverwaltung, Sportwart, Kassenwart und Platzwart.
- Admin-Bereich für Buchungen, Nutzerstatus, Preise, Öffnungszeiten, Plätze und Sperren.
- Admin-Uebersicht mit Betriebskennzahlen und nachvollziehbarem Aenderungsprotokoll.
- Buchungserinnerungen, Kalenderdateien, fehlertoleranter E-Mail-Versand und automatische Datenbereinigung.
- Datenbankgestuetzter Schutz vor zu vielen Anfragen, auch ueber mehrere Serverinstanzen hinweg.
- Responsive Layout fuer Desktop und Smartphone.

## Tech-Stack

- Next.js App Router
- React
- Node.js API Routes
- Prisma ORM
- PostgreSQL mit Prisma ORM
- PayPal Orders API v2

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
- `PAYPAL_ENVIRONMENT`: `sandbox` fuer Entwicklung, `live` fuer Produktion.
- `PAYPAL_CLIENT_ID`: Client-ID der PayPal REST-App.
- `PAYPAL_CLIENT_SECRET`: Secret der PayPal REST-App.
- `PAYPAL_WEBHOOK_ID`: ID des im PayPal-Dashboard angelegten Webhooks.
- `APP_URL`: oeffentliche URL der App, zum Beispiel `https://buchung.verein.de`.
- `CRON_SECRET`: langer Zufallswert zum Schutz des taeglichen Wartungslaufs.

## PayPal

Die App erstellt fuer Gastspieler serverseitig eine PayPal Order. Die Buchung bleibt 15 Minuten im Status `PENDING` und wird erst nach einem erfolgreichen PayPal Capture bestaetigt. PayPal-Betrag, Waehrung, Order-ID und Buchungs-ID werden serverseitig abgeglichen. Fehlgeschlagene oder abgebrochene Zahlungen geben die reservierten Slots wieder frei. Trifft eine Zahlung erst nach Ablauf der Reservierung ein, wird sie automatisch erstattet.

Webhook-Endpoint:

```text
POST /api/payments/paypal-webhook
```

Im PayPal Developer Dashboard wird zunaechst eine Sandbox-App angelegt. Fuer den Livegang werden Live-Zugangsdaten gesetzt und `PAYPAL_ENVIRONMENT=live` aktiviert.

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

Die App ist bereits fuer PostgreSQL konfiguriert. `DATABASE_URL` muss auf die produktive Datenbank zeigen:

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

## Taegliche Wartung

Vercel ruft einmal taeglich `/api/cron/daily-maintenance` auf. Der Lauf gibt abgelaufene Reservierungen frei, wiederholt fehlgeschlagene Bestaetigungs-E-Mails, sendet Buchungserinnerungen und anonymisiert alte Gastdaten gemaess der Admin-Einstellung. Vercel sendet `CRON_SECRET` automatisch im Authorization-Header; die Variable muss in Production gesetzt sein.

## Sicherheit und Doppelbuchungen

Die App prueft die Verfuegbarkeit nicht nur im Browser, sondern immer erneut im API-Endpunkt. Jede Buchung erzeugt pro kleinem Zeitfenster einen `BookingSlot`. Die Datenbank hat darauf einen eindeutigen Index pro Platz und Slot-Startzeit. Dadurch kann selbst bei parallelen Anfragen nur eine Buchung denselben Platz im selben Zeitfenster belegen.

PayPal-Webhooks werden vor der Verarbeitung ueber PayPals `verify-webhook-signature`-API geprueft. Ereignis-IDs und PayPal Capture-IDs sind eindeutig gespeichert, damit Wiederholungen keine zweite Buchungsbestaetigung ausloesen.

## Mitgliederverwaltung

Die Mitgliederverwaltung befindet sich im Adminbereich unter **Mitglieder**. Dort stehen Suche, Filter, Seitennavigation, CSV-Import/Export, manuelle Anlage und ein mehrteiliges Mitgliederprofil zur Verfügung.

Rollen:

- `ADMIN` und `SUPER_ADMIN`: vollständiger Zugriff; `ADMIN` bleibt aus Kompatibilitätsgründen erhalten.
- `MEMBER_MANAGER`: Stammdaten, Status, Arbeitsstunden, Schlüssel und Exporte.
- `SPORTS_MANAGER`: Mannschafts- und nuLiga-Zuordnungen sowie Buchungen.
- `TREASURER`: Beiträge und Mitgliederexport.
- `COURT_MANAGER`: Buchungen, Plätze und Sperren.
- `USER`: kein Zugriff auf den Adminbereich.

Kritische Aktionen werden serverseitig geprüft und im Audit-Log erfasst. Archivieren ist eine reversible Statusänderung; Mitgliederdaten werden dabei nicht physisch gelöscht. CSV-Ausgaben neutralisieren Formeln, damit Tabellenprogramme keine Inhalte als Befehle ausführen.

### Datenbank-Update

Nach einem Update muss vor dem Start der neuen Version die Migration ausgeführt werden:

```bash
npx prisma migrate deploy
```

Die Migration `20260921000100_member_management` ergänzt Mitgliedsstammdaten sowie Beitrags-, Arbeitsstunden-, Schlüssel- und E-Mail-Historien. Vor einer Produktivmigration sollte wie üblich ein Datenbank-Backup angelegt werden.

### E-Mail-Einladungen

Einladungen und Passwort-Links verwenden dieselbe Resend-Konfiguration wie Buchungsbestätigungen:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `NEXT_PUBLIC_APP_URL` oder `APP_URL`

Jeder Versand wird mit Status, Provider-ID und Fehlertext gespeichert. Wiederholungen innerhalb desselben Verarbeitungsschlüssels werden nicht doppelt versendet.

### Tests

```bash
npm run lint
npm test
npm run build
```

Die Tests decken unter anderem Berechtigungen, Dublettenerkennung, idempotente Mitgliederaktionen und sicheren CSV-Export ab.

## PayPal-Dashboard einrichten

1. Unter **Apps & Credentials** eine REST-App in der Sandbox anlegen.
2. `PAYPAL_CLIENT_ID` und `PAYPAL_CLIENT_SECRET` in der Hosting-Umgebung hinterlegen.
3. Den Webhook `https://DEINE-DOMAIN/api/payments/paypal-webhook` anlegen.
4. Mindestens `CHECKOUT.ORDER.APPROVED`, `CHECKOUT.ORDER.VOIDED`, `PAYMENT.CAPTURE.COMPLETED` und `PAYMENT.CAPTURE.DENIED` abonnieren.
5. Die angezeigte Webhook-ID als `PAYPAL_WEBHOOK_ID` speichern.
6. Sandbox-Zahlung, Abbruch, erneute Webhook-Zustellung und Rueckerstattung testen.
7. Erst danach eine Live-App anlegen, Live-Zugangsdaten setzen und `PAYPAL_ENVIRONMENT=live` aktivieren.
