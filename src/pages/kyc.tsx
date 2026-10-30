import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Banner, Button, PageTitle, Pill, SelectField, TextField } from "../components/ui";
import { useClient } from "../context/AppState";
import { BANKS, GENDERS, ID_TYPES, NIGERIA_STATES } from "../lib/catalog";
import { dateTime, maskId } from "../lib/format";
import { KYC_LOCK_MESSAGE, KYC_STATUS_LABEL, VERIFY_LABEL } from "../lib/labels";
import type { PersonalInfo, User } from "../lib/types";

function underAdminReview(user: User) {
  return user.status === "kyc_pending_review" || user.kyc.status === "pending_review";
}

function steps(user: User) {
  const bank = user.banks.find((item) => item.id === user.kyc.bankAccountId);
  return [
    { to: "/kyc/personal", label: "Personal Information", detail: user.kyc.personalComplete ? "Complete" : "Not Started", done: user.kyc.personalComplete },
    { to: "/kyc/nin", label: "NIN Verification", detail: VERIFY_LABEL[user.kyc.nin.status], done: user.kyc.nin.status === "verified" },
    { to: "/kyc/bvn", label: "BVN Verification", detail: VERIFY_LABEL[user.kyc.bvn.status], done: user.kyc.bvn.status === "verified" },
    { to: "/kyc/bank", label: "Bank Account", detail: bank ? VERIFY_LABEL[bank.status] : "Not Started", done: bank?.status === "verified" },
    { to: "/kyc/documents", label: "Identification Document", detail: user.kyc.document.status === "not_started" ? "Not Started" : "Submitted", done: user.kyc.document.status !== "not_started" },
    { to: "/kyc/selfie", label: "Selfie / Photo", detail: user.kyc.selfie.status === "not_started" ? "Not Started" : "Submitted", done: user.kyc.selfie.status !== "not_started" },
    { to: "/kyc/review", label: "Final Review", detail: user.kyc.status === "approved" ? "Complete" : "Not Started", done: user.kyc.status === "approved" },
  ];
}

export function KycFrame({ children }: { children: ReactNode }) {
  const { user, syncKyc } = useClient();
  useEffect(() => {
    void syncKyc();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh once when KYC shell mounts
  }, [user.id]);
  if (!user.feePaidAt) return <Banner>{KYC_LOCK_MESSAGE}</Banner>;
  const reviewing = underAdminReview(user);
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-[2rem] border border-line bg-paper p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-gold">KYC Completion: {user.kyc.completion}%</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-cream">
          <div className="h-full bg-forest" style={{ width: `${user.kyc.completion}%` }} />
        </div>
        <ul className="mt-4 space-y-1">
          <li>
            <Link to="/onboarding/account" className="block rounded-2xl px-3 py-2 text-sm text-canopy hover:bg-cream">
              ← Back to Account
            </Link>
          </li>
          <li>
            <Link to="/onboarding/fee" className="block rounded-2xl px-3 py-2 text-sm hover:bg-cream">
              Client Onboarding Fee
            </Link>
          </li>
          <li>
            <Link to="/kyc" className="block rounded-2xl px-3 py-2 text-sm hover:bg-cream">
              KYC overview
            </Link>
          </li>
          {steps(user).map((step) => (
            <li key={step.to}>
              <Link
                to={reviewing ? "/kyc/status" : step.to}
                className="block rounded-2xl px-3 py-2 hover:bg-cream"
              >
                <span className="block text-sm">{step.label}</span>
                <span className="text-xs text-muted">{step.detail}</span>
              </Link>
            </li>
          ))}
          <li><Link to="/kyc/status" className="block rounded-2xl px-3 py-2 text-sm hover:bg-cream">KYC Status</Link></li>
        </ul>
      </aside>
      <div>
        {reviewing ? (
          <Banner tone="warn">
            Your KYC is with Tefu for admin review. You cannot change it or use the investment account until an admin approves it.
          </Banner>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function KycHome() {
  const { user } = useClient();
  if (underAdminReview(user)) return <Navigate to="/kyc/status" replace />;
  return (
    <KycFrame>
      <PageTitle
        eyebrow="KYC"
        title="One verification, with NIN and BVN inside it"
        lede="NIN and BVN are not separate onboarding stages. They are required parts of this KYC file. After you submit, an admin must approve before you can invest."
      />
      <p className="mb-4 text-sm">KYC Completion: {user.kyc.completion}%</p>
      <div className="grid gap-3">
        {steps(user).map((step) => (
          <Link key={step.to} to={step.to} className="flex items-center justify-between rounded-3xl border border-line bg-paper px-4 py-3">
            <span>{step.label}</span>
            <Pill status={step.done ? "verified" : "pending"}>{step.detail}</Pill>
          </Link>
        ))}
      </div>
    </KycFrame>
  );
}

export function KycPersonal() {
  const { user, savePersonal } = useClient();
  const [form, setForm] = useState<PersonalInfo>(user.kyc.personal);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (underAdminReview(user)) return <Navigate to="/kyc/status" replace />;
  const locked = user.kyc.nin.status === "verified" || user.kyc.bvn.status === "verified";
  const set = (key: keyof PersonalInfo) => (value: string) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <KycFrame>
      <PageTitle title="Personal information" lede="Use the legal name that should match your NIN and BVN." />
      <form
        className="space-y-4 rounded-[2rem] border border-line bg-paper p-6"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void savePersonal(form).then((result) => {
            setBusy(false);
            setError(result.ok ? "" : result.error);
          });
        }}
      >
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {user.kyc.personalComplete && !error ? <Banner tone="ok">Personal information is saved.</Banner> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Legal first name" value={form.firstName} onChange={set("firstName")} disabled={locked} />
          <TextField label="Middle name" value={form.middleName} onChange={set("middleName")} disabled={locked} />
        </div>
        <TextField label="Last name" value={form.lastName} onChange={set("lastName")} disabled={locked} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Date of birth" type="date" value={form.dob} onChange={set("dob")} />
          <SelectField label="Gender" value={form.gender} onChange={set("gender")} options={GENDERS} />
        </div>
        <TextField label="Nationality" value={form.nationality} onChange={set("nationality")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Phone" value={form.phone} onChange={set("phone")} />
          <TextField label="Email" value={form.email} onChange={set("email")} />
        </div>
        <TextField label="Residential address" value={form.address} onChange={set("address")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="State" value={form.state} onChange={set("state")} options={NIGERIA_STATES} />
          <TextField label="LGA" value={form.lga} onChange={set("lga")} />
        </div>
        <TextField label="Country" value="Nigeria" onChange={() => undefined} disabled hint="This version is for clients in Nigeria." />
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save personal information"}</Button>
      </form>
    </KycFrame>
  );
}

function IdentityCheck({ kind }: { kind: "NIN" | "BVN" }) {
  const { user, submitNin, submitBvn } = useClient();
  const record = kind === "NIN" ? user.kyc.nin : user.kyc.bvn;
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (underAdminReview(user)) return <Navigate to="/kyc/status" replace />;
  const locked = record.status === "verified";
  const digits = value.replace(/\D/g, "");
  const canSubmit = user.kyc.personalComplete && /^\d{11}$/.test(digits);
  return (
    <KycFrame>
      <PageTitle
        title={`${kind} verification`}
        lede={`Type your 11-digit ${kind}. Your phone number is never used for this check.`}
      />
      {!user.kyc.personalComplete ? <Banner>Complete personal information before this check.</Banner> : null}
      <form
        className="mt-4 space-y-4 rounded-[2rem] border border-line bg-paper p-6"
        onSubmit={async (event) => {
          event.preventDefault();
          const typed = value.replace(/\D/g, "");
          if (!/^\d{11}$/.test(typed)) {
            setError(`Enter the full 11-digit ${kind}. Verification does not use your phone number.`);
            return;
          }
          setBusy(true);
          setError("");
          const result = kind === "NIN" ? await submitNin(typed) : await submitBvn(typed);
          setBusy(false);
          setError(result.ok ? "" : result.error);
          if (result.ok) setValue("");
        }}
      >
        <Pill status={record.status}>{VERIFY_LABEL[record.status]}</Pill>
        {record.reason ? <p className="text-sm leading-6">{record.reason}</p> : null}
        {record.last4 ? <p className="text-sm text-muted">Submitted number {maskId(record.last4)}</p> : null}
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {locked ? <Banner tone="ok">This check is verified and cannot be edited here.</Banner> : (
          <>
            <TextField
              label={`${kind} number`}
              value={value}
              onChange={(next) => setValue(next.replace(/\D/g, "").slice(0, 11))}
              placeholder="11 digits"
              autoComplete="off"
            />
            <p className="text-xs leading-5 text-muted">
              You must type the {kind} yourself. Tefu matches it to your legal name and date of birth through Otobill — not your phone number.
            </p>
            <Button type="submit" disabled={busy || !canSubmit}>
              {busy ? "Verifying…" : `Submit ${kind}`}
            </Button>
          </>
        )}
      </form>
    </KycFrame>
  );
}

export function KycNin() {
  return <IdentityCheck kind="NIN" />;
}

export function KycBvn() {
  return <IdentityCheck kind="BVN" />;
}

export function KycBank() {
  const { user, saveBank, resolveBank } = useClient();
  const existing = user.banks.find((item) => item.id === user.kyc.bankAccountId);
  const [bankName, setBankName] = useState(existing?.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(existing?.accountNumber ?? "");
  const [accountName, setAccountName] = useState(existing?.accountName ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const reviewing = underAdminReview(user);
  const digits = accountNumber.replace(/\D/g, "");
  const canVerify = Boolean(bankName && accountName && /^\d{10}$/.test(digits));

  useEffect(() => {
    if (reviewing) return;
    if (!bankName || !/^\d{10}$/.test(digits)) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLookingUp(true);
      setError("");
      void resolveBank({ bankName, accountNumber: digits }).then((result) => {
        if (cancelled) return;
        setLookingUp(false);
        if (!result.ok || !result.data) {
          setAccountName("");
          setError(result.ok ? "Could not resolve account name." : result.error);
          return;
        }
        setAccountName(result.data.accountName);
      });
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bankName, digits, resolveBank, reviewing]);

  if (reviewing) return <Navigate to="/kyc/status" replace />;

  return (
    <KycFrame>
      <PageTitle
        title="Bank account"
        lede="Select your bank and type the 10-digit account number. The account name is pulled automatically for verification."
      />
      <form
        className="space-y-4 rounded-[2rem] border border-line bg-paper p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canVerify) {
            setError("Select a bank and enter a valid account number so the account name can load.");
            return;
          }
          setBusy(true);
          void saveBank({ bankName, accountNumber: digits, accountName, id: existing?.id }).then((result) => {
            setBusy(false);
            setError(result.ok ? "" : result.error);
          });
        }}
      >
        {existing ? <Pill status={existing.status}>{VERIFY_LABEL[existing.status]}</Pill> : null}
        {existing?.reason ? <p className="text-sm">{existing.reason}</p> : null}
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {lookingUp ? <Banner>Looking up account name…</Banner> : null}
        {accountName && !lookingUp ? <Banner tone="ok">Account name found: {accountName}</Banner> : null}
        <SelectField
          label="Bank name"
          value={bankName}
          onChange={(next) => {
            setBankName(next);
            setAccountName("");
          }}
          options={BANKS}
        />
        <TextField
          label="Account number"
          value={accountNumber}
          onChange={(next) => {
            const value = next.replace(/\D/g, "").slice(0, 10);
            setAccountNumber(value);
            if (value.length < 10) setAccountName("");
          }}
          placeholder="10 digits"
          autoComplete="off"
        />
        <TextField
          label="Account name"
          value={lookingUp ? "Looking up…" : accountName}
          onChange={() => undefined}
          disabled
          hint="Filled automatically after you enter a valid account number."
        />
        <Button type="submit" disabled={busy || lookingUp || !canVerify}>
          {busy ? "Verifying…" : "Confirm bank account"}
        </Button>
      </form>
    </KycFrame>
  );
}

async function readFile(file: File) {
  if (file.size > 700_000) return null;
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function KycDocs() {
  const { user, saveDocument, state } = useClient();
  const [docType, setDocType] = useState(user.kyc.document.docType);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const stored = state.documents.find((item) => item.id === user.kyc.document.id);
  if (underAdminReview(user)) return <Navigate to="/kyc/status" replace />;
  return (
    <KycFrame>
      <PageTitle title="Identification document" lede="Upload a government-issued ID, passport, driver's licence, national ID, or another approved identification." />
      <form
        className="space-y-4 rounded-[2rem] border border-line bg-paper p-6"
        onSubmit={(event) => event.preventDefault()}
      >
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {note ? <Banner tone="ok">{note}</Banner> : null}
        <SelectField label="Document type" value={docType} onChange={setDocType} options={ID_TYPES} />
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">File</span>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const dataUrl = await readFile(file);
              const result = await saveDocument({ docType, name: file.name, dataUrl });
              if (!result.ok) setError(result.error);
              else {
                setError("");
                setNote(dataUrl ? "Document received." : "Document received. The preview was skipped because the file is large.");
              }
            }}
          />
        </label>
        {stored?.dataUrl ? <img src={stored.dataUrl} alt="Identification preview" className="max-h-48 rounded-2xl border border-line" /> : null}
        {user.kyc.document.name ? <p className="text-sm text-muted">Current file: {user.kyc.document.name}</p> : null}
      </form>
    </KycFrame>
  );
}

export function KycSelfie() {
  const { user, saveSelfie, state } = useClient();
  const [error, setError] = useState("");
  const stored = state.documents.find((item) => item.id === user.kyc.selfie.id);
  if (underAdminReview(user)) return <Navigate to="/kyc/status" replace />;
  return (
    <KycFrame>
      <PageTitle title="Identity photo" lede="A clear photo of your face is included in the KYC file." />
      <div className="space-y-4 rounded-[2rem] border border-line bg-paper p-6">
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <input
          type="file"
          accept="image/*"
          capture="user"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const dataUrl = await readFile(file);
            const result = await saveSelfie({ name: file.name, dataUrl });
            setError(result.ok ? "" : result.error);
          }}
        />
        {stored?.dataUrl ? <img src={stored.dataUrl} alt="Identity photo preview" className="max-h-56 rounded-2xl" /> : null}
        {user.kyc.selfie.name ? <p className="text-sm text-muted">Current photo: {user.kyc.selfie.name}</p> : null}
      </div>
    </KycFrame>
  );
}

export function KycReview() {
  const { user, submitKyc } = useClient();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (underAdminReview(user)) return <Navigate to="/kyc/status" replace />;
  const bank = user.banks.find((item) => item.id === user.kyc.bankAccountId);
  const ready =
    user.kyc.personalComplete &&
    user.kyc.nin.status === "verified" &&
    user.kyc.bvn.status === "verified" &&
    bank?.status === "verified" &&
    user.kyc.document.status !== "not_started" &&
    user.kyc.selfie.status !== "not_started";
  return (
    <KycFrame>
      <PageTitle
        title="Final review"
        lede="Submit your file for admin review. You cannot deposit or invest until an admin approves your KYC."
      />
      <p className="mb-4 font-serif text-2xl text-forest">KYC Completion: {user.kyc.completion}%</p>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <ul className="space-y-2">
        {steps(user).map((step) => (
          <li key={step.label} className="flex justify-between rounded-2xl border border-line bg-paper px-4 py-3 text-sm">
            <span>{step.label}</span><span>{step.detail}</span>
          </li>
        ))}
      </ul>
      <Button
        className="mt-5"
        disabled={!ready || busy || user.status === "active"}
        onClick={() => {
          setBusy(true);
          void submitKyc().then((result) => {
            setBusy(false);
            if (!result.ok) setError(result.error);
            else navigate("/kyc/status");
          });
        }}
      >
        {user.status === "active" ? "KYC already approved" : busy ? "Submitting…" : "Submit KYC for admin review"}
      </Button>
    </KycFrame>
  );
}

export function KycStatus() {
  const { user, syncKyc } = useClient();
  useEffect(() => {
    void syncKyc();
    const timer = window.setInterval(() => {
      void syncKyc();
    }, 30_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);
  const reviewing = underAdminReview(user);
  return (
    <KycFrame>
      <PageTitle
        title="KYC status"
        lede={
          user.kyc.status === "not_started"
            ? "KYC has not begun because the onboarding fee has not been paid."
            : reviewing
              ? "Waiting for admin approval. You cannot use the investment account until this is approved."
              : KYC_STATUS_LABEL[user.kyc.status]
        }
      />
      <div className="rounded-[2rem] border border-line bg-paper p-6">
        <Pill status={user.kyc.status}>{KYC_STATUS_LABEL[user.kyc.status]}</Pill>
        <p className="mt-4 font-serif text-3xl text-forest">KYC Completion: {user.kyc.completion}%</p>
        {reviewing ? (
          <Banner tone="warn">
            Your KYC was submitted and is locked for admin review. Deposit, withdraw, and invest stay unavailable until approval.
          </Banner>
        ) : null}
        {user.kyc.status === "approved" || user.status === "active" ? <p className="mt-2 text-sm text-ok">KYC: Verified — your account is active.</p> : null}
        {user.kyc.rejectionReason ? <Banner tone="danger">{user.kyc.rejectionReason}</Banner> : null}
        <ul className="mt-4 space-y-3 text-sm">
          {user.kyc.events.map((event) => (
            <li key={`${event.status}-${event.at}`}>
              <span className="font-medium">{event.status}</span>
              <span className="text-muted"> · {dateTime(event.at)}</span>
              <p className="text-muted">{event.note}</p>
            </li>
          ))}
          {user.kyc.submittedAt ? <li>Submitted {dateTime(user.kyc.submittedAt)}</li> : null}
          {user.kyc.approvedAt ? <li>Approved {dateTime(user.kyc.approvedAt)}</li> : null}
        </ul>
        {user.status === "active" ? (
          <Link to="/dashboard" className="mt-5 inline-flex rounded-full bg-forest px-5 py-2.5 text-sm text-gold2">
            Go to dashboard
          </Link>
        ) : null}
        {(user.status === "kyc_rejected" || user.kyc.status === "requires_update" || user.kyc.status === "rejected") && !reviewing ? (
          <Link to="/kyc" className="mt-5 inline-flex rounded-full border border-line px-5 py-2.5 text-sm text-forest">
            Update KYC and resubmit
          </Link>
        ) : null}
      </div>
    </KycFrame>
  );
}
