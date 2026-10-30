import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
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

const FEE_REF_KEY = "tefu.onboarding.fee.ref";

function readStoredFeeRef() {
  try {
    return sessionStorage.getItem(FEE_REF_KEY) || "";
  } catch {
    return "";
  }
}

function storeFeeRef(reference: string) {
  try {
    sessionStorage.setItem(FEE_REF_KEY, reference);
  } catch {
    /* ignore */
  }
}

function clearFeeRef() {
  try {
    sessionStorage.removeItem(FEE_REF_KEY);
  } catch {
    /* ignore */
  }
}

export function FeeIntroPage() {
  const { user, state, reconcileOnboardingFee } = useClient();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncNote, setSyncNote] = useState("");
  const latest = state.fees.find((item) => item.userId === user.id && item.feeType === "client_onboarding_fee");
  const returnReference = params.get("reference") || params.get("trxref") || readStoredFeeRef();

  const refreshFee = async (reference?: string) => {
    setSyncing(true);
    setSyncError("");
    const result = await reconcileOnboardingFee(reference);
    if (!result.ok) {
      setSyncError(result.error);
      setSyncing(false);
      return false;
    }
    if (result.data.paid) {
      clearFeeRef();
      setSyncNote("Payment confirmed. Opening KYC…");
      setSyncing(false);
      return true;
    }
    setSyncNote("");
    setSyncing(false);
    return false;
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const paid = await refreshFee(returnReference || undefined);
      if (cancelled) return;
      if (paid) {
        navigate("/kyc", { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconcile once when this account opens the fee page
  }, [user.id, returnReference]);

  useEffect(() => {
    if (user.feePaidAt) navigate("/kyc", { replace: true });
  }, [user.feePaidAt, navigate]);

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
      {syncNote && !user.feePaidAt ? (
        <div className="mt-3">
          <Banner tone="ok">{syncNote}</Banner>
        </div>
      ) : null}
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
            <>
              <Link
                to="/onboarding/fee/pay"
                className={`inline-flex rounded-full bg-forest px-5 py-2.5 text-sm text-gold2 ${syncing ? "pointer-events-none opacity-60" : ""}`}
              >
                {syncing ? "Checking payment…" : `Pay ${naira(ONBOARDING_FEE_AMOUNT)} with Paystack`}
              </Link>
              <Button
                type="button"
                variant="secondary"
                disabled={syncing || confirming}
                onClick={() => {
                  setConfirming(true);
                  void refreshFee(returnReference || undefined).then((paid) => {
                    setConfirming(false);
                    if (paid) {
                      navigate("/kyc", { replace: true });
                      return;
                    }
                    setSyncError(
                      "Tefu has not received a successful Paystack confirmation for this account yet. If you were charged, wait a minute and tap Confirm again, or contact support with your Paystack receipt.",
                    );
                  });
                }}
              >
                {confirming ? "Confirming with Paystack…" : "I already paid — confirm"}
              </Button>
            </>
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
  const { user, payOnboardingFee, reconcileOnboardingFee } = useClient();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await reconcileOnboardingFee(readStoredFeeRef() || undefined);
      if (cancelled) return;
      if (result.ok && result.data.paid) {
        clearFeeRef();
        navigate("/kyc", { replace: true });
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageTitle eyebrow="Payment" title="Pay the Client Onboarding Fee" lede="Confirming whether this fee is already paid…" />
        <Banner>Checking payment status with Tefu…</Banner>
      </div>
    );
  }

  if (user.feePaidAt) return <Navigate to="/kyc" replace />;

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
    storeFeeRef(result.data.reference);
    window.location.assign(result.data.checkoutUrl);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        eyebrow="Payment"
        title="Pay the Client Onboarding Fee"
        lede="You will complete this payment securely on Paystack. After a successful payment you are taken straight to KYC."
      />
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

function isPaidStatus(status: string | undefined, paidFlag?: boolean) {
  if (paidFlag) return true;
  const value = String(status ?? "").toUpperCase();
  return value === "SUCCESSFUL" || value === "SUCCESS";
}

export function FeeResultPage({ outcome }: { outcome: PaymentStatus }) {
  const { user, state, verifyPayment, reconcileOnboardingFee } = useClient();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"checking" | "done">("checking");
  const reference = params.get("reference") || params.get("trxref") || readStoredFeeRef();
  const fee = state.fees.find(
    (item) =>
      item.userId === user.id &&
      item.feeType === "client_onboarding_fee" &&
      (reference ? item.reference === reference : item.status === outcome),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const attempts = 6;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const result = reference
          ? await verifyPayment(reference)
          : await reconcileOnboardingFee();
        if (cancelled) return;

        if (!result.ok) {
          if (attempt === attempts - 1) {
            setError(result.error);
            setPhase("done");
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }

        const paid = isPaidStatus(
          "status" in (result.data ?? {}) ? (result.data as { status?: string }).status : undefined,
          result.data && "paid" in result.data ? Boolean(result.data.paid) : undefined,
        );

        if (paid) {
          clearFeeRef();
          // Small tick so local feePaidAt from verify/reconcile is committed before KYC RequireFee runs.
          await reconcileOnboardingFee(reference || undefined);
          if (cancelled) return;
          navigate("/kyc", { replace: true });
          return;
        }

        const status = String(
          ("status" in (result.data ?? {}) ? (result.data as { status?: string }).status : undefined) ?? outcome,
        ).toUpperCase();
        if (status === "FAILED") {
          setPhase("done");
          navigate(`/onboarding/fee/failed${reference ? `?reference=${encodeURIComponent(reference)}` : ""}`, {
            replace: true,
          });
          return;
        }

        // Paystack sometimes needs a moment after redirect — keep polling briefly.
        if (attempt < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }

        setPhase("done");
        navigate(`/onboarding/fee/pending${reference ? `?reference=${encodeURIComponent(reference)}` : ""}`, {
          replace: true,
        });
        return;
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on return from Paystack
  }, [reference]);

  useEffect(() => {
    if (user.feePaidAt) {
      clearFeeRef();
      navigate("/kyc", { replace: true });
    }
  }, [user.feePaidAt, navigate]);

  if (phase === "checking" || user.feePaidAt) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageTitle
          eyebrow={ONBOARDING_FEE_NAME}
          title="Confirming payment"
          lede="Payment received. Verifying with Paystack and opening KYC…"
        />
        <Banner>Please wait{reference ? ` · ${reference}` : ""}.</Banner>
      </div>
    );
  }

  const resolved: PaymentStatus = user.feePaidAt ? "successful" : outcome;
  const copy = {
    successful: "Payment successful. Opening KYC…",
    failed: "Payment failed. KYC remains locked.",
    pending: "Payment is still pending on Paystack. KYC stays locked until it confirms.",
    processing: "Payment is processing. KYC remains locked.",
    reversed: "Payment was reversed. KYC remains locked.",
    refunded: "Payment was refunded. KYC remains locked.",
  }[resolved];

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle eyebrow={ONBOARDING_FEE_NAME} title={PAYMENT_LABEL[resolved]} lede={copy} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Banner tone={resolved === "successful" ? "ok" : "warn"}>
        {resolved === "successful" ? "You can begin KYC." : KYC_LOCK_MESSAGE}
      </Banner>
      {fee ? (
        <div className="mt-4 rounded-[2rem] border border-line bg-paper p-6 text-sm">
          <Row label="Fee name" value={fee.name} />
          <Row label="Amount" value={naira(fee.amount)} />
          <Row label="Method" value={fee.paymentMethod} />
          <Row label="Reference" value={fee.reference} />
          <Row label="Status" value={PAYMENT_LABEL[fee.status]} />
          <Row label="Date" value={dateTime(fee.paidAt ?? fee.createdAt)} />
          <div className="mt-4">
            <Pill status={fee.status}>{PAYMENT_LABEL[fee.status]}</Pill>
          </div>
        </div>
      ) : null}
      <div className="mt-5 flex gap-3">
        {resolved === "successful" || user.feePaidAt ? (
          <Link to="/kyc" className="rounded-full bg-forest px-5 py-2.5 text-sm text-gold2">
            Begin KYC
          </Link>
        ) : (
          <>
            <Button
              type="button"
              onClick={() => {
                setPhase("checking");
                setError("");
                void reconcileOnboardingFee(reference || undefined).then((result) => {
                  if (result.ok && result.data.paid) {
                    clearFeeRef();
                    navigate("/kyc", { replace: true });
                    return;
                  }
                  setPhase("done");
                  setError(result.ok ? "Payment is not confirmed yet." : result.error);
                });
              }}
            >
              Check payment again
            </Button>
            <Link to="/onboarding/fee/pay" className="rounded-full border border-line bg-paper px-5 py-2.5 text-sm">
              Try payment again
            </Link>
          </>
        )}
        {fee ? (
          <Link to={`/receipts/${fee.reference}`} className="rounded-full border border-line bg-paper px-5 py-2.5 text-sm">
            View receipt
          </Link>
        ) : null}
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
