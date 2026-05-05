"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type User = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  membershipType: "MEMBER" | "EXTERNAL";
  membershipStatus: "PENDING" | "VERIFIED" | "REJECTED";
  memberNumber?: string | null;
};

type AuthMode = "login" | "register" | "forgot";

const emptyAuthForm = {
  name: "",
  email: "",
  password: "",
  passwordConfirm: "",
  membershipType: "EXTERNAL" as "MEMBER" | "EXTERNAL",
  memberNumber: ""
};

function membershipLabel(user: User) {
  if (user.membershipType === "MEMBER" && user.membershipStatus === "VERIFIED") {
    return "Mitglied";
  }

  if (user.membershipType === "MEMBER" && user.membershipStatus === "PENDING") {
    return "Mitgliedsstatus wird geprüft";
  }

  if (user.membershipType === "MEMBER" && user.membershipStatus === "REJECTED") {
    return "Mitglied abgelehnt";
  }

  return "Gastspieler";
}

export function Header({ clubName }: { clubName: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState("");

  async function loadSession() {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await response.json();
    setUser(data.user);
  }

  useEffect(() => {
    setMounted(true);
    void loadSession();
  }, []);

  useEffect(() => {
    if (!authOpen && !menuOpen) {
      document.body.classList.remove("modal-open");
      return;
    }

    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [authOpen, menuOpen]);

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthOpen(true);
    setMenuOpen(false);
    setMessage("");
  }

  function closeAuth() {
    setAuthOpen(false);
    setMessage("");
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: authForm.email, password: authForm.password })
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Anmeldung nicht möglich.");
      return;
    }

    setUser(data.user);
    setAuthForm(emptyAuthForm);
    closeAuth();
    window.dispatchEvent(new Event("session-changed"));
  }

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authForm)
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Registrierung nicht möglich.");
      return;
    }

    setUser(data.user);
    setAuthForm(emptyAuthForm);
    setMessage(data.message ?? "");
    setAuthOpen(false);
    window.dispatchEvent(new Event("session-changed"));
  }

  async function submitForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: authForm.email })
    });
    const data = await response.json();
    setMessage(data.message ?? "Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen gesendet.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setMenuOpen(false);
    window.dispatchEvent(new Event("session-changed"));
  }

  const navLinks = (
    <>
      <Link href="/buchen" onClick={() => setMenuOpen(false)}>
        Platz buchen
      </Link>
      <Link href="/meine-buchungen" onClick={() => setMenuOpen(false)}>
        Meine Buchungen
      </Link>
      <Link href="/#mitgliedschaft" onClick={() => setMenuOpen(false)}>
        Mitgliedschaft
      </Link>
      <Link href="/#kontakt" onClick={() => setMenuOpen(false)}>
        Kontakt
      </Link>
      {user?.role === "ADMIN" ? (
        <Link href="/admin" onClick={() => setMenuOpen(false)}>
          Admin
        </Link>
      ) : null}
    </>
  );

  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <span className="brand-mark">TV</span>
        <span>
          {clubName}
          <small>Tennisanlage Marburg-Marbach</small>
        </span>
      </Link>

      <nav className="main-nav" aria-label="Hauptnavigation">
        {navLinks}
      </nav>

      <div className="auth-area">
        <div className="desktop-auth">
          {user ? (
            <div className="user-chip">
              <span>
                {user.name}
                <small>{membershipLabel(user)}</small>
              </span>
              <button className="ghost-button" onClick={logout}>
                Abmelden
              </button>
            </div>
          ) : (
            <button className="button secondary small" onClick={() => openAuth("login")}>
              Login
            </button>
          )}
        </div>

        <button
          aria-expanded={menuOpen}
          aria-label="Menü öffnen"
          className="mobile-menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          {user ? user.name.slice(0, 1).toUpperCase() : "☰"}
        </button>

        {mounted && menuOpen
          ? createPortal(
              <div aria-label="Mobiles Menü" aria-modal="true" className="mobile-menu-shell" role="dialog">
            <button aria-label="Menü schließen" className="mobile-menu-backdrop" onClick={() => setMenuOpen(false)} type="button" />
            <div className="mobile-nav-menu">
              <div className="mobile-menu-header">
                <strong>Menü</strong>
                <button aria-label="Menü schließen" onClick={() => setMenuOpen(false)} type="button">
                  ×
                </button>
              </div>
              <div className="mobile-nav-links">{navLinks}</div>
              <div className="mobile-nav-auth">
                {user ? (
                  <>
                    <span>
                      {user.name}
                      <small>{membershipLabel(user)}</small>
                    </span>
                    <button className="ghost-button" onClick={logout} type="button">
                      Abmelden
                    </button>
                  </>
                ) : (
                  <button className="button primary full" onClick={() => openAuth("login")} type="button">
                    Login
                  </button>
                )}
              </div>
            </div>
          </div>,
              document.body
            )
          : null}
      </div>

      {authOpen ? (
        <div aria-modal="true" className="auth-dialog-shell" role="dialog">
          <button aria-label="Dialog schließen" className="auth-dialog-backdrop" onClick={closeAuth} type="button" />
          <div className="auth-dialog-panel">
            <div className="auth-dialog-header">
              <div>
                <span>{authMode === "login" ? "Anmelden" : authMode === "register" ? "Registrieren" : "Passwort vergessen"}</span>
                <strong>TV Europabad Marbach</strong>
              </div>
              <button aria-label="Dialog schließen" onClick={closeAuth} type="button">
                Schließen
              </button>
            </div>

            {authMode === "login" ? (
              <form className="auth-dialog-form" onSubmit={submitLogin}>
                <label>
                  E-Mail
                  <input
                    autoComplete="email"
                    type="email"
                    value={authForm.email}
                    onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                  />
                </label>
                <label>
                  Passwort
                  <input
                    autoComplete="current-password"
                    type="password"
                    value={authForm.password}
                    onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                  />
                </label>
                {message ? <p className="form-error">{message}</p> : null}
                <button className="button primary full" type="submit">
                  Anmelden
                </button>
                <div className="auth-dialog-links">
                  <button onClick={() => openAuth("register")} type="button">
                    Noch kein Konto? Registrieren
                  </button>
                  <button onClick={() => openAuth("forgot")} type="button">
                    Passwort vergessen?
                  </button>
                </div>
              </form>
            ) : null}

            {authMode === "register" ? (
              <form className="auth-dialog-form" onSubmit={submitRegister}>
                <label>
                  Name
                  <input
                    autoComplete="name"
                    value={authForm.name}
                    onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                  />
                </label>
                <label>
                  E-Mail
                  <input
                    autoComplete="email"
                    type="email"
                    value={authForm.email}
                    onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                  />
                </label>
                <div className="auth-choice">
                  <button
                    className={authForm.membershipType === "MEMBER" ? "active" : ""}
                    onClick={() => setAuthForm({ ...authForm, membershipType: "MEMBER" })}
                    type="button"
                  >
                    Mitglied
                  </button>
                  <button
                    className={authForm.membershipType === "EXTERNAL" ? "active" : ""}
                    onClick={() => setAuthForm({ ...authForm, membershipType: "EXTERNAL", memberNumber: "" })}
                    type="button"
                  >
                    Gastspieler
                  </button>
                </div>
                <p className="field-hint">
                  {authForm.membershipType === "MEMBER"
                    ? "Dein Mitgliedsstatus wird vom Verein geprüft."
                    : "Gastspieler können kostenpflichtige Plätze buchen."}
                </p>
                {authForm.membershipType === "MEMBER" ? (
                  <label>
                    Mitgliedsnummer optional
                    <input
                      value={authForm.memberNumber}
                      onChange={(event) => setAuthForm({ ...authForm, memberNumber: event.target.value })}
                    />
                  </label>
                ) : null}
                <label>
                  Passwort
                  <input
                    autoComplete="new-password"
                    type="password"
                    value={authForm.password}
                    onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                  />
                </label>
                <label>
                  Passwort wiederholen
                  <input
                    autoComplete="new-password"
                    type="password"
                    value={authForm.passwordConfirm}
                    onChange={(event) => setAuthForm({ ...authForm, passwordConfirm: event.target.value })}
                  />
                </label>
                {message ? <p className="form-error">{message}</p> : null}
                <button className="button primary full" type="submit">
                  Registrieren
                </button>
                <div className="auth-dialog-links">
                  <button onClick={() => openAuth("login")} type="button">
                    Schon registriert? Anmelden
                  </button>
                </div>
              </form>
            ) : null}

            {authMode === "forgot" ? (
              <form className="auth-dialog-form" onSubmit={submitForgot}>
                <p className="field-hint">Gib deine E-Mail-Adresse ein. Wenn ein Konto existiert, senden wir dir einen Link.</p>
                <label>
                  E-Mail
                  <input
                    autoComplete="email"
                    type="email"
                    value={authForm.email}
                    onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                  />
                </label>
                {message ? <p className="form-success">{message}</p> : null}
                <button className="button primary full" type="submit">
                  Link anfordern
                </button>
                <div className="auth-dialog-links">
                  <button onClick={() => openAuth("login")} type="button">
                    Zur Anmeldung
                  </button>
                  <Link href="/passwort-vergessen" onClick={closeAuth}>
                    Seite öffnen
                  </Link>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
