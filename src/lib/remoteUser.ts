import { createUserShell } from "./engine";
import { uid } from "./format";
import type { AccountStatus, AppState, User } from "./types";

const STATUS_MAP: Record<string, AccountStatus> = {
  OTP_PENDING: "otp_pending",
  REGISTERED: "registered",
  OTP_VERIFIED: "kyc_locked",
  KYC_LOCKED: "kyc_locked",
  KYC_IN_PROGRESS: "kyc_in_progress",
  KYC_PENDING_REVIEW: "kyc_pending_review",
  KYC_APPROVED: "kyc_approved",
  KYC_REJECTED: "kyc_rejected",
  ACTIVE: "active",
  SUSPENDED: "suspended",
};

export function mapAccountStatus(status: string): AccountStatus {
  return STATUS_MAP[status] ?? "kyc_locked";
}

export function upsertRemoteUser(
  state: AppState,
  remote: {
    id: string;
    email: string;
    phone: string | null;
    firstName: string;
    middleName?: string;
    lastName: string;
    status: string;
  },
  extras?: { feePaidAt?: number | null },
): User {
  const existing = state.users.find((item) => item.id === remote.id || item.email === remote.email.toLowerCase());
  const status = mapAccountStatus(remote.status);
  if (existing) {
    existing.id = remote.id;
    existing.email = remote.email.toLowerCase();
    existing.phone = remote.phone ?? existing.phone;
    existing.firstName = remote.firstName;
    existing.middleName = remote.middleName ?? existing.middleName;
    existing.lastName = remote.lastName;
    existing.status = status;
    // Always trust the API fee flag so a past demo "paid" state cannot skip Paystack.
    if (extras && "feePaidAt" in extras) existing.feePaidAt = extras.feePaidAt ?? null;
    if (status === "active" && !existing.activatedAt) existing.activatedAt = Date.now();
    state.currentUserId = existing.id;
    return existing;
  }

  const now = Date.now();
  const user: User = {
    id: remote.id,
    firstName: remote.firstName,
    middleName: remote.middleName ?? "",
    lastName: remote.lastName,
    email: remote.email.toLowerCase(),
    phone: remote.phone ?? "",
    passwordHash: "remote",
    passwordSalt: "remote",
    referralCode: "",
    termsAcceptedAt: now,
    privacyAcceptedAt: now,
    status,
    createdAt: now,
    otpVerifiedAt: now,
    feePaidAt: extras?.feePaidAt ?? null,
    activatedAt: status === "active" ? now : null,
    pinHash: null,
    pinSalt: null,
    pinFails: 0,
    pinLockedUntil: 0,
    twoFactor: false,
    profile: { photo: null },
    kyc: {
      ...createUserShell(),
      personal: {
        firstName: remote.firstName,
        middleName: remote.middleName ?? "",
        lastName: remote.lastName,
        dob: "",
        gender: "",
        nationality: "Nigerian",
        phone: remote.phone ?? "",
        email: remote.email.toLowerCase(),
        address: "",
        state: "",
        lga: "",
        country: "Nigeria",
      },
    },
    banks: [],
    wallet: { balance: 0, available: 0, locked: 0 },
    notifPrefs: { account: true, payments: true, investments: true, security: true },
  };
  state.users.unshift(user);
  state.sessions.unshift({
    id: uid(),
    userId: user.id,
    device: "Live API session",
    ipLabel: "secure",
    createdAt: now,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
  });
  state.currentUserId = user.id;
  return user;
}
