"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  membershipStatus: "MEMBER" | "EXTERNAL";
};

export function Header({ clubName }: { clubName: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  async function loadSession() {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await response.json();
    setUser(data.user);
  }

  useEffect(() => {
    void loadSession();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email })
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Login nicht moeglich.");
      return;
    }

    setUser(data.user);
    setOpen(false);
    setName("");
    setEmail("");
    window.dispatchEvent(new Event("session-changed"));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.dispatchEvent(new Event("session-changed"));
  }

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
        <Link href="/buchen">Platz buchen</Link>
        <Link href="/meine-buchungen">Meine Buchungen</Link>
        <Link href="/#mitgliedschaft">Mitgliedschaft</Link>
        <Link href="/#kontakt">Kontakt</Link>
        {user?.role === "ADMIN" ? <Link href="/admin">Admin</Link> : null}
      </nav>

      <div className="auth-area">
        {user ? (
          <div className="user-chip">
            <span>
              {user.name}
              <small>{user.membershipStatus === "MEMBER" ? "Mitglied" : "Gastspieler"}</small>
            </span>
            <button className="ghost-button" onClick={logout}>
              Abmelden
            </button>
          </div>
        ) : (
          <>
            <button className="button secondary small" onClick={() => setOpen((value) => !value)}>
              Login
            </button>
            {open ? (
              <form className="login-popover" onSubmit={submit}>
                <label>
                  Name
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ihr Name" />
                </label>
                <label>
                  E-Mail
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.org"
                  />
                </label>
                {message ? <p className="form-error">{message}</p> : null}
                <button className="button primary full" type="submit">
                  Einloggen / Registrieren
                </button>
              </form>
            ) : null}
          </>
        )}
      </div>
    </header>
  );
}
