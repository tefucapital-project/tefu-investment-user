export type AccountStatus =
  | "registered"
  | "otp_pending"
  | "kyc_locked"
  | "kyc_in_progress"
  | "kyc_pending_review"
  | "kyc_approved"
  | "kyc_rejected"
  | "active"
  | "suspended";

export type KycStatus =
  | "not_started"
  | "in_progress"
  | "pending_review"
  | "approved"
  | "rejected"
  | "requires_update";

export type VerifyStatus = "not_started" | "pending" | "verified" | "failed" | "requires_update";

export type PaymentStatus = "pending" | "processing" | "successful" | "failed" | "reversed" | "refunded";

export type TxType =
  | "deposit"
  | "withdrawal"
  | "mudarabah_investment"
  | "ijarah_investment"
  | "profit_distribution"
  | "rental_payment"
  | "client_onboarding_fee"
  | "fee"
  | "refund"
  | "reversal";

export type OtpPurpose = "register" | "login_2fa" | "reset";

export type HoldingStatus = "pending" | "active" | "completed";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export interface PersonalInfo {
  firstName: string;
  middleName: string;
  lastName: string;
  dob: string;
  gender: string;
  nationality: string;
  phone: string;
  email: string;
  address: string;
  state: string;
  lga: string;
  country: string;
}

export interface VerifyRecord {
  status: VerifyStatus;
  last4: string;
  hash: string;
  reference: string;
  verifiedAt: number | null;
  reason: string;
}

export interface FileSlot {
  status: "not_started" | "submitted" | "verified";
  docType: string;
  name: string;
  id: string;
}

export interface KycEvent {
  status: string;
  at: number;
  note: string;
}

export interface KycRecord {
  status: KycStatus;
  completion: number;
  submittedAt: number | null;
  approvedAt: number | null;
  rejectionReason: string;
  personalComplete: boolean;
  personal: PersonalInfo;
  nin: VerifyRecord;
  bvn: VerifyRecord;
  bankAccountId: string | null;
  document: FileSlot;
  selfie: FileSlot;
  events: KycEvent[];
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: VerifyStatus;
  reason: string;
  primary: boolean;
  reference: string;
}

export interface Wallet {
  balance: number;
  available: number;
  locked: number;
}

export interface NotificationPrefs {
  account: boolean;
  payments: boolean;
  investments: boolean;
  security: boolean;
}

export interface User {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  passwordHash: string;
  passwordSalt: string;
  referralCode: string;
  termsAcceptedAt: number | null;
  privacyAcceptedAt: number | null;
  status: AccountStatus;
  createdAt: number;
  otpVerifiedAt: number | null;
  feePaidAt: number | null;
  activatedAt: number | null;
  pinHash: string | null;
  pinSalt: string | null;
  pinFails: number;
  pinLockedUntil: number;
  twoFactor: boolean;
  profile: { photo: string | null };
  kyc: KycRecord;
  banks: BankAccount[];
  wallet: Wallet;
  notifPrefs: NotificationPrefs;
}

export interface OtpChallenge {
  id: string;
  userId: string;
  purpose: OtpPurpose;
  codeHash: string;
  salt: string;
  previewCode: string;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
}

export interface Session {
  id: string;
  userId: string;
  device: string;
  ipLabel: string;
  createdAt: number;
  expiresAt: number;
}

export interface ClientFee {
  id: string;
  userId: string;
  feeType: "client_onboarding_fee" | "arrangement" | "withdrawal";
  name: string;
  amount: number;
  status: PaymentStatus;
  paymentMethod: string;
  reference: string;
  purpose: string;
  createdAt: number;
  paidAt: number | null;
}

export interface WalletTx {
  id: string;
  userId: string;
  type: TxType;
  amount: number;
  reference: string;
  status: PaymentStatus;
  description: string;
  direction: "credit" | "debit" | "neutral";
  createdAt: number;
}

export interface Deposit {
  id: string;
  userId: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  status: PaymentStatus;
  createdAt: number;
}

export interface Withdrawal {
  id: string;
  userId: string;
  bankAccountId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  fee: number;
  status: PaymentStatus;
  reference: string;
  createdAt: number;
}

export interface Holding {
  id: string;
  userId: string;
  opportunityId: string;
  kind: "mudarabah" | "ijarah";
  name: string;
  amount: number;
  fee: number;
  status: HoldingStatus;
  investedAt: number;
  startDate: number;
  maturityDate: number;
  acceptanceId: string;
  reference: string;
}

export interface Distribution {
  id: string;
  userId: string;
  investmentId: string;
  investmentName: string;
  type: "mudarabah_profit" | "ijarah_rental" | "other";
  amount: number;
  date: number;
  reference: string;
  status: "successful";
}

export interface Acceptance {
  id: string;
  userId: string;
  agreementId: string;
  agreementType: string;
  version: string;
  investmentId: string | null;
  acceptedAt: number;
  reference: string;
  status: "accepted";
}

export interface ClientDocument {
  id: string;
  userId: string;
  category: "kyc" | "agreement" | "confirmation" | "identification";
  docType: string;
  name: string;
  body: string;
  dataUrl: string | null;
  status: string;
  reference: string;
  createdAt: number;
}

export interface AppNotification {
  id: string;
  userId: string;
  category: "account" | "payments" | "investments" | "security";
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
}

export interface Ticket {
  id: string;
  userId: string;
  subject: string;
  description: string;
  status: TicketStatus;
  createdAt: number;
  updatedAt: number;
}

export interface LoginAttempt {
  count: number;
  lockedUntil: number;
}

export interface AppState {
  users: User[];
  currentUserId: string | null;
  currentSessionId: string | null;
  pending2faUserId: string | null;
  passwordResetUserId: string | null;
  challenges: OtpChallenge[];
  fees: ClientFee[];
  transactions: WalletTx[];
  deposits: Deposit[];
  withdrawals: Withdrawal[];
  holdings: Holding[];
  distributions: Distribution[];
  acceptances: Acceptance[];
  documents: ClientDocument[];
  notifications: AppNotification[];
  tickets: Ticket[];
  sessions: Session[];
  loginAttempts: Record<string, LoginAttempt>;
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export interface RegisterForm {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  referralCode: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

export interface OppDoc {
  title: string;
  body: string;
}

interface OppBase {
  id: string;
  name: string;
  summary: string;
  description: string;
  min: number;
  max: number;
  target: number;
  fundedBase: number;
  risk: string[];
  shariah: string;
  schedule: string;
  documents: OppDoc[];
  status: "open" | "fully_funded" | "closed";
}

export interface MudarabahOpp extends OppBase {
  kind: "mudarabah";
  sector: string;
  durationDays: number;
  investorShare: number;
  managerShare: number;
}

export interface IjarahOpp extends OppBase {
  kind: "ijarah";
  assetType: string;
  assetValue: number;
  leaseMonths: number;
  takaful: string;
}

export type Opportunity = MudarabahOpp | IjarahOpp;

export type LiveOpportunity = Opportunity & {
  funded: number;
  remaining: number;
  status: "open" | "fully_funded" | "closed";
};

export interface ReceiptView {
  reference: string;
  title: string;
  amount: number;
  status: string;
  date: number;
  method: string;
  lines: { label: string; value: string }[];
}
