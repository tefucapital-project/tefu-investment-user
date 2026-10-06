import { AGREEMENTS, ONBOARDING_FEE_AMOUNT, ONBOARDING_FEE_NAME, ONBOARDING_FEE_PURPOSE, WITHDRAWAL_FEE, WITHDRAWAL_FEE_PURPOSE, MAX_DEPOSIT, MIN_DEPOSIT, MIN_WITHDRAWAL } from "./catalog";
import { digest, digits, fullName, isAdult, isEmail, isPhone, naira, normalizePhone, passwordIssue, reference, roundMoney, uid } from "./format";
import { arrangementFee, feePurpose, kycCompletion, lookupOpportunity, maturityFor } from "./selectors";
import type { ActionResult, AppNotification, AppState, BankAccount, ClientDocument, OtpPurpose, PaymentStatus, PersonalInfo, RegisterForm, User, VerifyRecord, VerifyStatus } from "./types";

const OTP_TTL = 5 * 60 * 1000;
const OTP_ATTEMPTS = 5;
const RESEND_WAIT = 30 * 1000;
const LOCK_MS = 2 * 60 * 1000;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}

function blankVerify(): VerifyRecord {
  return { status: "not_started", last4: "", hash: "", reference: "", verifiedAt: null, reason: "" };
}

function blankPersonal(user?: Pick<User, "firstName" | "middleName" | "lastName" | "email" | "phone">): PersonalInfo {
  return {
    firstName: user?.firstName ?? "",
    middleName: user?.middleName ?? "",
    lastName: user?.lastName ?? "",
    dob: "",
    gender: "",
    nationality: "Nigerian",
    phone: user?.phone ?? "",
    email: user?.email ?? "",
    address: "",
    state: "",
    lga: "",
    country: "Nigeria",
  };
}

export function createUserShell(): KycShell {
  return {
    status: "not_started",
    completion: 0,
    submittedAt: null,
    approvedAt: null,
    rejectionReason: "",
    personalComplete: false,
    personal: blankPersonal(),
    nin: blankVerify(),
    bvn: blankVerify(),
    bankAccountId: null,
    document: { status: "not_started", docType: "", name: "", id: "" },
    selfie: { status: "not_started", docType: "Selfie", name: "", id: "" },
    events: [],
  };
}

type KycShell = User["kyc"];

function userById(state: AppState, id: string | null) {
  if (!id) return null;
  return state.users.find((item) => item.id === id) ?? null;
}

function signedIn(state: AppState) {
  const user = userById(state, state.currentUserId);
  if (!user) return null;
  return user;
}

function syncWallet(user: User) {
  user.wallet.balance = roundMoney(user.wallet.available + user.wallet.locked);
}

function note(state: AppState, userId: string, category: AppNotification["category"], type: string, title: string, message: string) {
  state.notifications.unshift({
    id: uid(),
    userId,
    category,
    type,
    title,
    message,
    read: false,
    createdAt: Date.now(),
  });
  state.notifications = state.notifications.slice(0, 80);
}

function addTx(
  state: AppState,
  input: {
    userId: string;
    type: AppState["transactions"][number]["type"];
    amount: number;
    reference: string;
    status: PaymentStatus;
    description: string;
    direction: "credit" | "debit" | "neutral";
  },
) {
  state.transactions.unshift({ id: uid(), createdAt: Date.now(), ...input });
}

function issueOtp(state: AppState, userId: string, purpose: OtpPurpose, otp: { hash: string; salt: string; preview: string }) {
  state.challenges = state.challenges.filter((item) => !(item.userId === userId && item.purpose === purpose));
  state.challenges.unshift({
    id: uid(),
    userId,
    purpose,
    codeHash: otp.hash,
    salt: otp.salt,
    previewCode: otp.preview,
    expiresAt: Date.now() + OTP_TTL,
    attempts: 0,
    maxAttempts: OTP_ATTEMPTS,
    createdAt: Date.now(),
  });
}

function openSession(state: AppState, userId: string, device: string) {
  const session = {
    id: uid(),
    userId,
    device,
    ipLabel: "Local session",
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_MS,
  };
  state.sessions.unshift(session);
  state.currentUserId = userId;
  state.currentSessionId = session.id;
  state.pending2faUserId = null;
  return session.id;
}

function refreshKyc(user: User) {
  user.kyc.completion = kycCompletion(user);
  if (user.status === "active" || user.status === "suspended" || user.kyc.status === "approved") return;
  if (!user.feePaidAt) {
    user.status = "kyc_locked";
    user.kyc.status = "not_started";
    return;
  }
  const needsUpdate = [user.kyc.nin.status, user.kyc.bvn.status].includes("failed")
    || [user.kyc.nin.status, user.kyc.bvn.status].includes("requires_update")
    || user.banks.some((item) => item.id === user.kyc.bankAccountId && (item.status === "failed" || item.status === "requires_update"));
  user.status = "kyc_in_progress";
  user.kyc.status = needsUpdate ? "requires_update" : "in_progress";
}

function activeReady(user: User) {
  if (user.status === "suspended") return "This account is suspended.";
  if (user.status !== "active" || user.kyc.status !== "approved") return "Your account must be active and KYC approved.";
  return null;
}

export function registerUser(
  state: AppState,
  form: RegisterForm,
  secrets: { passwordSalt: string; passwordHash: string },
  device: string,
): ActionResult<{ sessionId: string }> {
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  const email = form.email.trim().toLowerCase();
  const phone = normalizePhone(form.phone);
  if (!firstName || !lastName) return fail("Enter your first and last name.");
  if (!isEmail(email)) return fail("Enter a valid email address.");
  if (!isPhone(phone)) return fail("Enter a valid Nigerian phone number.");
  const passwordError = passwordIssue(form.password);
  if (passwordError) return fail(passwordError);
  if (form.password !== form.confirmPassword) return fail("Passwords do not match.");
  if (!form.acceptTerms || !form.acceptPrivacy) return fail("Accept the Terms & Conditions and the Privacy Policy to continue.");
  if (form.referralCode.trim() && !/^[A-Za-z0-9-]{4,16}$/.test(form.referralCode.trim())) {
    return fail("Referral codes use 4 to 16 letters or numbers.");
  }
  if (state.users.some((item) => item.email === email)) return fail("An account with this email already exists.");
  if (state.users.some((item) => item.phone === phone)) return fail("An account with this phone number already exists.");

  const now = Date.now();
  const user: User = {
    id: uid(),
    firstName,
    middleName: form.middleName.trim(),
    lastName,
    email,
    phone,
    passwordHash: secrets.passwordHash,
    passwordSalt: secrets.passwordSalt,
    referralCode: form.referralCode.trim(),
    termsAcceptedAt: now,
    privacyAcceptedAt: now,
    status: "kyc_locked",
    createdAt: now,
    otpVerifiedAt: now,
    feePaidAt: null,
    activatedAt: null,
    pinHash: null,
    pinSalt: null,
    pinFails: 0,
    pinLockedUntil: 0,
    twoFactor: false,
    profile: { photo: null },
    kyc: { ...createUserShell(), personal: blankPersonal({ firstName, middleName: form.middleName.trim(), lastName, email, phone }) },
    banks: [],
    wallet: { balance: 0, available: 0, locked: 0 },
    notifPrefs: { account: true, payments: true, investments: true, security: true },
  };
  state.users.unshift(user);
  const sessionId = openSession(state, user.id, device);
  note(state, user.id, "account", "registration", "Account created", "The next step is the Client Onboarding Fee. KYC stays locked until that payment is successful.");
  state.acceptances.unshift({
    id: uid(),
    userId: user.id,
    agreementId: AGREEMENTS.terms.id,
    agreementType: AGREEMENTS.terms.type,
    version: AGREEMENTS.terms.version,
    investmentId: null,
    acceptedAt: now,
    reference: reference("TRM"),
    status: "accepted",
  });
  state.acceptances.unshift({
    id: uid(),
    userId: user.id,
    agreementId: AGREEMENTS.privacy.id,
    agreementType: AGREEMENTS.privacy.type,
    version: AGREEMENTS.privacy.version,
    investmentId: null,
    acceptedAt: now,
    reference: reference("PRV"),
    status: "accepted",
  });
  return ok({ sessionId });
}

export function resendOtp(
  state: AppState,
  purpose: OtpPurpose,
  userId: string,
  otp: { hash: string; salt: string; preview: string },
): ActionResult {
  const existing = state.challenges.find((item) => item.userId === userId && item.purpose === purpose);
  if (existing && existing.expiresAt > Date.now() && Date.now() - existing.createdAt < RESEND_WAIT) {
    return fail("Wait a few seconds before requesting another code.");
  }
  issueOtp(state, userId, purpose, otp);
  note(state, userId, "account", "otp", "A new code was issued", "The previous code can no longer be used.");
  return ok();
}

export function verifyOtp(state: AppState, codeHash: string, device: string): ActionResult<{ sessionId?: string }> {
  const registering = userById(state, state.currentUserId);
  const purpose: OtpPurpose = registering?.status === "otp_pending" ? "register" : "login_2fa";
  const userId = purpose === "register" ? state.currentUserId : state.pending2faUserId;
  const user = userById(state, userId);
  if (!user) return fail("Request a new verification code.");
  const challenge = state.challenges.find((item) => item.userId === user.id && item.purpose === purpose);
  if (!challenge) return fail("Request a new verification code.");
  if (challenge.expiresAt < Date.now()) return fail("This code has expired. Request a new one.");
  if (challenge.attempts >= challenge.maxAttempts) return fail("Too many incorrect attempts. Request a new code.");
  if (challenge.codeHash !== codeHash) {
    challenge.attempts += 1;
    const left = challenge.maxAttempts - challenge.attempts;
    return fail(left > 0 ? `That code is incorrect. ${left} attempt${left === 1 ? "" : "s"} remaining.` : "Too many incorrect attempts. Request a new code.");
  }
  state.challenges = state.challenges.filter((item) => item.id !== challenge.id);
  if (purpose === "register") {
    user.status = "kyc_locked";
    user.otpVerifiedAt = Date.now();
    user.kyc.status = "not_started";
    note(state, user.id, "account", "otp", "Email and phone verified", "The next step is the Client Onboarding Fee. KYC stays locked until that payment is successful.");
    return ok({});
  }
  const sessionId = openSession(state, user.id, device);
  note(state, user.id, "security", "2fa", "Signed in with a second code", "A new session was opened on this device.");
  return ok({ sessionId });
}

export function loginUser(
  state: AppState,
  emailRaw: string,
  passwordHash: string,
  matched: boolean,
  device: string,
  otp?: { hash: string; salt: string; preview: string },
): ActionResult<{ twoFactor: boolean; sessionId?: string }> {
  const email = emailRaw.trim().toLowerCase();
  const attempt = state.loginAttempts[email];
  if (attempt && attempt.lockedUntil > Date.now()) return fail("Too many sign-in attempts. Try again in a few minutes.");
  const user = state.users.find((item) => item.email === email);
  if (!user || !matched || user.passwordHash !== passwordHash) {
    const count = (attempt?.count ?? 0) + 1;
    state.loginAttempts[email] = { count: count >= 5 ? 0 : count, lockedUntil: count >= 5 ? Date.now() + LOCK_MS : 0 };
    return fail(count >= 5 ? "Too many sign-in attempts. Try again in a few minutes." : "Email or password is incorrect.");
  }
  if (user.status === "suspended") return fail("This account is suspended.");
  state.loginAttempts[email] = { count: 0, lockedUntil: 0 };
  if (user.twoFactor) {
    if (!otp) return fail("A verification code is required.");
    state.pending2faUserId = user.id;
    state.currentUserId = null;
    state.currentSessionId = null;
    issueOtp(state, user.id, "login_2fa", otp);
    return ok({ twoFactor: true });
  }
  const sessionId = openSession(state, user.id, device);
  return ok({ twoFactor: false, sessionId });
}

export function logoutUser(state: AppState): ActionResult {
  if (state.currentSessionId) state.sessions = state.sessions.filter((item) => item.id !== state.currentSessionId);
  state.currentUserId = null;
  state.currentSessionId = null;
  return ok();
}

export function logoutOthers(state: AppState): ActionResult {
  const user = signedIn(state);
  if (!user || !state.currentSessionId) return fail("Sign in to continue.");
  state.sessions = state.sessions.filter((item) => item.id === state.currentSessionId || item.userId !== user.id);
  note(state, user.id, "security", "sessions", "Other sessions were signed out", "This device remains signed in.");
  return ok();
}

export function requestReset(state: AppState, emailRaw: string, otp: { hash: string; salt: string; preview: string } | null): ActionResult {
  const email = emailRaw.trim().toLowerCase();
  if (!isEmail(email)) return fail("Enter a valid email address.");
  const user = state.users.find((item) => item.email === email);
  if (!user || !otp) return fail("No account uses that email.");
  state.passwordResetUserId = user.id;
  issueOtp(state, user.id, "reset", otp);
  return ok();
}

export function resetPassword(
  state: AppState,
  codeHash: string,
  secrets: { salt: string; hash: string },
): ActionResult {
  const user = userById(state, state.passwordResetUserId);
  if (!user) return fail("Request a new reset code.");
  const challenge = state.challenges.find((item) => item.userId === user.id && item.purpose === "reset");
  if (!challenge) return fail("Request a new reset code.");
  if (challenge.expiresAt < Date.now()) return fail("This code has expired. Request a new one.");
  if (challenge.attempts >= challenge.maxAttempts) return fail("Too many incorrect attempts. Request a new code.");
  if (challenge.codeHash !== codeHash) {
    challenge.attempts += 1;
    return fail("That code is incorrect.");
  }
  user.passwordSalt = secrets.salt;
  user.passwordHash = secrets.hash;
  state.challenges = state.challenges.filter((item) => item.userId !== user.id || item.purpose !== "reset");
  state.sessions = state.sessions.filter((item) => item.userId !== user.id);
  state.passwordResetUserId = null;
  if (state.currentUserId === user.id) {
    state.currentUserId = null;
    state.currentSessionId = null;
  }
  note(state, user.id, "security", "password", "Password reset", "Sign in with your new password.");
  return ok();
}

export function changePassword(state: AppState, currentHash: string, next: { salt: string; hash: string }, matched: boolean): ActionResult {
  const user = signedIn(state);
  if (!user) return fail("Sign in to continue.");
  if (!matched || user.passwordHash !== currentHash) return fail("The current password is incorrect.");
  user.passwordSalt = next.salt;
  user.passwordHash = next.hash;
  state.sessions = state.sessions.filter((item) => item.id === state.currentSessionId || item.userId !== user.id);
  note(state, user.id, "security", "password", "Password changed", "Other devices were signed out.");
  return ok();
}

export function setPin(state: AppState, pinOk: boolean, next: { salt: string; hash: string } | null, hasCurrent: boolean): ActionResult {
  const user = signedIn(state);
  if (!user) return fail("Sign in to continue.");
  if (user.pinLockedUntil > Date.now()) return fail("Your PIN is temporarily locked. Try again in a few minutes.");
  if (hasCurrent && !pinOk) {
    user.pinFails += 1;
    if (user.pinFails >= 5) {
      user.pinFails = 0;
      user.pinLockedUntil = Date.now() + LOCK_MS;
      return fail("Too many incorrect PIN attempts. Try again in a few minutes.");
    }
    return fail("The current PIN is incorrect.");
  }
  if (!next) return fail("Enter a 4-digit PIN.");
  user.pinHash = next.hash;
  user.pinSalt = next.salt;
  user.pinFails = 0;
  user.pinLockedUntil = 0;
  note(state, user.id, "security", "pin", "Transaction PIN updated", "Use this PIN to confirm investments and withdrawals.");
  return ok();
}

export function setTwoFactor(state: AppState, enabled: boolean, matched: boolean): ActionResult {
  const user = signedIn(state);
  if (!user) return fail("Sign in to continue.");
  if (!matched) return fail("The password is incorrect.");
  user.twoFactor = enabled;
  note(state, user.id, "security", "2fa", enabled ? "Two-factor sign-in is on" : "Two-factor sign-in is off", enabled ? "The next sign-in will ask for a code." : "Sign-in will use your password only.");
  return ok();
}

export function payOnboardingFee(
  state: AppState,
  method: string,
  outcome: PaymentStatus,
  paymentReference: string,
): ActionResult<{ reference: string }> {
  const user = signedIn(state);
  if (!user) return fail("Sign in to continue.");
  if (user.feePaidAt) return fail("The Client Onboarding Fee has already been paid.");
  if (!method.trim()) return fail("Choose a payment method.");
  const allowed: PaymentStatus[] = ["successful", "failed", "pending", "processing"];
  if (!allowed.includes(outcome)) return fail("That payment result is not available.");
  const ref = paymentReference || reference("COF");
  const now = Date.now();
  state.fees.unshift({
    id: uid(),
    userId: user.id,
    feeType: "client_onboarding_fee",
    name: ONBOARDING_FEE_NAME,
    amount: ONBOARDING_FEE_AMOUNT,
    status: outcome,
    paymentMethod: method,
    reference: ref,
    purpose: ONBOARDING_FEE_PURPOSE,
    createdAt: now,
    paidAt: outcome === "successful" ? now : null,
  });
  addTx(state, {
    userId: user.id,
    type: "client_onboarding_fee",
    amount: ONBOARDING_FEE_AMOUNT,
    reference: ref,
    status: outcome,
    description: `${ONBOARDING_FEE_NAME}. Paid outside the wallet. ${ONBOARDING_FEE_PURPOSE}`,
    direction: "neutral",
  });
  if (outcome === "successful") {
    user.feePaidAt = now;
    user.status = "kyc_in_progress";
    user.kyc.status = "in_progress";
    user.kyc.events.push({ status: "KYC Unlocked", at: now, note: "The Client Onboarding Fee was successful, so KYC can begin." });
    note(state, user.id, "payments", "fee", "Client Onboarding Fee received", "KYC verification is now unlocked.");
  } else {
    user.status = "kyc_locked";
    user.kyc.status = "not_started";
    note(state, user.id, "payments", "fee", `Client Onboarding Fee ${outcome}`, "KYC stays locked until a payment is successful.");
  }
  return ok({ reference: ref });
}

export function savePersonal(state: AppState, info: PersonalInfo): ActionResult {
  const user = signedIn(state);
  if (!user) return fail("Sign in to continue.");
  if (!user.feePaidAt) return fail("Complete your Client Onboarding Fee payment to begin KYC verification.");
  const next = {
    ...info,
    firstName: info.firstName.trim(),
    middleName: info.middleName.trim(),
    lastName: info.lastName.trim(),
    email: info.email.trim().toLowerCase(),
    phone: normalizePhone(info.phone),
    address: info.address.trim(),
    state: info.state.trim(),
    lga: info.lga.trim(),
    country: "Nigeria",
    nationality: info.nationality.trim(),
    gender: info.gender.trim(),
  };
  if (!next.firstName || !next.lastName) return fail("Enter your legal first and last name.");
  if (!isAdult(next.dob)) return fail("You need to be at least 18 years old.");
  if (!next.gender) return fail("Select a gender.");
  if (!next.nationality) return fail("Enter your nationality.");
  if (!isPhone(next.phone)) return fail("Enter a valid Nigerian phone number.");
  if (!isEmail(next.email)) return fail("Enter a valid email address.");
  if (next.address.length < 5) return fail("Enter your residential address.");
  if (!next.state || !next.lga) return fail("Enter your state and LGA.");
  if (state.users.some((item) => item.id !== user.id && item.email === next.email)) return fail("That email is already in use.");
  if (state.users.some((item) => item.id !== user.id && item.phone === next.phone)) return fail("That phone number is already in use.");
  const identityLocked = user.kyc.nin.status === "verified" || user.kyc.bvn.status === "verified";
  if (identityLocked && (next.firstName !== user.firstName || next.middleName !== user.middleName || next.lastName !== user.lastName)) {
    return fail("Verified identity names cannot be edited. Contact support if a correction is required.");
  }
  user.firstName = next.firstName;
  user.middleName = next.middleName;
  user.lastName = next.lastName;
  user.email = next.email;
  user.phone = next.phone;
  user.kyc.personal = next;
  user.kyc.personalComplete = true;
  refreshKyc(user);
  return ok();
}

function identityResult(kind: "NIN" | "BVN", value: string, user: User): { status: VerifyStatus; reason: string } {
  if (digits(value).length !== 11) return { status: "failed", reason: `Enter the 11-digit ${kind}.` };
  if (!user.kyc.personalComplete) return { status: "failed", reason: "Complete personal information before this check." };
  if (kind === "NIN" && value.startsWith("000")) return { status: "failed", reason: "We could not verify this NIN. Check the number and try again." };
  if (kind === "BVN" && value.startsWith("999")) return { status: "failed", reason: "We could not verify this BVN. Check the number and try again." };
  if (kind === "NIN" && value.endsWith("1111")) {
    return { status: "requires_update", reason: "The name returned for this NIN does not match your profile." };
  }
  if (kind === "BVN" && value.endsWith("2222")) {
    return { status: "requires_update", reason: "The name returned for this BVN does not match your profile." };
  }
  const returned = fullName(user);
  return { status: "verified", reason: `Verified. The returned name matches your profile (${returned}).` };
}

export function submitNin(state: AppState, nin: string, hash: string): ActionResult {
  const user = signedIn(state);
  if (!user) return fail("Sign in to continue.");
  if (!user.feePaidAt) return fail("Complete your Client Onboarding Fee payment to begin KYC verification.");
  if (!user.kyc.personalComplete) return fail("Complete personal information before NIN verification.");
  if (user.kyc.nin.status === "verified") return fail("NIN is already verified and cannot be edited here.");
  const clean = digits(nin);
  if (clean.length !== 11) return fail("Enter the 11-digit NIN.");
  const result = identityResult("NIN", clean, user);
  const now = Date.now();
  user.kyc.nin = {
    status: result.status,
    last4: clean.slice(-4),
    hash,
    reference: reference("NIN"),
    verifiedAt: result.status === "verified" ? now : null,
    reason: result.reason,
  };
  refreshKyc(user);
  note(state, user.id, "account", "nin", `NIN ${result.status === "verified" ? "verified" : "needs attention"}`, result.reason);
  return result.status === "verified" ? ok() : fail(result.reason);
}

export function submitBvn(state: AppState, bvn: string, hash: string): ActionResult {
  const user = signedIn(state);
  if (!user) return fail("Sign in to continue.");
  if (!user.feePaidAt) return fail("Complete your Client Onboarding Fee payment to begin KYC verification.");
  if (!user.kyc.personalComplete) return fail("Complete personal information before BVN verification.");
  if (user.kyc.bvn.status === "verified") return fail("BVN is already verified and cannot be edited here.");
  const clean = digits(bvn);
  if (clean.length !== 11) return fail("Enter the 11-digit BVN.");
  const result = identityResult("BVN", clean, user);
  const now = Date.now();
  user.kyc.bvn = {
    status: result.status,
    last4: clean.slice(-4),
    hash,
    reference: reference("BVN"),
    verifiedAt: result.status === "verified" ? now : null,
    reason: result.reason,
  };
  refreshKyc(user);
  note(state, user.id, "account", "bvn", `BVN ${result.status === "verified" ? "verified" : "needs attention"}`, result.reason);
  return result.status === "verified" ? ok() : fail(result.reason);
}

export function saveBank(
  state: AppState,
  input: { bankName: string; accountNumber: string; accountName: string; id?: string },
): ActionResult {
  const user = signedIn(state);
  if (!user) return fail("Sign in to continue.");
  if (!user.feePaidAt) return fail("Complete your Client Onboarding Fee payment to begin KYC verification.");
  const accountNumber = digits(input.accountNumber);
  const accountName = input.accountName.trim();
  const bankName = input.bankName.trim();
  if (!bankName) return fail("Select a bank.");
  if (accountNumber.length !== 10) return fail("Enter the 10-digit account number.");
  if (accountName.length < 3) return fail("Enter the account name.");
  if (user.banks.some((item) => item.accountNumber === accountNumber && item.id !== input.id)) return fail("That account is already on your profile.");
  const first = user.firstName.toLowerCase();
  const last = user.lastName.toLowerCase();
  const hay = accountName.toLowerCase();
  let status: VerifyStatus = "verified";
  let reason = "Verified. This account can be used for withdrawals.";
  if (accountNumber.startsWith("0000")) {
    status = "failed";
    reason = "This account could not be confirmed with the bank.";
  } else if (!hay.includes(first) || !hay.includes(last)) {
    status = "failed";
    reason = "The account name does not match the name on your profile.";
  }
  const record: BankAccount = {
    id: input.id || uid(),
    bankName,
    accountNumber,
    accountName,
    status,
    reason,
    primary: true,
    reference: reference("BNK"),
  };
  user.banks = user.banks.map((item) => ({ ...item, primary: false }));
  const index = user.banks.findIndex((item) => item.id === record.id);
  if (index >= 0) user.banks[index] = record;
  else user.banks.unshift(record);
  user.kyc.bankAccountId = record.id;
  refreshKyc(user);
  note(state, user.id, "account", "bank", status === "verified" ? "Bank account verified" : "Bank account needs attention", reason);
  return status === "verified" ? ok() : fail(reason);
}

function storeFile(state: AppState, userId: string, doc: Omit<ClientDocument, "id" | "createdAt" | "userId"> & { id?: string }) {
  const record: ClientDocument = {
    id: doc.id || uid(),
    userId,
    category: doc.category,
    docType: doc.docType,
    name: doc.name,
    body: doc.body,
    dataUrl: doc.dataUrl,
    status: doc.status,
    reference: doc.reference,
    createdAt: Date.now(),
  };
  state.documents = [record, ...state.documents.filter((item) => item.id !== record.id)];
  return record;
}

export function saveDocument(state: AppState, input: { docType: string; name: string; dataUrl: string | null }): ActionResult {
  const user = signedIn(state);
  if (!user) return fail("Sign in to continue.");
  if (!user.feePaidAt) return fail("Complete your Client Onboarding Fee payment to begin KYC verification.");
  if (!input.docType) return fail("Choose the identification type.");
  if (!input.name) return fail("Choose a file to upload.");
  const existing = user.kyc.document.id;
  const record = storeFile(state, user.id, {
    id: existing || undefined,
    category: "identification",
    docType: input.docType,
    name: input.name,
    body: "",
    dataUrl: input.dataUrl,
    status: "submitted",
    reference: reference("DOC"),
  });
  user.kyc.document = { status: "submitted", docType: input.docType, name: input.name, id: record.id };
  refreshKyc(user);
  return ok();
}

export function saveSelfie(state: AppState, input: { name: string; dataUrl: string | null }): ActionResult {
  const user = signedIn(state);
  if (!user) return fail("Sign in to continue.");
  if (!user.feePaidAt) return fail("Complete your Client Onboarding Fee payment to begin KYC verification.");
  if (!input.name) return fail("Choose an identity photo.");
  const record = storeFile(state, user.id, {
    id: user.kyc.selfie.id || undefined,
    category: "kyc",
    docType: "Selfie",
    name: input.name,
    body: "",
    dataUrl: input.dataUrl,
    status: "submitted",
    reference: reference("IMG"),
  });
  user.kyc.selfie = { status: "submitted", docType: "Selfie", name: input.name, id: record.id };
  refreshKyc(user);
  return ok();
}

export function submitKyc(state: AppState): ActionResult {
  const user = signedIn(state);
  if (!user) return fail("Sign in to continue.");
  if (!user.feePaidAt) return fail("Complete your Client Onboarding Fee payment to begin KYC verification.");
  refreshKyc(user);
  const bank = user.banks.find((item) => item.id === user.kyc.bankAccountId);
  if (!user.kyc.personalComplete) return fail("Personal information is incomplete.");
  if (user.kyc.nin.status !== "verified") return fail("NIN verification is required before KYC can be approved.");
  if (user.kyc.bvn.status !== "verified") return fail("BVN verification is required before KYC can be approved.");
  if (bank?.status !== "verified") return fail("A verified bank account is required before KYC can be approved.");
  if (user.kyc.document.status === "not_started") return fail("Upload an identification document.");
  if (user.kyc.selfie.status === "not_started") return fail("Upload an identity photo.");
  const now = Date.now();
  user.kyc.submittedAt = now;
  user.kyc.events.push({ status: "Pending Review", at: now, note: "All required KYC information was submitted." });
  user.kyc.status = "approved";
  user.kyc.approvedAt = now;
  user.kyc.completion = 100;
  user.kyc.rejectionReason = "";
  user.kyc.document.status = "verified";
  user.kyc.selfie.status = "verified";
  user.status = "active";
  user.activatedAt = now;
  user.kyc.events.push({
    status: "Approved",
    at: now,
    note: "NIN, BVN, bank, and documents passed. This user MVP approves a complete file immediately because compliance review sits outside this version.",
  });
  const doc = state.documents.find((item) => item.id === user.kyc.document.id);
  const selfie = state.documents.find((item) => item.id === user.kyc.selfie.id);
  if (doc) doc.status = "verified";
  if (selfie) selfie.status = "verified";
  note(state, user.id, "account", "kyc", "KYC approved", "Your investment account is active. Fund your wallet when you are ready to invest.");
  return ok();
}

export function createDeposit(state: AppState, amount: number, method: string, outcome: "successful" | "failed"): ActionResult<{ reference: string }> {
  const user = signedIn(state);
  if (!user) return fail("Sign in to continue.");
  const gate = activeReady(user);
  if (gate) return fail(gate);
  if (!method) return fail("Choose a payment method.");
  if (amount < MIN_DEPOSIT || amount > MAX_DEPOSIT) return fail(`Enter an amount between ${MIN_DEPOSIT.toLocaleString("en-NG")} and ${MAX_DEPOSIT.toLocaleString("en-NG")}.`);
  const ref = reference("DEP");
  state.deposits.unshift({ id: uid(), userId: user.id, amount, paymentMethod: method, reference: ref, status: outcome, createdAt: Date.now() });
  if (outcome === "successful") {
    user.wallet.available = roundMoney(user.wallet.available + amount);
    syncWallet(user);
  }
  addTx(state, {
    userId: user.id,
    type: "deposit",
    amount,
    reference: ref,
    status: outcome,
    description: outcome === "successful" ? "Wallet deposit confirmed" : "Wallet deposit failed. The wallet was not credited.",
    direction: outcome === "successful" ? "credit" : "neutral",
  });
  note(state, user.id, "payments", "deposit", outcome === "successful" ? "Deposit successful" : "Deposit failed", outcome === "successful" ? `${naira(amount)} was added to your available balance.` : "The wallet was not credited.");
  return ok({ reference: ref });
}

function applyPin(user: User, pinOk: boolean, nextPin: { salt: string; hash: string } | null): ActionResult<never> | null {
  if (user.pinLockedUntil > Date.now()) return fail("Your PIN is temporarily locked. Try again in a few minutes.");
  if (!pinOk) {
    user.pinFails += 1;
    if (user.pinFails >= 5) {
      user.pinFails = 0;
      user.pinLockedUntil = Date.now() + LOCK_MS;
      return fail("Too many incorrect PIN attempts. Try again in a few minutes.");
    }
    return fail("Incorrect transaction PIN.");
  }
  user.pinFails = 0;
  user.pinLockedUntil = 0;
  if (nextPin) {
    user.pinHash = nextPin.hash;
    user.pinSalt = nextPin.salt;
  }
  return null;
}

export function requestWithdrawal(
  state: AppState,
  bankId: string,
  amount: number,
  pinOk: boolean,
  nextPin: { salt: string; hash: string } | null,
): ActionResult<{ reference: string }> {
  const user = signedIn(state);
  if (!user) return fail("Sign in to continue.");
  const gate = activeReady(user);
  if (gate) return fail(gate);
  const bank = user.banks.find((item) => item.id === bankId);
  if (!bank || bank.status !== "verified") return fail("Choose a verified bank account.");
  if (amount < MIN_WITHDRAWAL) return fail("Enter a valid withdrawal amount.");
  const total = roundMoney(amount + WITHDRAWAL_FEE);
  if (total > user.wallet.available) return fail("Your available balance is not enough for this withdrawal and the withdrawal fee.");
  const pinError = applyPin(user, pinOk, nextPin);
  if (pinError) return pinError;
  const ref = reference("WDR");
  user.wallet.available = roundMoney(user.wallet.available - total);
  syncWallet(user);
  state.withdrawals.unshift({
    id: uid(),
    userId: user.id,
    bankAccountId: bank.id,
    bankName: bank.bankName,
    accountNumber: bank.accountNumber,
    accountName: bank.accountName,
    amount,
    fee: WITHDRAWAL_FEE,
    status: "successful",
    reference: ref,
    createdAt: Date.now(),
  });
  state.fees.unshift({
    id: uid(),
    userId: user.id,
    feeType: "withdrawal",
    name: "Withdrawal fee",
    amount: WITHDRAWAL_FEE,
    status: "successful",
    paymentMethod: "Wallet",
    reference: reference("FEE"),
    purpose: WITHDRAWAL_FEE_PURPOSE,
    createdAt: Date.now(),
    paidAt: Date.now(),
  });
  addTx(state, {
    userId: user.id,
    type: "withdrawal",
    amount,
    reference: ref,
    status: "successful",
    description: `Withdrawal to ${bank.bankName}. Fee ${naira(WITHDRAWAL_FEE)} shown before confirmation.`,
    direction: "debit",
  });
  addTx(state, {
    userId: user.id,
    type: "fee",
    amount: WITHDRAWAL_FEE,
    reference: reference("FEE"),
    status: "successful",
    description: WITHDRAWAL_FEE_PURPOSE,
    direction: "debit",
  });
  note(state, user.id, "payments", "withdrawal", "Withdrawal recorded", "The amount and fee left your available balance. Invested funds were not touched.");
  return ok({ reference: ref });
}

export function createInvestment(
  state: AppState,
  input: { opportunityId: string; amount: number; accepted: boolean; pinOk: boolean; nextPin: { salt: string; hash: string } | null },
): ActionResult<{ holdingId: string; reference: string }> {
  const user = signedIn(state);
  if (!user) return fail("Sign in to continue.");
  const gate = activeReady(user);
  if (gate) return fail(gate);
  const opp = lookupOpportunity(state, input.opportunityId);
  if (!opp) return fail("That opportunity is not available.");
  if (opp.status !== "open") return fail("This opportunity is not open for new investment.");
  if (input.amount < opp.min) return fail(`The minimum investment is ${opp.min.toLocaleString("en-NG")}.`);
  if (input.amount > opp.max) return fail(`The maximum investment is ${opp.max.toLocaleString("en-NG")}.`);
  if (input.amount > opp.remaining) return fail("That amount is above the remaining allocation.");
  const fee = arrangementFee(opp.kind, input.amount);
  const total = roundMoney(input.amount + fee);
  if (total > user.wallet.available) return fail("Your available balance is not enough for this investment and the applicable fee.");
  if (!input.accepted) return fail("Accept the agreement before the investment can be confirmed.");
  const pinError = applyPin(user, input.pinOk, input.nextPin);
  if (pinError) return pinError;
  const agreement = opp.kind === "mudarabah" ? AGREEMENTS.mudarabah : AGREEMENTS.ijarah;
  const now = Date.now();
  const holdingId = uid();
  const acceptanceId = uid();
  const ref = reference(opp.kind === "mudarabah" ? "MDR" : "IJR");
  const acceptanceRef = reference("AGR");
  state.acceptances.unshift({
    id: acceptanceId,
    userId: user.id,
    agreementId: agreement.id,
    agreementType: agreement.type,
    version: agreement.version,
    investmentId: holdingId,
    acceptedAt: now,
    reference: acceptanceRef,
    status: "accepted",
  });
  state.documents.unshift({
    id: uid(),
    userId: user.id,
    category: "agreement",
    docType: agreement.type,
    name: `${agreement.title} v${agreement.version}`,
    body: agreement.body,
    dataUrl: null,
    status: "accepted",
    reference: acceptanceRef,
    createdAt: now,
  });
  state.holdings.unshift({
    id: holdingId,
    userId: user.id,
    opportunityId: opp.id,
    kind: opp.kind,
    name: opp.name,
    amount: input.amount,
    fee,
    status: "active",
    investedAt: now,
    startDate: now,
    maturityDate: maturityFor(now, opp),
    acceptanceId,
    reference: ref,
  });
  state.documents.unshift({
    id: uid(),
    userId: user.id,
    category: "confirmation",
    docType: "Investment confirmation",
    name: `${opp.name} confirmation`,
    body: `Investment ${ref} for ${opp.name}. Amount ${naira(input.amount)}. Arrangement fee ${naira(fee)}. Agreement ${agreement.type} version ${agreement.version} accepted ${new Date(now).toISOString()}.`,
    dataUrl: null,
    status: "issued",
    reference: ref,
    createdAt: now,
  });
  user.wallet.available = roundMoney(user.wallet.available - total);
  syncWallet(user);
  addTx(state, {
    userId: user.id,
    type: opp.kind === "mudarabah" ? "mudarabah_investment" : "ijarah_investment",
    amount: input.amount,
    reference: ref,
    status: "successful",
    description: `${opp.name}. Profit and rental follow the agreement and actual performance.`,
    direction: "debit",
  });
  if (fee > 0) {
    const feeRef = reference("FEE");
    state.fees.unshift({
      id: uid(),
      userId: user.id,
      feeType: "arrangement",
      name: "Arrangement fee",
      amount: fee,
      status: "successful",
      paymentMethod: "Wallet",
      reference: feeRef,
      purpose: feePurpose(opp.kind),
      createdAt: now,
      paidAt: now,
    });
    addTx(state, {
      userId: user.id,
      type: "fee",
      amount: fee,
      reference: feeRef,
      status: "successful",
      description: feePurpose(opp.kind),
      direction: "debit",
    });
  }
  note(state, user.id, "investments", "investment", "Investment confirmed", `${opp.name} is now in My Investments. No profit has been declared.`);
  return ok({ holdingId, reference: ref });
}

export function createTicket(state: AppState, subject: string, description: string): ActionResult {
  const user = signedIn(state);
  if (!user) return fail("Sign in to continue.");
  if (subject.trim().length < 4) return fail("Enter a subject.");
  if (description.trim().length < 10) return fail("Describe the issue in a little more detail.");
  state.tickets.unshift({
    id: uid(),
    userId: user.id,
    subject: subject.trim(),
    description: description.trim(),
    status: "open",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  note(state, user.id, "account", "support", "Support ticket opened", subject.trim());
  return ok();
}

export function closeTicket(state: AppState, id: string): ActionResult {
  const user = signedIn(state);
  if (!user) return fail("Sign in to continue.");
  const ticket = state.tickets.find((item) => item.id === id && item.userId === user.id);
  if (!ticket) return fail("Ticket not found.");
  ticket.status = "closed";
  ticket.updatedAt = Date.now();
  return ok();
}

export function markRead(state: AppState, id: string) {
  const user = signedIn(state);
  const item = state.notifications.find((noteItem) => noteItem.id === id && noteItem.userId === user?.id);
  if (item) item.read = true;
}

export function markAllRead(state: AppState) {
  const user = signedIn(state);
  if (!user) return;
  for (const item of state.notifications) {
    if (item.userId === user.id) item.read = true;
  }
}

export function updateProfile(
  state: AppState,
  patch: { phone?: string; email?: string; address?: string; stateName?: string; lga?: string; photo?: string | null },
): ActionResult {
  const user = signedIn(state);
  if (!user) return fail("Sign in to continue.");
  if (patch.email !== undefined) {
    const email = patch.email.trim().toLowerCase();
    if (!isEmail(email)) return fail("Enter a valid email address.");
    if (state.users.some((item) => item.id !== user.id && item.email === email)) return fail("That email is already in use.");
    user.email = email;
    user.kyc.personal.email = email;
  }
  if (patch.phone !== undefined) {
    const phone = normalizePhone(patch.phone);
    if (!isPhone(phone)) return fail("Enter a valid Nigerian phone number.");
    if (state.users.some((item) => item.id !== user.id && item.phone === phone)) return fail("That phone number is already in use.");
    user.phone = phone;
    user.kyc.personal.phone = phone;
  }
  if (patch.address !== undefined) user.kyc.personal.address = patch.address.trim();
  if (patch.stateName !== undefined) user.kyc.personal.state = patch.stateName;
  if (patch.lga !== undefined) user.kyc.personal.lga = patch.lga.trim();
  if (patch.photo !== undefined) user.profile.photo = patch.photo;
  return ok();
}

export function updatePrefs(state: AppState, prefs: User["notifPrefs"]) {
  const user = signedIn(state);
  if (!user) return;
  user.notifPrefs = prefs;
}

export async function hashSecret(salt: string, value: string) {
  return digest(salt, value);
}
