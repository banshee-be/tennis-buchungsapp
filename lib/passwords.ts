import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

const PASSWORD_ROUNDS = 12;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string) {
  if (password.length < 8) {
    return "Das Passwort muss mindestens 8 Zeichen lang sein.";
  }

  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return "Das Passwort muss mindestens einen Buchstaben und eine Zahl enthalten.";
  }

  return null;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_ROUNDS);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
