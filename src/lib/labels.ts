import type { AccountStatus, KycStatus, PaymentStatus, TicketStatus, TxType, VerifyStatus } from "./types";

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  registered: "Registered",
  otp_pending: "OTP Pending",
  kyc_locked: "KYC Locked",
  kyc_in_progress: "KYC In Progress",
  kyc_pending_review: "KYC Pending Review",
  kyc_approved: "KYC Approved",
  kyc_rejected: "KYC Rejected",
  active: "Active",
  suspended: "Suspended",
};

export const KYC_STATUS_LABEL: Record<KycStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  requires_update: "Requires Update",
};

export const VERIFY_LABEL: Record<VerifyStatus, string> = {
  not_started: "Not Started",
  pending: "Pending",
  verified: "Verified",
  failed: "Failed",
  requires_update: "Requires Update",
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  successful: "Successful",
  failed: "Failed",
  reversed: "Reversed",
  refunded: "Refunded",
};

export const TX_LABEL: Record<TxType, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  mudarabah_investment: "Mudarabah investment",
  ijarah_investment: "Ijarah investment",
  profit_distribution: "Profit distribution",
  rental_payment: "Rental payment",
  client_onboarding_fee: "Client Onboarding Fee",
  fee: "Fee",
  refund: "Refund",
  reversal: "Reversal",
};

export const TICKET_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export function statusTone(status: string): "ok" | "warn" | "danger" | "neutral" {
  if (["successful", "verified", "approved", "active", "completed", "accepted", "resolved"].includes(status)) {
    return "ok";
  }
  if (
    ["pending", "processing", "in_progress", "pending_review", "requires_update", "otp_pending", "kyc_in_progress", "kyc_pending_review", "open"].includes(
      status,
    )
  ) {
    return "warn";
  }
  if (["failed", "rejected", "reversed", "suspended", "kyc_rejected", "kyc_locked"].includes(status)) return "danger";
  return "neutral";
}

export const KYC_LOCK_MESSAGE = "Complete your Client Onboarding Fee payment to begin KYC verification.";
