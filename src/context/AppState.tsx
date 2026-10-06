import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import {
  changePassword,
  closeTicket,
  createDeposit,
  createInvestment,
  createTicket,
  loginUser,
  logoutOthers,
  logoutUser,
  markAllRead,
  markRead,
  payOnboardingFee,
  registerUser,
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
import { deviceLabel, digest, oneTimeCode, uid } from "../lib/format";
import { allLive } from "../lib/selectors";
import { freshState, loadState, persist, syncSession } from "../lib/storage";
import type { ActionResult, AppState, PersonalInfo, RegisterForm, User } from "../lib/types";

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
  payOnboardingFee: (method: string, outcome: "successful" | "failed" | "pending", reference: string) => ActionResult<{ reference: string }>;
  savePersonal: (info: PersonalInfo) => ActionResult;
  submitNin: (nin: string) => Promise<ActionResult>;
  submitBvn: (bvn: string) => Promise<ActionResult>;
  saveBank: (input: { bankName: string; accountNumber: string; accountName: string; id?: string }) => ActionResult;
  saveDocument: (input: { docType: string; name: string; dataUrl: string | null }) => ActionResult;
  saveSelfie: (input: { name: string; dataUrl: string | null }) => ActionResult;
  submitKyc: () => ActionResult;
  createDeposit: (amount: number, method: string, outcome: "successful" | "failed") => ActionResult<{ reference: string }>;
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
  stateRef.current = state;

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
        const passwordSalt = uid();
        const passwordHash = await digest(passwordSalt, form.password);
        return apply((draft) => registerUser(draft, form, { passwordSalt, passwordHash }, deviceLabel()));
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
        const existing = stateRef.current.users.find((item) => item.email === email.trim().toLowerCase());
        const passwordHash = await digest(existing?.passwordSalt ?? "missing-account", password);
        const matched = Boolean(existing && existing.passwordHash === passwordHash);
        let otp: { hash: string; salt: string; preview: string } | undefined;
        if (existing?.twoFactor && matched) {
          const preview = oneTimeCode();
          const salt = uid();
          otp = { hash: await digest(salt, preview), salt, preview };
        }
        return apply((draft) => loginUser(draft, email, passwordHash, matched, deviceLabel(), otp));
      },
      logout() {
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
      payOnboardingFee(method, outcome, reference) {
        return apply((draft) => payOnboardingFee(draft, method, outcome, reference));
      },
      savePersonal(info) {
        return apply((draft) => savePersonal(draft, info));
      },
      async submitNin(nin) {
        const salt = uid();
        const hash = await digest(salt, nin);
        return apply((draft) => submitNin(draft, nin, hash));
      },
      async submitBvn(bvn) {
        const salt = uid();
        const hash = await digest(salt, bvn);
        return apply((draft) => submitBvn(draft, bvn, hash));
      },
      saveBank(input) {
        return apply((draft) => saveBank(draft, input));
      },
      saveDocument(input) {
        return apply((draft) => saveDocument(draft, input));
      },
      saveSelfie(input) {
        return apply((draft) => saveSelfie(draft, input));
      },
      submitKyc() {
        return apply(submitKyc);
      },
      createDeposit(amount, method, outcome) {
        return apply((draft) => createDeposit(draft, amount, method, outcome));
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
