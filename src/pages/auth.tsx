import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthFrame, Guest } from "../components/shell";
import { Banner, Button, CheckField, Modal, OtpBoxes, TextField } from "../components/ui";
import { useApp } from "../context/AppState";
import { AGREEMENTS } from "../lib/catalog";
import { formatPhone, passwordIssue } from "../lib/format";
import { homePath } from "../lib/selectors";

export function LoginPage() {
  return (
    <Guest>
      <LoginForm />
    </Guest>
  );
}

function LoginForm() {
  const { login } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <AuthFrame title="Welcome back" lede="Sign in to continue your account, KYC, wallet, or investments.">
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const result = await login(email, password);
          setBusy(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          navigate(result.data?.twoFactor ? "/verify" : "/dashboard");
        }}
      >
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
        <div className="flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="text-canopy">Forgot password</Link>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Log in"}</Button>
        <p className="text-sm text-muted">New to Tefu? <Link to="/register" className="text-forest">Create an account</Link></p>
      </form>
    </AuthFrame>
  );
}

export function RegisterPage() {
  return (
    <Guest>
      <RegisterForm />
    </Guest>
  );
}

function RegisterForm() {
  const { register } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    referralCode: "",
    acceptTerms: false,
    acceptPrivacy: false,
  });
  const [doc, setDoc] = useState<"terms" | "privacy" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <AuthFrame title="Create your account" lede="After this, you verify a code, pay the Client Onboarding Fee, and only then begin KYC.">
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const passwordError = passwordIssue(form.password);
          if (passwordError) {
            setError(passwordError);
            return;
          }
          if (form.password !== form.confirmPassword) {
            setError("Passwords do not match.");
            return;
          }
          setBusy(true);
          const result = await register(form);
          setBusy(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          navigate("/verify");
        }}
      >
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="First name" value={form.firstName} onChange={set("firstName")} autoComplete="given-name" />
          <TextField label="Middle name" value={form.middleName} onChange={set("middleName")} hint="Optional" />
        </div>
        <TextField label="Last name" value={form.lastName} onChange={set("lastName")} autoComplete="family-name" />
        <TextField label="Email" type="email" value={form.email} onChange={set("email")} autoComplete="email" />
        <TextField label="Phone number" value={form.phone} onChange={set("phone")} placeholder="080…" autoComplete="tel" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Password" type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
          <TextField label="Confirm password" type="password" value={form.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" />
        </div>
        <TextField label="Referral code" value={form.referralCode} onChange={set("referralCode")} hint="Optional. Stored with your account. Rewards are not part of this version." />
        <CheckField checked={form.acceptTerms} onChange={(checked) => setForm((current) => ({ ...current, acceptTerms: checked }))}>
          I accept the <button type="button" className="text-canopy underline" onClick={() => setDoc("terms")}>Terms & Conditions</button>
        </CheckField>
        <CheckField checked={form.acceptPrivacy} onChange={(checked) => setForm((current) => ({ ...current, acceptPrivacy: checked }))}>
          I accept the <button type="button" className="text-canopy underline" onClick={() => setDoc("privacy")}>Privacy Policy</button>
        </CheckField>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</Button>
        <p className="text-sm text-muted">Already registered? <Link to="/login" className="text-forest">Log in</Link></p>
      </form>
      {doc ? <Modal title={AGREEMENTS[doc].title} onClose={() => setDoc(null)}>{AGREEMENTS[doc].body}</Modal> : null}
    </AuthFrame>
  );
}

export function OtpPage() {
  const { user, state, verifyOtp, resendOtp } = useApp();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const registering = user?.status === "otp_pending";
  const userId = registering ? user?.id : state.pending2faUserId;
  const purpose = registering ? "register" : "login_2fa";
  const subject = state.users.find((item) => item.id === userId);
  const challenge = state.challenges.find((item) => item.userId === userId && item.purpose === purpose);

  if (!subject || !challenge) return <Navigate to="/login" replace />;
  if (user && user.status !== "otp_pending") return <Navigate to={homePath(user)} replace />;

  return (
    <AuthFrame
      title={registering ? "Verify email and phone" : "Confirm it is you"}
      lede={`Enter the 6-digit code for ${subject.email} and ${formatPhone(subject.phone)}. It expires in five minutes.`}
    >
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const result = await verifyOtp(code);
          setBusy(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          navigate(registering ? "/onboarding/fee" : "/dashboard");
        }}
      >
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {info ? <Banner tone="ok">{info}</Banner> : null}
        <OtpBoxes value={code} onChange={setCode} />
        <div className="rounded-3xl border border-dashed border-line bg-paper p-4 text-sm leading-6">
          <p className="text-xs uppercase tracking-[0.14em] text-gold">Demonstration delivery</p>
          <p className="mt-2">A live system would send this only by SMS and email. The code for this device is <strong className="font-serif text-lg text-forest">{challenge.previewCode}</strong>.</p>
          <p className="mt-2 text-muted">Wrong attempts used: {challenge.attempts} of {challenge.maxAttempts}.</p>
        </div>
        <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify code"}</Button>
        <button
          type="button"
          className="text-sm text-canopy"
          onClick={async () => {
            const result = await resendOtp();
            if (!result.ok) setError(result.error);
            else {
              setError("");
              setInfo("A new code has replaced the previous one.");
              setCode("");
            }
          }}
        >
          Resend code
        </button>
      </form>
    </AuthFrame>
  );
}

export function ForgotPage() {
  return (
    <Guest>
      <ForgotForm />
    </Guest>
  );
}

function ForgotForm() {
  const { requestReset } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <AuthFrame title="Reset your password" lede="We will issue a code to the email on the account.">
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const result = await requestReset(email);
          setBusy(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          navigate("/reset-password");
        }}
      >
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <TextField label="Email" type="email" value={email} onChange={setEmail} />
        <Button type="submit" className="w-full" disabled={busy}>Send code</Button>
        <Link to="/login" className="block text-sm text-canopy">Back to log in</Link>
      </form>
    </AuthFrame>
  );
}

export function ResetPage() {
  const { state, resetPassword } = useApp();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const challenge = state.challenges.find((item) => item.userId === state.passwordResetUserId && item.purpose === "reset");
  if (!challenge) {
    return (
      <AuthFrame title="Reset code needed" lede="Request a new code to choose a password.">
        <Link to="/forgot-password" className="text-sm text-canopy">Request a code</Link>
      </AuthFrame>
    );
  }
  return (
    <AuthFrame title="Choose a new password" lede="The reset code expires in five minutes. Expired codes are rejected.">
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (password !== confirm) {
            setError("Passwords do not match.");
            return;
          }
          const issue = passwordIssue(password);
          if (issue) {
            setError(issue);
            return;
          }
          const result = await resetPassword(code, password);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          navigate("/login");
        }}
      >
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <OtpBoxes value={code} onChange={setCode} />
        <p className="text-sm text-muted">Demonstration code: <strong>{challenge.previewCode}</strong></p>
        <TextField label="New password" type="password" value={password} onChange={setPassword} />
        <TextField label="Confirm password" type="password" value={confirm} onChange={setConfirm} />
        <Button type="submit" className="w-full">Update password</Button>
      </form>
    </AuthFrame>
  );
}

export function SuspendedPage() {
  const { user, logout } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AuthFrame title="Account suspended" lede="This account cannot invest, deposit, or withdraw. Contact support if you believe this is a mistake.">
      <Button onClick={logout}>Log out</Button>
    </AuthFrame>
  );
}
