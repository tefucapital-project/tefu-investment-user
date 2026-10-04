import { ARRANGEMENT_FEE_PURPOSE, MUDARABAH_FEE_RATE, ONBOARDING_FEE_NAME, OPPORTUNITIES, findOpportunity } from "./catalog";
import { addDays, addMonths, naira, roundMoney, shortDate } from "./format";
import { PAYMENT_LABEL } from "./labels";
import type { AppState, LiveOpportunity, Opportunity, ReceiptView, User } from "./types";

export function kycCompletion(user: User) {
  let score = 0;
  if (user.kyc.personalComplete) score += 20;
  if (user.kyc.nin.status === "verified") score += 20;
  if (user.kyc.bvn.status === "verified") score += 20;
  const bank = user.banks.find((item) => item.id === user.kyc.bankAccountId);
  if (bank?.status === "verified") score += 15;
  if (user.kyc.document.status === "submitted" || user.kyc.document.status === "verified") score += 15;
  if (user.kyc.selfie.status === "submitted" || user.kyc.selfie.status === "verified") score += 10;
  return score;
}

export function opportunityView(state: AppState, opp: Opportunity): LiveOpportunity {
  const extra = state.holdings.filter((item) => item.opportunityId === opp.id).reduce((sum, item) => sum + item.amount, 0);
  const funded = roundMoney(opp.fundedBase + extra);
  const remaining = Math.max(0, roundMoney(opp.target - funded));
  const status = opp.status === "closed" ? "closed" : remaining < opp.min ? "fully_funded" : opp.status;
  return { ...opp, funded, remaining, status };
}

export function allLive(state: AppState): LiveOpportunity[] {
  return OPPORTUNITIES.map((item) => opportunityView(state, item));
}

export function lookupOpportunity(state: AppState, id: string) {
  const found = findOpportunity(id);
  return found ? opportunityView(state, found) : null;
}

export function arrangementFee(kind: "mudarabah" | "ijarah", amount: number) {
  if (kind === "ijarah") return 0;
  return roundMoney(amount * MUDARABAH_FEE_RATE);
}

export function feePurpose(kind: "mudarabah" | "ijarah") {
  if (kind === "ijarah") return "No arrangement fee is charged on this ijarah participation.";
  return ARRANGEMENT_FEE_PURPOSE;
}

export function maturityFor(start: number, opp: Opportunity) {
  return opp.kind === "mudarabah" ? addDays(start, opp.durationDays) : addMonths(start, opp.leaseMonths);
}

export function durationLabel(opp: Opportunity) {
  return opp.kind === "mudarabah" ? `${opp.durationDays} days` : `${opp.leaseMonths} months`;
}

export function portfolioOf(state: AppState, userId: string) {
  const holdings = state.holdings.filter((item) => item.userId === userId);
  const distributions = state.distributions.filter((item) => item.userId === userId);
  return {
    holdings,
    invested: holdings.reduce((sum, item) => sum + item.amount, 0),
    mudarabah: holdings.filter((item) => item.kind === "mudarabah").reduce((sum, item) => sum + item.amount, 0),
    ijarah: holdings.filter((item) => item.kind === "ijarah").reduce((sum, item) => sum + item.amount, 0),
    active: holdings.filter((item) => item.status === "active").length,
    completed: holdings.filter((item) => item.status === "completed").length,
    pending: holdings.filter((item) => item.status === "pending").length,
    distributions,
    profit: distributions.reduce((sum, item) => sum + item.amount, 0),
    withdrawals: state.withdrawals
      .filter((item) => item.userId === userId && item.status === "successful")
      .reduce((sum, item) => sum + item.amount, 0),
  };
}

export function visibleNotifications(user: User, state: AppState) {
  return state.notifications.filter((item) => item.userId === user.id && user.notifPrefs[item.category]);
}

export function receiptsFor(state: AppState, userId: string): ReceiptView[] {
  const items: ReceiptView[] = [];
  for (const fee of state.fees.filter((item) => item.userId === userId)) {
    items.push({
      reference: fee.reference,
      title: fee.name,
      amount: fee.amount,
      status: fee.status,
      date: fee.paidAt ?? fee.createdAt,
      method: fee.paymentMethod,
      lines: [
        { label: "Fee", value: fee.name },
        { label: "Purpose", value: fee.purpose },
        { label: "Amount", value: naira(fee.amount) },
        { label: "Method", value: fee.paymentMethod || "—" },
        { label: "Status", value: PAYMENT_LABEL[fee.status] },
        { label: "Reference", value: fee.reference },
      ],
    });
  }
  for (const deposit of state.deposits.filter((item) => item.userId === userId)) {
    items.push({
      reference: deposit.reference,
      title: "Wallet deposit",
      amount: deposit.amount,
      status: deposit.status,
      date: deposit.createdAt,
      method: deposit.paymentMethod,
      lines: [
        { label: "Type", value: "Deposit" },
        { label: "Amount", value: naira(deposit.amount) },
        { label: "Method", value: deposit.paymentMethod },
        { label: "Status", value: PAYMENT_LABEL[deposit.status] },
        { label: "Reference", value: deposit.reference },
        { label: "Wallet credit", value: deposit.status === "successful" ? "Credited after confirmation" : "Not credited" },
      ],
    });
  }
  for (const withdrawal of state.withdrawals.filter((item) => item.userId === userId)) {
    items.push({
      reference: withdrawal.reference,
      title: "Withdrawal",
      amount: withdrawal.amount,
      status: withdrawal.status,
      date: withdrawal.createdAt,
      method: withdrawal.bankName,
      lines: [
        { label: "Amount", value: naira(withdrawal.amount) },
        { label: "Withdrawal fee", value: naira(withdrawal.fee) },
        { label: "Bank", value: withdrawal.bankName },
        { label: "Account name", value: withdrawal.accountName },
        { label: "Status", value: PAYMENT_LABEL[withdrawal.status] },
        { label: "Reference", value: withdrawal.reference },
      ],
    });
  }
  for (const holding of state.holdings.filter((item) => item.userId === userId)) {
    items.push({
      reference: holding.reference,
      title: `${holding.name} confirmation`,
      amount: holding.amount,
      status: "successful",
      date: holding.investedAt,
      method: "Wallet",
      lines: [
        { label: "Investment", value: holding.name },
        { label: "Type", value: holding.kind === "mudarabah" ? "Mudarabah" : "Ijarah" },
        { label: "Amount invested", value: naira(holding.amount) },
        { label: "Arrangement fee", value: naira(holding.fee) },
        { label: "Total deducted", value: naira(roundMoney(holding.amount + holding.fee)) },
        { label: "Maturity", value: shortDate(holding.maturityDate) },
        { label: "Reference", value: holding.reference },
      ],
    });
  }
  return items.sort((a, b) => b.date - a.date);
}

export function findReceipt(state: AppState, userId: string, ref: string) {
  return receiptsFor(state, userId).find((item) => item.reference === ref) ?? null;
}

export function homePath(user: User | null) {
  if (!user) return "/login";
  if (user.status === "suspended") return "/suspended";
  if (user.status === "otp_pending") return "/verify";
  if (!user.feePaidAt || user.status === "kyc_locked") return "/onboarding/fee";
  if (user.status === "active" || user.status === "kyc_approved") return "/dashboard";
  return "/kyc";
}

export function onboardingFeeRecord(state: AppState, userId: string) {
  return state.fees.find((item) => item.userId === userId && item.name === ONBOARDING_FEE_NAME && item.status === "successful") ?? null;
}
