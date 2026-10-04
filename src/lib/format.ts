export function naira(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(value);
}

export function shortDate(ts: number) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(ts);
}

export function dateTime(ts: number) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(ts);
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function uid() {
  return crypto.randomUUID();
}

export function reference(prefix: string) {
  const time = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${time}-${rand}`;
}

export function digits(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizePhone(input: string) {
  let next = input.replace(/\D/g, "");
  if (next.startsWith("234")) next = `0${next.slice(3)}`;
  if (next.length === 10) next = `0${next}`;
  return next;
}

export function isPhone(input: string) {
  return /^0\d{10}$/.test(normalizePhone(input));
}

export function formatPhone(input: string) {
  const phone = normalizePhone(input);
  if (phone.length !== 11) return input;
  return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;
}

export function fullName(person: { firstName: string; middleName?: string; lastName: string }) {
  return [person.firstName, person.middleName, person.lastName].filter(Boolean).join(" ");
}

export function maskAccount(accountNumber: string) {
  const last = accountNumber.slice(-4);
  return `•••• ${last}`;
}

export function maskId(last4: string) {
  return last4 ? `•••••••${last4}` : "Not submitted";
}

export function isAdult(isoDate: string) {
  const dob = new Date(isoDate);
  if (Number.isNaN(dob.getTime())) return false;
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() - 18);
  return dob <= limit;
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function passwordIssue(password: string) {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Use at least 8 characters with a letter and a number.";
  }
  return null;
}

export async function digest(salt: string, value: string) {
  const data = new TextEncoder().encode(`${salt}:${value}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function oneTimeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function deviceLabel() {
  const agent = navigator.userAgent;
  if (/iPhone/.test(agent)) return "iPhone";
  if (/Android/.test(agent)) return "Android";
  if (/Mac/.test(agent)) return "Mac";
  if (/Windows/.test(agent)) return "Windows";
  return "This browser";
}

export function addDays(ts: number, days: number) {
  const date = new Date(ts);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function addMonths(ts: number, months: number) {
  const date = new Date(ts);
  date.setMonth(date.getMonth() + months);
  return date.getTime();
}
