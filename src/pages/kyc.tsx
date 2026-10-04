import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Banner, Button, PageTitle, Pill, SelectField, TextField } from "../components/ui";
import { useClient } from "../context/AppState";
import { BANKS, GENDERS, ID_TYPES, NIGERIA_STATES } from "../lib/catalog";
import { dateTime, maskId } from "../lib/format";
import { KYC_LOCK_MESSAGE, KYC_STATUS_LABEL, VERIFY_LABEL } from "../lib/labels";
import type { PersonalInfo, User } from "../lib/types";

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
  const { user } = useClient();
  if (!user.feePaidAt) return <Banner>{KYC_LOCK_MESSAGE}</Banner>;
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-[2rem] border border-line bg-paper p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-gold">KYC Completion: {user.kyc.completion}%</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-cream">
          <div className="h-full bg-forest" style={{ width: `${user.kyc.completion}%` }} />
        </div>
        <ul className="mt-4 space-y-1">
          {steps(user).map((step) => (
            <li key={step.to}>
              <Link to={step.to} className="block rounded-2xl px-3 py-2 hover:bg-cream">
                <span className="block text-sm">{step.label}</span>
                <span className="text-xs text-muted">{step.detail}</span>
              </Link>
            </li>
          ))}
          <li><Link to="/kyc/status" className="block rounded-2xl px-3 py-2 text-sm hover:bg-cream">KYC Status</Link></li>
        </ul>
      </aside>
      <div>{children}</div>
    </div>
  );
}

export function KycHome() {
  const { user } = useClient();
  return (
    <KycFrame>
      <PageTitle
        eyebrow="KYC"
        title="One verification, with NIN and BVN inside it"
        lede="NIN and BVN are not separate onboarding stages. They are required parts of this KYC file."
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
  const locked = user.kyc.nin.status === "verified" || user.kyc.bvn.status === "verified";
  const set = (key: keyof PersonalInfo) => (value: string) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <KycFrame>
      <PageTitle title="Personal information" lede="Use the legal name that should match your NIN and BVN." />
      <form
        className="space-y-4 rounded-[2rem] border border-line bg-paper p-6"
        onSubmit={(event) => {
          event.preventDefault();
          const result = savePersonal(form);
          setError(result.ok ? "" : result.error);
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
        <Button type="submit">Save personal information</Button>
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
  const locked = record.status === "verified";
  return (
    <KycFrame>
      <PageTitle
        title={`${kind} verification`}
        lede={`${kind} is part of KYC. The number is masked after you submit it.`}
      />
      {!user.kyc.personalComplete ? <Banner>Complete personal information before this check.</Banner> : null}
      <form
        className="mt-4 space-y-4 rounded-[2rem] border border-line bg-paper p-6"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          await new Promise((resolve) => setTimeout(resolve, 600));
          const result = kind === "NIN" ? await submitNin(value) : await submitBvn(value);
          setBusy(false);
          setError(result.ok ? "" : result.error);
          if (result.ok) setValue("");
        }}
      >
        <Pill status={record.status}>{VERIFY_LABEL[record.status]}</Pill>
        {record.reason ? <p className="text-sm leading-6">{record.reason}</p> : null}
        {record.last4 ? <p className="text-sm text-muted">Submitted number {maskId(record.last4)} · {record.reference}</p> : null}
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {locked ? <Banner tone="ok">This check is verified and cannot be edited here.</Banner> : (
          <>
            <TextField label={`${kind} number`} value={value} onChange={setValue} placeholder="11 digits" />
            <p className="text-xs leading-5 text-muted">
              This MVP checks the number on your device. A {kind} starting with {kind === "NIN" ? "000" : "999"} fails. One ending in {kind === "NIN" ? "1111" : "2222"} requires an update. Any other 11-digit number is verified against your profile name.
            </p>
            <Button type="submit" disabled={busy || !user.kyc.personalComplete}>{busy ? "Verifying…" : `Submit ${kind}`}</Button>
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
  const { user, saveBank } = useClient();
  const existing = user.banks.find((item) => item.id === user.kyc.bankAccountId);
  const [bankName, setBankName] = useState(existing?.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(existing?.accountNumber ?? "");
  const [accountName, setAccountName] = useState(existing?.accountName ?? "");
  const [error, setError] = useState("");
  return (
    <KycFrame>
      <PageTitle title="Bank account" lede="The verified account is the one that can receive withdrawals. The account name should include your first and last name." />
      <form
        className="space-y-4 rounded-[2rem] border border-line bg-paper p-6"
        onSubmit={(event) => {
          event.preventDefault();
          const result = saveBank({ bankName, accountNumber, accountName, id: existing?.id });
          setError(result.ok ? "" : result.error);
        }}
      >
        {existing ? <Pill status={existing.status}>{VERIFY_LABEL[existing.status]}</Pill> : null}
        {existing?.reason ? <p className="text-sm">{existing.reason}</p> : null}
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <SelectField label="Bank name" value={bankName} onChange={setBankName} options={BANKS} />
        <TextField label="Account number" value={accountNumber} onChange={setAccountNumber} />
        <TextField label="Account name" value={accountName} onChange={setAccountName} />
        <Button type="submit">Verify bank account</Button>
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
              const result = saveDocument({ docType, name: file.name, dataUrl });
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
            const result = saveSelfie({ name: file.name, dataUrl });
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
  const ready = user.kyc.completion === 100 && user.kyc.nin.status === "verified" && user.kyc.bvn.status === "verified";
  return (
    <KycFrame>
      <PageTitle title="Final review" lede="KYC cannot be approved while a mandatory item is incomplete." />
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
        disabled={!ready || user.status === "active"}
        onClick={() => {
          const result = submitKyc();
          if (!result.ok) setError(result.error);
          else navigate("/kyc/status");
        }}
      >
        {user.status === "active" ? "KYC already approved" : "Submit KYC"}
      </Button>
    </KycFrame>
  );
}

export function KycStatus() {
  const { user } = useClient();
  return (
    <KycFrame>
      <PageTitle title="KYC status" lede={user.kyc.status === "not_started" ? "KYC has not begun because the onboarding fee has not been paid." : KYC_STATUS_LABEL[user.kyc.status]} />
      <div className="rounded-[2rem] border border-line bg-paper p-6">
        <Pill status={user.kyc.status}>{KYC_STATUS_LABEL[user.kyc.status]}</Pill>
        <p className="mt-4 font-serif text-3xl text-forest">KYC Completion: {user.kyc.completion}%</p>
        {user.kyc.status === "approved" ? <p className="mt-2 text-sm text-ok">KYC: Verified</p> : null}
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
        {user.status === "active" ? <Link to="/dashboard" className="mt-5 inline-flex rounded-full bg-forest px-5 py-2.5 text-sm text-gold2">Go to dashboard</Link> : null}
      </div>
    </KycFrame>
  );
}
