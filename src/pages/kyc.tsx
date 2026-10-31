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
    { to: "/kyc/review", label: "Final Review", detail: user.kyc.status === "approved" || user.kyc.status === "pending_review" ? "Complete" : "Not Started", done: user.kyc.status === "approved" || user.kyc.status === "pending_review" },
  ];
}

const KYC_NEXT: Record<string, string> = {
  "/kyc/personal": "/kyc/nin",
  "/kyc/nin": "/kyc/bvn",
  "/kyc/bvn": "/kyc/bank",
  "/kyc/bank": "/kyc/documents",
  "/kyc/documents": "/kyc/selfie",
  "/kyc/selfie": "/kyc/review",
  "/kyc/review": "/kyc/status",
};

function KycContinue({
  nextTo,
  canContinue,
  nextLabel = "Next",
}: {
  nextTo: string;
  canContinue: boolean;
  nextLabel?: string;
}) {
  if (!canContinue) return null;
  return (
    <Link to={nextTo} className="inline-flex rounded-full border border-line px-5 py-2.5 text-sm text-forest">
      {nextLabel}
    </Link>
  );
}

async function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

/** Compress phone camera photos so they fit the API body limit (null dataUrl used to fail live upload). */
async function prepareUpload(file: File): Promise<{ dataUrl: string; name: string }> {
  const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if (!isImage) {
    if (file.size > 1_800_000) {
      throw new Error("PDF files must be 1.8MB or smaller.");
    }
    return { dataUrl: await readAsDataUrl(file), name: file.name };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    let image: HTMLImageElement;
    try {
      image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("decode"));
        img.src = objectUrl;
      });
    } catch {
      // HEIC/unsupported formats: send original if it still fits.
      if (file.size > 1_800_000) {
        throw new Error("This phone photo format is too large. Take the photo again as JPEG, or pick a smaller image.");
      }
      return { dataUrl: await readAsDataUrl(file), name: file.name };
    }
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare the image for upload.");
    ctx.drawImage(image, 0, 0, width, height);

    let quality = 0.82;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length > 1_800_000 && quality > 0.4) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    if (dataUrl.length > 2_400_000) {
      throw new Error("This photo is still too large after compression. Try a clearer, smaller shot.");
    }
    const base = file.name.replace(/\.[^.]+$/, "") || "document";
    return { dataUrl, name: `${base}.jpg` };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
  const checklist = steps(user);
  const nextStep = checklist.find((step) => !step.done) ?? checklist[checklist.length - 1];
  return (
    <KycFrame>
      <PageTitle
        eyebrow="KYC"
        title="One verification, with NIN and BVN inside it"
        lede="NIN and BVN are not separate onboarding stages. They are required parts of this KYC file. After you submit, an admin must approve before you can invest."
      />
      <p className="mb-4 text-sm">KYC Completion: {user.kyc.completion}%</p>
      <div className="grid gap-3">
        {checklist.map((step) => (
          <Link key={step.to} to={step.to} className="flex items-center justify-between rounded-3xl border border-line bg-paper px-4 py-3">
            <span>{step.label}</span>
            <Pill status={step.done ? "verified" : "pending"}>{step.detail}</Pill>
          </Link>
        ))}
      </div>
      {nextStep ? (
        <Link
          to={nextStep.to}
          className="mt-5 inline-flex rounded-full bg-forest px-5 py-2.5 text-sm text-gold2"
        >
          {checklist.every((step) => step.done) ? "Go to final review" : `Continue: ${nextStep.label}`}
        </Link>
      ) : null}
    </KycFrame>
  );
}

export function KycPersonal() {
  const { user, savePersonal } = useClient();
  const navigate = useNavigate();
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
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setError("");
            navigate(KYC_NEXT["/kyc/personal"]);
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
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save and continue"}</Button>
          <KycContinue nextTo={KYC_NEXT["/kyc/personal"]} canContinue={user.kyc.personalComplete && !busy} />
        </div>
      </form>
    </KycFrame>
  );
}

function IdentityCheck({ kind }: { kind: "NIN" | "BVN" }) {
  const { user, submitNin, submitBvn } = useClient();
  const navigate = useNavigate();
  const record = kind === "NIN" ? user.kyc.nin : user.kyc.bvn;
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (underAdminReview(user)) return <Navigate to="/kyc/status" replace />;
  const locked = record.status === "verified";
  const digits = value.replace(/\D/g, "");
  const canSubmit = user.kyc.personalComplete && /^\d{11}$/.test(digits);
  const path = kind === "NIN" ? "/kyc/nin" : "/kyc/bvn";
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
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setValue("");
          navigate(KYC_NEXT[path]);
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
          </>
        )}
        <div className="flex flex-wrap gap-3">
          {!locked ? (
            <Button type="submit" disabled={busy || !canSubmit}>
              {busy ? "Verifying…" : `Save and continue`}
            </Button>
          ) : null}
          <KycContinue nextTo={KYC_NEXT[path]} canContinue={locked} />
        </div>
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
  const navigate = useNavigate();
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
  const bankDone = existing?.status === "verified";

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
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setError("");
            navigate(KYC_NEXT["/kyc/bank"]);
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
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy || lookingUp || !canVerify}>
            {busy ? "Verifying…" : "Save and continue"}
          </Button>
          <KycContinue nextTo={KYC_NEXT["/kyc/bank"]} canContinue={bankDone && !busy} />
        </div>
      </form>
    </KycFrame>
  );
}

export function KycDocs() {
  const { user, saveDocument, state } = useClient();
  const navigate = useNavigate();
  const [docType, setDocType] = useState(user.kyc.document.docType || "National ID");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const stored = state.documents.find((item) => item.id === user.kyc.document.id);
  const done = user.kyc.document.status !== "not_started";
  if (underAdminReview(user)) return <Navigate to="/kyc/status" replace />;

  const upload = async (file: File) => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const prepared = await prepareUpload(file);
      const result = await saveDocument({ docType, name: prepared.name, dataUrl: prepared.dataUrl });
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      setPreview(prepared.dataUrl.startsWith("data:image") ? prepared.dataUrl : null);
      setNote("Document received and saved.");
      navigate(KYC_NEXT["/kyc/documents"]);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare that file for upload.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <KycFrame>
      <PageTitle title="Identification document" lede="Upload a government-issued ID, passport, driver's licence, national ID, or another approved identification." />
      <form
        className="space-y-4 rounded-[2rem] border border-line bg-paper p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (done) navigate(KYC_NEXT["/kyc/documents"]);
          else setError("Choose a document file to upload first.");
        }}
      >
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {note || done ? <Banner tone="ok">{note || "Document already saved on this account."}</Banner> : null}
        <SelectField label="Document type" value={docType} onChange={setDocType} options={ID_TYPES} />
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">File</span>
          <input
            type="file"
            accept="image/*,.pdf"
            disabled={busy}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              await upload(file);
              event.target.value = "";
            }}
          />
          <span className="mt-1 block text-xs text-muted">Phone photos are compressed automatically before upload.</span>
        </label>
        {preview || stored?.dataUrl ? (
          <img src={preview || stored?.dataUrl || ""} alt="Identification preview" className="max-h-48 rounded-2xl border border-line" />
        ) : null}
        {user.kyc.document.name ? <p className="text-sm text-muted">Current file: {user.kyc.document.name}</p> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy || !done}>
            {busy ? "Uploading…" : "Save and continue"}
          </Button>
          <KycContinue nextTo={KYC_NEXT["/kyc/documents"]} canContinue={done && !busy} />
        </div>
      </form>
    </KycFrame>
  );
}

export function KycSelfie() {
  const { user, saveSelfie, state } = useClient();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const stored = state.documents.find((item) => item.id === user.kyc.selfie.id);
  const done = user.kyc.selfie.status !== "not_started";
  if (underAdminReview(user)) return <Navigate to="/kyc/status" replace />;

  const upload = async (file: File) => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const prepared = await prepareUpload(file);
      const result = await saveSelfie({ name: prepared.name, dataUrl: prepared.dataUrl });
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      setPreview(prepared.dataUrl);
      setNote("Identity photo received and saved.");
      navigate(KYC_NEXT["/kyc/selfie"]);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare that photo for upload.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <KycFrame>
      <PageTitle title="Identity photo" lede="A clear photo of your face is included in the KYC file." />
      <form
        className="space-y-4 rounded-[2rem] border border-line bg-paper p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (done) navigate(KYC_NEXT["/kyc/selfie"]);
          else setError("Upload an identity photo first.");
        }}
      >
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {note || done ? <Banner tone="ok">{note || "Identity photo already saved on this account."}</Banner> : null}
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Photo</span>
          <input
            type="file"
            accept="image/*"
            capture="user"
            disabled={busy}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              await upload(file);
              event.target.value = "";
            }}
          />
          <span className="mt-1 block text-xs text-muted">Phone camera photos are compressed automatically before upload.</span>
        </label>
        {preview || stored?.dataUrl ? (
          <img src={preview || stored?.dataUrl || ""} alt="Identity photo preview" className="max-h-56 rounded-2xl" />
        ) : null}
        {user.kyc.selfie.name ? <p className="text-sm text-muted">Current photo: {user.kyc.selfie.name}</p> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy || !done}>
            {busy ? "Uploading…" : "Save and continue"}
          </Button>
          <KycContinue nextTo={KYC_NEXT["/kyc/selfie"]} canContinue={done && !busy} />
        </div>
      </form>
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
      <p className="mt-3 text-xs text-muted">
        Earlier steps stay saved when you leave. Finish every step above, then submit here for admin review.
      </p>
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
