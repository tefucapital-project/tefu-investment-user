import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  changePassword,
  closeTicket,
  createInvestment,
  createTicket,
  logoutOthers,
  logoutUser,
  markAllRead,
  markRead,
  requestReset,
  requestWithdrawal,
  resendOtp,
  resetPassword,
  saveBank,
  saveDocument,
  savePersonal,
  saveSelfie,
  setPin,
  setTwoFactor,
  submitBvn,
  submitKyc,
  submitNin,
  updatePrefs,
  updateProfile,
  verifyOtp,
} from "../lib/engine";
import { api as liveApi, ApiError, clearApiTokens, hasApiSession, newIdempotencyKey, saveApiTokens, type Checkout, type Tokens } from "../lib/api";
import { deviceLabel, digest, oneTimeCode, uid } from "../lib/format";
import { applyRemoteKyc, mapAccountStatus, upsertRemoteUser, type RemoteKycView } from "../lib/remoteUser";
import { allLive } from "../lib/selectors";
import { freshState, loadState, persist, syncSession } from "../lib/storage";
import type { ActionResult, AppState, PersonalInfo, RegisterForm, User } from "../lib/types";

type FeeCheckout = { reference: string; checkoutUrl: string | null };
type DepositCheckout = { reference: string; checkoutUrl: string | null };

interface PinCarry {
  pinOk: boolean;
  nextPin: { salt: string; hash: string } | null;
  error?: string;
}

interface AppApi {
  user: User | null;
  state: AppState;
  opportunities: ReturnType<typeof allLive>;
  register: (form: RegisterForm) => Promise<ActionResult<{ sessionId: string }>>;
  verifyOtp: (code: string) => Promise<ActionResult<{ sessionId?: string }>>;
  resendOtp: () => Promise<ActionResult>;
  login: (email: string, password: string) => Promise<ActionResult<{ twoFactor: boolean; sessionId?: string }>>;
  logout: () => void;
  logoutOthers: () => ActionResult;
  requestReset: (email: string) => Promise<ActionResult>;
  resetPassword: (code: string, password: string) => Promise<ActionResult>;
  changePassword: (current: string, next: string) => Promise<ActionResult>;
  setPin: (pin: string, current?: string) => Promise<ActionResult>;
  setTwoFactor: (enabled: boolean, password: string) => Promise<ActionResult>;
  payOnboardingFee: (method: string, outcome: "successful" | "failed" | "pending", reference: string) => Promise<ActionResult<FeeCheckout>>;
  syncOnboardingFee: () => Promise<ActionResult<{ paid: boolean }>>;
  reconcileOnboardingFee: (reference?: string) => Promise<ActionResult<{ paid: boolean; reference?: string | null; status?: string }>>;
  verifyPayment: (reference: string) => Promise<ActionResult<{ reference: string; status: string; purpose?: string }>>;
  syncKyc: () => Promise<ActionResult>;
  savePersonal: (info: PersonalInfo) => Promise<ActionResult>;
  submitNin: (nin: string) => Promise<ActionResult>;
  submitBvn: (bvn: string) => Promise<ActionResult>;
  resolveBank: (input: { bankName: string; accountNumber: string }) => Promise<ActionResult<{ accountName: string; accountNumber: string }>>;
  saveBank: (input: { bankName: string; accountNumber: string; accountName: string; id?: string }) => Promise<ActionResult>;
  saveDocument: (input: { docType: string; name: string; dataUrl: string | null }) => Promise<ActionResult>;
  saveSelfie: (input: { name: string; dataUrl: string | null }) => Promise<ActionResult>;
  submitKyc: () => Promise<ActionResult>;
  createDeposit: (amount: number, method: string, outcome: "successful" | "failed") => Promise<ActionResult<DepositCheckout>>;
  requestWithdrawal: (bankId: string, amount: number, pin: string) => Promise<ActionResult<{ reference: string }>>;
  createInvestment: (input: { opportunityId: string; amount: number; accepted: boolean; pin: string }) => Promise<ActionResult<{ holdingId: string; reference: string }>>;
  createTicket: (subject: string, description: string) => ActionResult;
  closeTicket: (id: string) => ActionResult;
  markRead: (id: string) => void;
  markAllRead: () => void;
  updateProfile: (patch: { phone?: string; email?: string; address?: string; stateName?: string; lga?: string; photo?: string | null }) => ActionResult;
  updatePrefs: (prefs: User["notifPrefs"]) => void;
  clearDeviceData: () => void;
}

const AppContext = createContext<AppApi | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(loadState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const apply = <T,>(fn: (draft: AppState) => ActionResult<T>): ActionResult<T> => {
    const draft = structuredClone(stateRef.current);
    const result = fn(draft);
    stateRef.current = draft;
    persist(draft);
    syncSession(draft);
    setState(draft);
    return result;
  };

  const resolvePin = async (pin: string): Promise<PinCarry> => {
    const user = stateRef.current.users.find((item) => item.id === stateRef.current.currentUserId);
    if (!user) return { pinOk: false, nextPin: null, error: "Sign in to continue." };
    if (!/^\d{4}$/.test(pin)) {
      return user.pinHash
        ? { pinOk: false, nextPin: null }
        : { pinOk: false, nextPin: null, error: "Create a 4-digit transaction PIN." };
    }
    if (!user.pinHash || !user.pinSalt) {
      const salt = uid();
      return { pinOk: true, nextPin: { salt, hash: await digest(salt, pin) } };
    }
    const hash = await digest(user.pinSalt, pin);
    return { pinOk: hash === user.pinHash, nextPin: null };
  };

  const api = useMemo<AppApi>(() => {
    const user = state.currentUserId ? state.users.find((item) => item.id === state.currentUserId) ?? null : null;
    return {
      user,
      state,
      opportunities: allLive(state),
      async register(form) {
        try {
          const result = await liveApi<Tokens & { user?: { id: string; email: string; phone: string | null; firstName: string; middleName: string; lastName: string; status: string } }>(
            "/auth/register",
            {
              method: "POST",
              auth: false,
              body: JSON.stringify({
                firstName: form.firstName.trim(),
                middleName: form.middleName.trim() || undefined,
                lastName: form.lastName.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
                password: form.password,
                referralCode: form.referralCode.trim() || null,
                acceptedTerms: form.acceptTerms,
                acceptedPrivacy: form.acceptPrivacy,
              }),
            },
          );
          if (result.data.accessToken && result.data.refreshToken) {
            saveApiTokens(result.data.accessToken, result.data.refreshToken);
          }
          const profile =
            result.data.user ??
            (
              await liveApi<{ id: string; email: string; phone: string | null; firstName: string; middleName: string; lastName: string; status: string }>("/profile")
            ).data;
          return apply((draft) => {
            upsertRemoteUser(draft, profile, { feePaidAt: null });
            return { ok: true as const, data: { sessionId: profile.id } };
          });
        } catch (error) {
          if (error instanceof ApiError) return { ok: false, error: error.message };
          // Never create a browser-only account when the API call fails — those users never appear in admin.
          return {
            ok: false,
            error: error instanceof Error ? error.message : "Could not reach the registration service. Try again.",
          };
        }
      },
      async verifyOtp(code) {
        const current = stateRef.current;
        const registering = current.users.find((item) => item.id === current.currentUserId);
        const purpose = registering?.status === "otp_pending" ? "register" : "login_2fa";
        const userId = purpose === "register" ? current.currentUserId : current.pending2faUserId;
        const challenge = current.challenges.find((item) => item.userId === userId && item.purpose === purpose);
        if (!challenge) return { ok: false, error: "Request a new verification code." };
        const codeHash = await digest(challenge.salt, code.trim());
        return apply((draft) => verifyOtp(draft, codeHash, deviceLabel()));
      },
      async resendOtp() {
        const current = stateRef.current;
        const registering = current.users.find((item) => item.id === current.currentUserId);
        const purpose = registering?.status === "otp_pending" ? "register" : current.pending2faUserId ? "login_2fa" : "register";
        const userId = purpose === "login_2fa" ? current.pending2faUserId : current.currentUserId;
        if (!userId) return { ok: false, error: "Request a new verification code." };
        const preview = oneTimeCode();
        const salt = uid();
        const hash = await digest(salt, preview);
        return apply((draft) => resendOtp(draft, purpose, userId, { hash, salt, preview }));
      },
      async login(email, password) {
        try {
          const result = await liveApi<Tokens>("/auth/login", {
            method: "POST",
            auth: false,
            body: JSON.stringify({ email: email.trim(), password }),
          });
          saveApiTokens(result.data.accessToken, result.data.refreshToken);
          const [profile, account, kyc] = await Promise.all([
            liveApi<{ id: string; email: string; phone: string | null; firstName: string; middleName: string; lastName: string; status: string }>("/profile"),
            liveApi<{ onboardingFeePaid: boolean; status: string; canInvest: boolean }>("/account"),
            liveApi<RemoteKycView>("/kyc").catch(() => null),
          ]);
          return apply((draft) => {
            const user = upsertRemoteUser(draft, profile.data, {
              feePaidAt: account.data.onboardingFeePaid ? Date.now() : null,
            });
            user.status = mapAccountStatus(account.data.status);
            if (kyc?.data) applyRemoteKyc(user, kyc.data, account.data.status);
            return { ok: true as const, data: { twoFactor: false, sessionId: profile.data.id } };
          });
        } catch (error) {
          if (error instanceof ApiError) {
            return { ok: false, error: error.message || "Email or password is incorrect." };
          }
          return {
            ok: false,
            error: error instanceof Error ? error.message : "Could not reach the sign-in service. Try again.",
          };
        }
      },
      logout() {
        clearApiTokens();
        apply(logoutUser);
      },
      logoutOthers() {
        return apply(logoutOthers);
      },
      async requestReset(email) {
        const existing = stateRef.current.users.find((item) => item.email === email.trim().toLowerCase());
        if (!existing) return apply((draft) => requestReset(draft, email, null));
        const preview = oneTimeCode();
        const salt = uid();
        const otp = { hash: await digest(salt, preview), salt, preview };
        return apply((draft) => requestReset(draft, email, otp));
      },
      async resetPassword(code, password) {
        const current = stateRef.current;
        const challenge = current.challenges.find((item) => item.userId === current.passwordResetUserId && item.purpose === "reset");
        if (!challenge) return { ok: false, error: "Request a new reset code." };
        const codeHash = await digest(challenge.salt, code.trim());
        const salt = uid();
        const hash = await digest(salt, password);
        return apply((draft) => resetPassword(draft, codeHash, { salt, hash }));
      },
      async changePassword(currentPassword, nextPassword) {
        const user = stateRef.current.users.find((item) => item.id === stateRef.current.currentUserId);
        if (!user) return { ok: false, error: "Sign in to continue." };
        const currentHash = await digest(user.passwordSalt, currentPassword);
        const salt = uid();
        const hash = await digest(salt, nextPassword);
        return apply((draft) => changePassword(draft, currentHash, { salt, hash }, currentHash === user.passwordHash));
      },
      async setPin(pin, current) {
        const user = stateRef.current.users.find((item) => item.id === stateRef.current.currentUserId);
        if (!user) return { ok: false, error: "Sign in to continue." };
        if (!/^\d{4}$/.test(pin)) return { ok: false, error: "Use a 4-digit PIN." };
        const salt = uid();
        const next = { salt, hash: await digest(salt, pin) };
        const pinOk = user.pinHash && user.pinSalt ? (await digest(user.pinSalt, current ?? "")) === user.pinHash : true;
        return apply((draft) => setPin(draft, pinOk, next, Boolean(user.pinHash)));
      },
      async setTwoFactor(enabled, password) {
        const user = stateRef.current.users.find((item) => item.id === stateRef.current.currentUserId);
        if (!user) return { ok: false, error: "Sign in to continue." };
        const hash = await digest(user.passwordSalt, password);
        return apply((draft) => setTwoFactor(draft, enabled, hash === user.passwordHash));
      },
      async payOnboardingFee(_method, _outcome, _reference) {
        try {
          const result = await liveApi<{ reference: string; status: string; checkout: Checkout | null }>("/onboarding-fee/initialize", {
            method: "POST",
            idempotencyKey: newIdempotencyKey(),
            body: JSON.stringify({}),
          });
          const checkoutUrl = result.data.checkout?.authorizationUrl ?? null;
          apply((draft) => {
            const user = draft.users.find((item) => item.id === draft.currentUserId);
            if (!user) return { ok: false as const, error: "Sign in to continue." };
            draft.fees.unshift({
              id: uid(),
              userId: user.id,
              feeType: "client_onboarding_fee",
              name: "Client Onboarding Fee",
              amount: 5000,
              status: "pending",
              paymentMethod: "Paystack",
              reference: result.data.reference,
              purpose: "Client onboarding before KYC",
              createdAt: Date.now(),
              paidAt: null,
            });
            return { ok: true as const };
          });
          return { ok: true as const, data: { reference: result.data.reference, checkoutUrl } };
        } catch (error) {
          if (error instanceof ApiError) return { ok: false, error: error.message };
          return {
            ok: false,
            error: error instanceof Error ? error.message : "Could not start Paystack payment. Try again.",
          };
        }
      },
      async syncOnboardingFee() {
        try {
          const account = await liveApi<{ onboardingFeePaid: boolean; status: string }>("/account");
          const paid = Boolean(account.data.onboardingFeePaid);
          apply((draft) => {
            const user = draft.users.find((item) => item.id === draft.currentUserId);
            if (!user) return { ok: false as const, error: "Sign in to continue." };
            user.feePaidAt = paid ? user.feePaidAt ?? Date.now() : null;
            user.status = mapAccountStatus(account.data.status);
            return { ok: true as const };
          });
          return { ok: true as const, data: { paid } };
        } catch (error) {
          if (error instanceof ApiError) return { ok: false, error: error.message };
          return {
            ok: false,
            error: error instanceof Error ? error.message : "Could not verify Client Onboarding Fee status.",
          };
        }
      },
      async reconcileOnboardingFee(reference) {
        try {
          const result = await liveApi<{ paid: boolean; reference?: string | null; status?: string; reconciled?: boolean }>(
            "/onboarding-fee/reconcile",
            {
              method: "POST",
              body: JSON.stringify(reference ? { reference } : {}),
            },
          );
          const account = await liveApi<{ onboardingFeePaid: boolean; status: string }>("/account");
          const paid = Boolean(result.data.paid || account.data.onboardingFeePaid);
          apply((draft) => {
            const user = draft.users.find((item) => item.id === draft.currentUserId);
            if (!user) return { ok: false as const, error: "Sign in to continue." };
            user.feePaidAt = paid ? user.feePaidAt ?? Date.now() : null;
            user.status = mapAccountStatus(account.data.status);
            if (paid && user.status === "kyc_locked") user.status = "kyc_in_progress";
            const ref = result.data.reference;
            if (ref && paid) {
              const fee = draft.fees.find((item) => item.reference === ref && item.userId === user.id);
              if (fee) {
                fee.status = "successful";
                fee.paidAt = Date.now();
              } else {
                draft.fees.unshift({
                  id: uid(),
                  userId: user.id,
                  feeType: "client_onboarding_fee",
                  name: "Client Onboarding Fee",
                  amount: 5000,
                  status: "successful",
                  paymentMethod: "Paystack",
                  reference: ref,
                  purpose: "Client onboarding before KYC",
                  createdAt: Date.now(),
                  paidAt: Date.now(),
                });
              }
            }
            return { ok: true as const };
          });
          return {
            ok: true as const,
            data: { paid, reference: result.data.reference, status: result.data.status },
          };
        } catch (error) {
          if (error instanceof ApiError) return { ok: false, error: error.message };
          return {
            ok: false,
            error: error instanceof Error ? error.message : "Could not confirm Paystack payment with Tefu.",
          };
        }
      },
      async verifyPayment(reference) {
        try {
          const result = await liveApi<{ reference: string; status: string; purpose?: string; amount?: number }>("/payments/verify", {
            method: "POST",
            body: JSON.stringify({ reference }),
          });
          const account = await liveApi<{ onboardingFeePaid: boolean; status: string }>("/account").catch(() => null);
          apply((draft) => {
            const user = draft.users.find((item) => item.id === draft.currentUserId);
            if (!user) return { ok: false as const, error: "Sign in to continue." };
            const status = String(result.data.status).toLowerCase();
            const paid =
              status === "successful" ||
              status === "success" ||
              Boolean(account?.data.onboardingFeePaid);
            const fee = draft.fees.find((item) => item.reference === reference && item.userId === user.id);
            if (fee) {
              fee.status = paid ? "successful" : status === "failed" ? "failed" : "pending";
              fee.paidAt = paid ? Date.now() : null;
              fee.paymentMethod = "Paystack";
            }
            if (paid && (result.data.purpose === "ONBOARDING_FEE" || account?.data.onboardingFeePaid)) {
              user.feePaidAt = Date.now();
              if (user.status === "kyc_locked") user.status = "kyc_in_progress";
            }
            if (account?.data.status) user.status = mapAccountStatus(account.data.status);
            if (paid && result.data.purpose === "DEPOSIT" && result.data.amount != null) {
              user.wallet.available += result.data.amount;
              user.wallet.balance = user.wallet.available + user.wallet.locked;
            }
            return { ok: true as const };
          });
          return { ok: true as const, data: result.data };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : "Payment verification failed." };
        }
      },
      async syncKyc() {
        if (!hasApiSession()) return { ok: true as const };
        try {
          const [account, kyc] = await Promise.all([
            liveApi<{ onboardingFeePaid: boolean; status: string }>("/account"),
            liveApi<RemoteKycView>("/kyc"),
          ]);
          apply((draft) => {
            const user = draft.users.find((item) => item.id === draft.currentUserId);
            if (!user) return { ok: false as const, error: "Sign in to continue." };
            user.feePaidAt = account.data.onboardingFeePaid ? user.feePaidAt ?? Date.now() : null;
            applyRemoteKyc(user, kyc.data, account.data.status);
            return { ok: true as const };
          });
          return { ok: true as const };
        } catch (error) {
          if (error instanceof ApiError) return { ok: false, error: error.message };
          return { ok: false, error: error instanceof Error ? error.message : "Could not refresh KYC status." };
        }
      },
      async savePersonal(info) {
        if (hasApiSession()) {
          try {
            const result = await liveApi<RemoteKycView>("/kyc", {
              method: "PATCH",
              body: JSON.stringify({
                dateOfBirth: info.dob,
                gender: info.gender,
                nationality: info.nationality,
                address: info.address,
                state: info.state,
                lga: info.lga,
              }),
            });
            apply((draft) => {
              const user = draft.users.find((item) => item.id === draft.currentUserId);
              if (!user) return { ok: false as const, error: "Sign in to continue." };
              const local = savePersonal(draft, info);
              if (!local.ok) return local;
              applyRemoteKyc(user, result.data);
              return { ok: true as const };
            });
            return { ok: true as const };
          } catch (error) {
            if (error instanceof ApiError) return { ok: false, error: error.message };
            return { ok: false, error: error instanceof Error ? error.message : "Could not save personal information." };
          }
        }
        return apply((draft) => savePersonal(draft, info));
      },
      async submitNin(nin) {
        const typed = nin.replace(/\D/g, "");
        if (!/^\d{11}$/.test(typed)) {
          return { ok: false as const, error: "Enter the 11-digit NIN yourself. Phone number cannot be used." };
        }
        if (hasApiSession()) {
          try {
            const result = await liveApi<RemoteKycView>("/kyc/nin/verify", {
              method: "POST",
              body: JSON.stringify({ nin: typed, consent: true }),
            });
            apply((draft) => {
              const user = draft.users.find((item) => item.id === draft.currentUserId);
              if (!user) return { ok: false as const, error: "Sign in to continue." };
              applyRemoteKyc(user, result.data);
              return { ok: true as const };
            });
            return { ok: true as const };
          } catch (error) {
            if (error instanceof ApiError) return { ok: false, error: error.message };
            return { ok: false, error: error instanceof Error ? error.message : "NIN verification failed." };
          }
        }
        const salt = uid();
        const hash = await digest(salt, typed);
        return apply((draft) => submitNin(draft, typed, hash));
      },
      async submitBvn(bvn) {
        const typed = bvn.replace(/\D/g, "");
        if (!/^\d{11}$/.test(typed)) {
          return { ok: false as const, error: "Enter the 11-digit BVN yourself. Phone number cannot be used." };
        }
        if (hasApiSession()) {
          try {
            const result = await liveApi<RemoteKycView>("/kyc/bvn/verify", {
              method: "POST",
              body: JSON.stringify({ bvn: typed, consent: true }),
            });
            apply((draft) => {
              const user = draft.users.find((item) => item.id === draft.currentUserId);
              if (!user) return { ok: false as const, error: "Sign in to continue." };
              applyRemoteKyc(user, result.data);
              return { ok: true as const };
            });
            return { ok: true as const };
          } catch (error) {
            if (error instanceof ApiError) return { ok: false, error: error.message };
            return { ok: false, error: error instanceof Error ? error.message : "BVN verification failed." };
          }
        }
        const salt = uid();
        const hash = await digest(salt, typed);
        return apply((draft) => submitBvn(draft, typed, hash));
      },
      async resolveBank(input) {
        const accountNumber = input.accountNumber.replace(/\D/g, "");
        if (!input.bankName.trim()) return { ok: false as const, error: "Select a bank first." };
        if (!/^\d{10}$/.test(accountNumber)) {
          return { ok: false as const, error: "Enter the full 10-digit account number." };
        }
        if (!hasApiSession()) {
          return {
            ok: true as const,
            data: {
              accountNumber,
              accountName: `${input.bankName} Account ${accountNumber.slice(-4)}`,
            },
          };
        }
        try {
          const result = await liveApi<{ accountName: string; accountNumber: string }>("/kyc/bank-account/resolve", {
            method: "POST",
            body: JSON.stringify({ bankName: input.bankName, accountNumber }),
          });
          return {
            ok: true as const,
            data: {
              accountName: result.data.accountName,
              accountNumber: result.data.accountNumber || accountNumber,
            },
          };
        } catch (error) {
          if (error instanceof ApiError) return { ok: false, error: error.message };
          return { ok: false, error: error instanceof Error ? error.message : "Could not resolve the account name." };
        }
      },
      async saveBank(input) {
        if (hasApiSession()) {
          try {
            const result = await liveApi<RemoteKycView>("/kyc/bank-account/verify", {
              method: "POST",
              body: JSON.stringify({
                bankName: input.bankName,
                accountNumber: input.accountNumber.replace(/\D/g, ""),
                accountName: input.accountName || undefined,
              }),
            });
            apply((draft) => {
              const user = draft.users.find((item) => item.id === draft.currentUserId);
              if (!user) return { ok: false as const, error: "Sign in to continue." };
              applyRemoteKyc(user, result.data);
              return { ok: true as const };
            });
            return { ok: true as const };
          } catch (error) {
            if (error instanceof ApiError) return { ok: false, error: error.message };
            return { ok: false, error: error instanceof Error ? error.message : "Bank verification failed." };
          }
        }
        return apply((draft) => saveBank(draft, input));
      },
      async saveDocument(input) {
        if (hasApiSession()) {
          if (!input.dataUrl) return { ok: false, error: "Choose a document file to upload." };
          try {
            const contentBase64 = input.dataUrl.includes(",") ? input.dataUrl.split(",")[1] : input.dataUrl;
            const result = await liveApi<RemoteKycView>("/kyc/documents", {
              method: "POST",
              body: JSON.stringify({
                kind: "IDENTITY",
                fileName: input.name || `${input.docType || "id"}.bin`,
                contentBase64,
              }),
            });
            apply((draft) => {
              const user = draft.users.find((item) => item.id === draft.currentUserId);
              if (!user) return { ok: false as const, error: "Sign in to continue." };
              const local = saveDocument(draft, input);
              if (!local.ok) return local;
              applyRemoteKyc(user, result.data);
              return { ok: true as const };
            });
            return { ok: true as const };
          } catch (error) {
            if (error instanceof ApiError) return { ok: false, error: error.message };
            return { ok: false, error: error instanceof Error ? error.message : "Document upload failed." };
          }
        }
        return apply((draft) => saveDocument(draft, input));
      },
      async saveSelfie(input) {
        if (hasApiSession()) {
          if (!input.dataUrl) return { ok: false, error: "Choose an identity photo to upload." };
          try {
            const contentBase64 = input.dataUrl.includes(",") ? input.dataUrl.split(",")[1] : input.dataUrl;
            const result = await liveApi<RemoteKycView>("/kyc/documents", {
              method: "POST",
              body: JSON.stringify({
                kind: "SELFIE",
                fileName: input.name || "selfie.jpg",
                contentBase64,
              }),
            });
            apply((draft) => {
              const user = draft.users.find((item) => item.id === draft.currentUserId);
              if (!user) return { ok: false as const, error: "Sign in to continue." };
              const local = saveSelfie(draft, input);
              if (!local.ok) return local;
              applyRemoteKyc(user, result.data);
              return { ok: true as const };
            });
            return { ok: true as const };
          } catch (error) {
            if (error instanceof ApiError) return { ok: false, error: error.message };
            return { ok: false, error: error instanceof Error ? error.message : "Identity photo upload failed." };
          }
        }
        return apply((draft) => saveSelfie(draft, input));
      },
      async submitKyc() {
        if (hasApiSession()) {
          try {
            const result = await liveApi<RemoteKycView>("/kyc/submit", { method: "POST", body: JSON.stringify({}) });
            apply((draft) => {
              const user = draft.users.find((item) => item.id === draft.currentUserId);
              if (!user) return { ok: false as const, error: "Sign in to continue." };
              applyRemoteKyc(user, result.data, "KYC_PENDING_REVIEW");
              user.kyc.events.push({
                status: "Pending Review",
                at: Date.now(),
                note: "KYC was submitted. An admin must approve it before you can use the investment account.",
              });
              return { ok: true as const };
            });
            return { ok: true as const };
          } catch (error) {
            if (error instanceof ApiError) return { ok: false, error: error.message };
            return { ok: false, error: error instanceof Error ? error.message : "Could not submit KYC for review." };
          }
        }
        return apply(submitKyc);
      },
      async createDeposit(amount, _method, _outcome) {
        try {
          const result = await liveApi<{ reference: string; status: string; amount: number; checkout: Checkout | null }>("/wallet/deposit", {
            method: "POST",
            idempotencyKey: newIdempotencyKey(),
            body: JSON.stringify({ amount }),
          });
          apply((draft) => {
            const user = draft.users.find((item) => item.id === draft.currentUserId);
            if (!user) return { ok: false as const, error: "Sign in to continue." };
            draft.deposits.unshift({
              id: uid(),
              userId: user.id,
              amount,
              paymentMethod: "Paystack",
              reference: result.data.reference,
              status: "pending",
              createdAt: Date.now(),
            });
            return { ok: true as const };
          });
          return {
            ok: true as const,
            data: { reference: result.data.reference, checkoutUrl: result.data.checkout?.authorizationUrl ?? null },
          };
        } catch (error) {
          if (error instanceof ApiError) return { ok: false, error: error.message };
          return {
            ok: false,
            error: error instanceof Error ? error.message : "Could not start Paystack deposit. Try again.",
          };
        }
      },
      async requestWithdrawal(bankId, amount, pin) {
        const resolved = await resolvePin(pin);
        if (resolved.error) return { ok: false, error: resolved.error };
        return apply((draft) => requestWithdrawal(draft, bankId, amount, resolved.pinOk, resolved.nextPin));
      },
      async createInvestment(input) {
        const resolved = await resolvePin(input.pin);
        if (resolved.error) return { ok: false, error: resolved.error };
        return apply((draft) =>
          createInvestment(draft, {
            opportunityId: input.opportunityId,
            amount: input.amount,
            accepted: input.accepted,
            pinOk: resolved.pinOk,
            nextPin: resolved.nextPin,
          }),
        );
      },
      createTicket(subject, description) {
        return apply((draft) => createTicket(draft, subject, description));
      },
      closeTicket(id) {
        return apply((draft) => closeTicket(draft, id));
      },
      markRead(id) {
        apply((draft) => {
          markRead(draft, id);
          return { ok: true };
        });
      },
      markAllRead() {
        apply((draft) => {
          markAllRead(draft);
          return { ok: true };
        });
      },
      updateProfile(patch) {
        return apply((draft) => updateProfile(draft, patch));
      },
      updatePrefs(prefs) {
        apply((draft) => {
          updatePrefs(draft, prefs);
          return { ok: true };
        });
      },
      clearDeviceData() {
        const blank = freshState();
        stateRef.current = blank;
        persist(blank);
        syncSession(blank);
        setState(blank);
      },
    };
    // apply closes over the latest ref. Recreate the API when state changes so `user` stays current.
  }, [state]);

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}

export function useClient() {
  const app = useApp();
  if (!app.user) throw new Error("Expected a signed-in client");
  return { ...app, user: app.user };
}
