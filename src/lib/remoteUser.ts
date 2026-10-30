import { createUserShell } from "./engine";
import { uid } from "./format";
import type { AccountStatus, AppState, KycStatus, User, VerifyStatus } from "./types";

const STATUS_MAP: Record<string, AccountStatus> = {
  OTP_PENDING: "otp_pending",
  REGISTERED: "registered",
  OTP_VERIFIED: "kyc_locked",
  KYC_LOCKED: "kyc_locked",
  KYC_IN_PROGRESS: "kyc_in_progress",
  KYC_PENDING_REVIEW: "kyc_pending_review",
  KYC_APPROVED: "kyc_approved",
  KYC_REJECTED: "kyc_rejected",
  KYC_UPDATE_REQUIRED: "kyc_in_progress",
  ACTIVE: "active",
  SUSPENDED: "suspended",
};

const KYC_STATUS_MAP: Record<string, KycStatus> = {
  KYC_LOCKED: "not_started",
  OTP_PENDING: "not_started",
  KYC_IN_PROGRESS: "in_progress",
  KYC_PENDING_REVIEW: "pending_review",
  KYC_APPROVED: "approved",
  KYC_REJECTED: "rejected",
  KYC_UPDATE_REQUIRED: "requires_update",
  ACTIVE: "approved",
};

const VERIFY_MAP: Record<string, VerifyStatus> = {
  NOT_STARTED: "not_started",
  PENDING: "pending",
  VERIFIED: "verified",
  COMPLETE: "verified",
  FAILED: "failed",
  REQUIRES_UPDATE: "requires_update",
  APPROVED: "verified",
};

export type RemoteKycView = {
  id: string;
  status: string;
  completion: number;
  parts: {
    personal: string;
    nin: string;
    bvn: string;
    bank: string;
    document: string;
    identity: string;
  };
  ninLast4?: string | null;
  bvnLast4?: string | null;
  rejectionReason?: string | null;
  updateReason?: string | null;
  banks?: Array<{ id: string; bankName: string; accountName: string; last4: string; status: string; eligible: boolean }>;
  documents?: Array<{ id: string; kind: string; fileName: string; status: string }>;
};

export function mapAccountStatus(status: string): AccountStatus {
  return STATUS_MAP[status] ?? "kyc_locked";
}

function mapVerify(status?: string): VerifyStatus {
  return VERIFY_MAP[status ?? "NOT_STARTED"] ?? "not_started";
}

function fileStatus(status?: string): "not_started" | "submitted" | "verified" {
  const mapped = mapVerify(status);
  if (mapped === "not_started") return "not_started";
  if (mapped === "verified") return "verified";
  return "submitted";
}

/** Merge a live `/kyc` payload into the signed-in user so UI matches admin review state. */
export function applyRemoteKyc(user: User, remote: RemoteKycView, accountStatus?: string) {
  if (accountStatus) user.status = mapAccountStatus(accountStatus);
  else if (remote.status === "KYC_PENDING_REVIEW") user.status = "kyc_pending_review";
  else if (remote.status === "KYC_REJECTED") user.status = "kyc_rejected";
  else if (remote.status === "KYC_APPROVED" || remote.status === "ACTIVE") {
    user.status = "active";
    if (!user.activatedAt) user.activatedAt = Date.now();
  }

  user.kyc.status = KYC_STATUS_MAP[remote.status] ?? user.kyc.status;
  user.kyc.completion = remote.completion;
  user.kyc.personalComplete = remote.parts.personal === "COMPLETE";
  user.kyc.rejectionReason = remote.rejectionReason ?? remote.updateReason ?? "";
  user.kyc.nin = {
    ...user.kyc.nin,
    status: mapVerify(remote.parts.nin),
    last4: remote.ninLast4 ?? user.kyc.nin.last4,
    reference: remote.ninLast4 ? `••••${remote.ninLast4}` : user.kyc.nin.reference,
  };
  user.kyc.bvn = {
    ...user.kyc.bvn,
    status: mapVerify(remote.parts.bvn),
    last4: remote.bvnLast4 ?? user.kyc.bvn.last4,
    reference: remote.bvnLast4 ? `••••${remote.bvnLast4}` : user.kyc.bvn.reference,
  };

  const bank = remote.banks?.[0];
  if (bank) {
    const existing = user.banks.find((item) => item.id === bank.id) ?? {
      id: bank.id,
      bankName: bank.bankName,
      accountNumber: `••••${bank.last4}`,
      accountName: bank.accountName,
      status: mapVerify(bank.status),
      reason: "",
      createdAt: Date.now(),
    };
    existing.bankName = bank.bankName;
    existing.accountName = bank.accountName;
    existing.status = mapVerify(bank.status);
    if (!user.banks.some((item) => item.id === bank.id)) user.banks.unshift(existing);
    user.kyc.bankAccountId = bank.id;
  }

  const identityDoc = remote.documents?.find((item) => item.kind === "IDENTITY");
  const selfieDoc = remote.documents?.find((item) => item.kind === "SELFIE");
  if (identityDoc) {
    user.kyc.document = {
      status: fileStatus(identityDoc.status === "APPROVED" ? "VERIFIED" : identityDoc.status === "PENDING" ? "PENDING" : remote.parts.document),
      docType: user.kyc.document.docType || "ID",
      name: identityDoc.fileName,
      id: identityDoc.id,
    };
  } else {
    user.kyc.document.status = fileStatus(remote.parts.document);
  }
  if (selfieDoc) {
    user.kyc.selfie = {
      status: fileStatus(selfieDoc.status === "APPROVED" ? "VERIFIED" : selfieDoc.status === "PENDING" ? "PENDING" : remote.parts.identity),
      docType: "Selfie",
      name: selfieDoc.fileName,
      id: selfieDoc.id,
    };
  } else {
    user.kyc.selfie.status = fileStatus(remote.parts.identity);
  }

  if (user.kyc.status === "pending_review" && !user.kyc.submittedAt) {
    user.kyc.submittedAt = Date.now();
  }
  if (user.kyc.status === "approved" && !user.kyc.approvedAt) {
    user.kyc.approvedAt = Date.now();
  }
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
