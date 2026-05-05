"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    setMessage(data.message ?? "Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zuruecksetzen gesendet.");
  }

  return (
    <form className="auth-page-card" onSubmit={submit}>
      <p className="eyebrow">Passwort vergessen</p>
      <h1>Passwort zurücksetzen</h1>
      <p>Gib deine E-Mail-Adresse ein. Wenn ein Konto existiert, senden wir dir einen Link.</p>
      <label>
        E-Mail
        <input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      {message ? <p className="form-success">{message}</p> : null}
      <button className="button primary full" type="submit">
        Link anfordern
      </button>
      <Link className="auth-text-link" href="/buchen">
        Zurück zur Buchung
      </Link>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const response = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, passwordConfirm })
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Das Passwort konnte nicht gesetzt werden.");
      return;
    }

    setMessage(data.message ?? "Das Passwort wurde aktualisiert.");
  }

  return (
    <form className="auth-page-card" onSubmit={submit}>
      <p className="eyebrow">Passwort zurücksetzen</p>
      <h1>Neues Passwort</h1>
      <p>Das Passwort muss mindestens 8 Zeichen haben und eine Zahl enthalten.</p>
      <label>
        Neues Passwort
        <input
          autoComplete="new-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label>
        Passwort wiederholen
        <input
          autoComplete="new-password"
          type="password"
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}
      <button className="button primary full" type="submit" disabled={!token}>
        Passwort speichern
      </button>
      <Link className="auth-text-link" href="/buchen">
        Zur Anmeldung
      </Link>
    </form>
  );
}
