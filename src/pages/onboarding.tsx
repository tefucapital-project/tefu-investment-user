import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Banner, Button, PageTitle, Pill } from "../components/ui";
import { useClient } from "../context/AppState";
import { ONBOARDING_FEE_AMOUNT, ONBOARDING_FEE_NAME, ONBOARDING_FEE_PURPOSE } from "../lib/catalog";
import { dateTime, fullName, naira } from "../lib/format";
import { KYC_LOCK_MESSAGE, PAYMENT_LABEL } from "../lib/labels";
import type { PaymentStatus } from "../lib/types";

export function AccountOnboardingPage() {
  const { user } = useClient();
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        eyebrow="Account"
        title="Your Tefu account"
        lede="You can return here any time during onboarding if you need to check your details before paying the fee or finishing KYC."
      />
      <div className="rounded-[2rem] border border-line bg-paper p-6 text-sm">
        <dl className="space-y-3">
          <Row label="Name" value={fullName(user)} />
          <Row label="Email" value={user.email} />
          <Row label="Phone" value={user.phone || "Not set"} />
          <Row label="Account status" value={user.status.replaceAll("_", " ")} />
          <Row label="Client Onboarding Fee" value={user.feePaidAt ? "Paid" : "Not paid"} />
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/onboarding/fee" className="inline-flex rounded-full bg-forest px-5 py-2.5 text-sm text-gold2">
            {user.feePaidAt ? "View onboarding fee" : "Continue to fee"}
          </Link>
          {user.feePaidAt ? (
            <Link to="/kyc" className="inline-flex rounded-full border border-line px-5 py-2.5 text-sm text-forest">
              Go to KYC
            </Link>
          ) : null}
          <Link to="/security" className="inline-flex rounded-full border border-line px-5 py-2.5 text-sm text-forest">
            Security
          </Link>
        </div>
      </div>
    </div>
  );
}

export function FeeIntroPage() {
  const { user, state, syncOnboardingFee } = useClient();
  const [syncing, setSyncing] = useState(true);
  const [syncError, setSyncError] = useState("");
  const latest = state.fees.find((item) => item.userId === user.id && item.feeType === "client_onboarding_fee");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setSyncing(true);
      setSyncError("");
      const result = await syncOnboardingFee();
      if (cancelled) return;
      if (!result.ok) setSyncError(result.error);
      setSyncing(false);
    })();
    return () => {
      cancelled = true;
    };
    // Sync once when this account lands on the fee page — not on every state rewrite.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncOnboardingFee identity changes with state
  }, [user.id]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        eyebrow="Before KYC"
        title={ONBOARDING_FEE_NAME}
        lede="This payment is required before identity verification can begin."
      />
      {user.feePaidAt ? (
        <Banner tone="ok">Client Onboarding Fee is paid. You can continue to KYC.</Banner>
      ) : (
        <Banner>{KYC_LOCK_MESSAGE}</Banner>
      )}
      {syncError ? (
        <div className="mt-3">
          <Banner tone="danger">{syncError}</Banner>
        </div>
      ) : null}
      <div className="mt-5 rounded-[2rem] border border-line bg-paper p-6">
        <dl className="space-y-3 text-sm">
          <Row label="Fee name" value={ONBOARDING_FEE_NAME} />
          <Row label="Amount" value={naira(ONBOARDING_FEE_AMOUNT)} />
          <Row label="Purpose" value={ONBOARDING_FEE_PURPOSE} />
          <Row label="KYC" value={user.feePaidAt ? "Unlocked" : syncing ? "Checking…" : "Locked"} />
          <Row label="Processor" value="Paystack" />
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          {user.feePaidAt ? (
            <Link to="/kyc" className="inline-flex rounded-full bg-forest px-5 py-2.5 text-sm text-gold2">
              Continue to KYC
            </Link>
          ) : (
            <Link
              to="/onboarding/fee/pay"
              className={`inline-flex rounded-full bg-forest px-5 py-2.5 text-sm text-gold2 ${syncing ? "pointer-events-none opacity-60" : ""}`}
            >
              {syncing ? "Checking payment…" : `Pay ${naira(ONBOARDING_FEE_AMOUNT)} with Paystack`}
            </Link>
          )}
          <Link to="/onboarding/account" className="inline-flex rounded-full border border-line px-5 py-2.5 text-sm text-forest">
            Back to Account
          </Link>
        </div>
      </div>
      {latest ? (
        <p className="mt-4 text-sm text-muted">
          Latest attempt: {PAYMENT_LABEL[latest.status]} · {latest.reference}
          {latest.paidAt ? ` · ${dateTime(latest.paidAt)}` : ""}
        </p>
      ) : null}
    </div>
  );
}

export function FeePayPage() {
  const { user, payOnboardingFee, syncOnboardingFee } = useClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await syncOnboardingFee();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync once per visit
  }, [user.id]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageTitle eyebrow="Payment" title="Pay the Client Onboarding Fee" lede="Confirming whether this fee is already paid…" />
        <Banner>Checking payment status with Tefu…</Banner>
      </div>
    );
  }

  if (user.feePaidAt) return <FeeIntroPage />;

  const pay = async () => {
    setBusy(true);
    setError("");
    const result = await payOnboardingFee("Paystack", "pending", `pending-${Date.now()}`);
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.ok ? "Payment could not start." : result.error);
      return;
    }
    if (!result.data.checkoutUrl) {
      setError("Paystack checkout did not open. Confirm the API is in paystack mode and try again.");
      return;
    }
    window.location.assign(result.data.checkoutUrl);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle eyebrow="Payment" title="Pay the Client Onboarding Fee" lede="You will complete this payment securely on Paystack. The wallet is not used for this fee." />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <div className="mt-4 space-y-4 rounded-[2rem] border border-line bg-paper p-6">
        <Row label="Fee name" value={ONBOARDING_FEE_NAME} />
        <Row label="Amount" value={naira(ONBOARDING_FEE_AMOUNT)} />
        <Row label="Purpose" value={ONBOARDING_FEE_PURPOSE} />
        <Row label="Payment processor" value="Paystack (card, transfer, USSD)" />
        <Button className="w-full" disabled={busy} onClick={() => void pay()}>
          {busy ? "Opening Paystack…" : `Pay ${naira(ONBOARDING_FEE_AMOUNT)} with Paystack`}
        </Button>
      </div>
    </div>
  );
}

export function FeeResultPage({ outcome }: { outcome: PaymentStatus }) {
  const { user, state, verifyPayment } = useClient();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [verifiedOnce, setVerifiedOnce] = useState(false);
  const reference = params.get("reference") || params.get("trxref") || "";
  const fee = state.fees.find((item) => item.userId === user.id && item.feeType === "client_onboarding_fee" && (reference ? item.reference === reference : item.status === outcome));
  const checking = Boolean(reference) && !verifiedOnce && !error;

  useEffect(() => {
    if (!reference || verifiedOnce) return;
    let cancelled = false;
    void (async () => {
      const result = await verifyPayment(reference);
      if (cancelled) return;
      setVerifiedOnce(true);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const status = String(result.data?.status ?? "").toUpperCase();
      const target =
        status === "SUCCESSFUL" || status === "SUCCESS"
          ? "success"
          : status === "FAILED"
            ? "failed"
            : "pending";
      navigate(`/onboarding/fee/${target}?reference=${encodeURIComponent(reference)}`, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [reference, verifyPayment, navigate, verifiedOnce]);

  const resolved: PaymentStatus = user.feePaidAt ? "successful" : outcome;
  const copy = {
    successful: "Payment successful. KYC verification is unlocked.",
    failed: "Payment failed. KYC remains locked.",
    pending: "Payment is pending. KYC remains locked until Paystack confirms it.",
    processing: "Payment is processing. KYC remains locked.",
    reversed: "Payment was reversed. KYC remains locked.",
    refunded: "Payment was refunded. KYC remains locked.",
  }[resolved];

  if (checking) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageTitle eyebrow={ONBOARDING_FEE_NAME} title="Confirming payment" lede="Verifying your Paystack payment with Tefu…" />
        <Banner>Please wait while we confirm reference {reference}.</Banner>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle eyebrow={ONBOARDING_FEE_NAME} title={PAYMENT_LABEL[resolved]} lede={copy} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Banner tone={resolved === "successful" ? "ok" : "warn"}>{resolved === "successful" ? "You can begin KYC." : KYC_LOCK_MESSAGE}</Banner>
      {fee ? (
        <div className="mt-4 rounded-[2rem] border border-line bg-paper p-6 text-sm">
          <Row label="Fee name" value={fee.name} />
          <Row label="Amount" value={naira(fee.amount)} />
          <Row label="Method" value={fee.paymentMethod} />
          <Row label="Reference" value={fee.reference} />
          <Row label="Status" value={PAYMENT_LABEL[fee.status]} />
          <Row label="Date" value={dateTime(fee.paidAt ?? fee.createdAt)} />
          <div className="mt-4"><Pill status={fee.status}>{PAYMENT_LABEL[fee.status]}</Pill></div>
        </div>
      ) : null}
      <div className="mt-5 flex gap-3">
        {resolved === "successful" || user.feePaidAt ? (
          <Link to="/kyc" className="rounded-full bg-forest px-5 py-2.5 text-sm text-gold2">Begin KYC</Link>
        ) : (
          <Link to="/onboarding/fee/pay" className="rounded-full bg-forest px-5 py-2.5 text-sm text-gold2">Try payment again</Link>
        )}
        {fee ? <Link to={`/receipts/${fee.reference}`} className="rounded-full border border-line bg-paper px-5 py-2.5 text-sm">View receipt</Link> : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-line py-3 sm:grid-cols-[180px_1fr]">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
