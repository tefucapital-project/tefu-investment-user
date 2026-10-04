import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Banner, Button, PageTitle, Pill } from "../components/ui";
import { useClient } from "../context/AppState";
import { ONBOARDING_FEE_AMOUNT, ONBOARDING_FEE_NAME, ONBOARDING_FEE_PURPOSE } from "../lib/catalog";
import { dateTime, naira, reference } from "../lib/format";
import { KYC_LOCK_MESSAGE, PAYMENT_LABEL } from "../lib/labels";
import type { PaymentStatus } from "../lib/types";

const methods = ["Debit card", "Bank transfer", "USSD"];

export function FeeIntroPage() {
  const { user, state } = useClient();
  const latest = state.fees.find((item) => item.userId === user.id && item.feeType === "client_onboarding_fee");
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        eyebrow="Before KYC"
        title={ONBOARDING_FEE_NAME}
        lede="This payment is required before identity verification can begin."
      />
      <Banner>{KYC_LOCK_MESSAGE}</Banner>
      <div className="mt-5 rounded-[2rem] border border-line bg-paper p-6">
        <dl className="space-y-3 text-sm">
          <Row label="Fee name" value={ONBOARDING_FEE_NAME} />
          <Row label="Amount" value={naira(ONBOARDING_FEE_AMOUNT)} />
          <Row label="Purpose" value={ONBOARDING_FEE_PURPOSE} />
          <Row label="KYC" value={user.feePaidAt ? "Unlocked" : "Locked"} />
        </dl>
        {user.feePaidAt ? (
          <Link to="/kyc" className="mt-6 inline-flex rounded-full bg-forest px-5 py-2.5 text-sm text-gold2">Continue to KYC</Link>
        ) : (
          <Link to="/onboarding/fee/pay" className="mt-6 inline-flex rounded-full bg-forest px-5 py-2.5 text-sm text-gold2">Pay {naira(ONBOARDING_FEE_AMOUNT)}</Link>
        )}
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
  const { user, payOnboardingFee } = useClient();
  const navigate = useNavigate();
  const [method, setMethod] = useState(methods[0]);
  const [error, setError] = useState("");
  const [paymentReference] = useState(() => reference("COF"));
  if (user.feePaidAt) return <FeeIntroPage />;

  const pay = (outcome: "successful" | "failed" | "pending") => {
    const result = payOnboardingFee(method, outcome, paymentReference);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const path = outcome === "successful" ? "/onboarding/fee/success" : outcome === "failed" ? "/onboarding/fee/failed" : "/onboarding/fee/pending";
    navigate(path);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle eyebrow="Payment" title="Pay the Client Onboarding Fee" lede="Review the fee, then confirm. The wallet is not used for this payment." />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <div className="mt-4 space-y-4 rounded-[2rem] border border-line bg-paper p-6">
        <Row label="Fee name" value={ONBOARDING_FEE_NAME} />
        <Row label="Amount" value={naira(ONBOARDING_FEE_AMOUNT)} />
        <Row label="Purpose" value={ONBOARDING_FEE_PURPOSE} />
        <Row label="Payment reference" value={paymentReference} />
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Payment method</span>
          <select className="w-full rounded-2xl border border-line bg-white px-3 py-2.5" value={method} onChange={(event) => setMethod(event.target.value)}>
            {methods.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <Button className="w-full" onClick={() => pay("successful")}>Pay {naira(ONBOARDING_FEE_AMOUNT)}</Button>
        <div className="flex flex-wrap gap-3 text-sm">
          <button type="button" className="text-danger" onClick={() => pay("failed")}>Simulate a failed payment</button>
          <button type="button" className="text-warn" onClick={() => pay("pending")}>Leave payment pending</button>
        </div>
      </div>
    </div>
  );
}

export function FeeResultPage({ outcome }: { outcome: PaymentStatus }) {
  const { user, state } = useClient();
  const fee = state.fees.find((item) => item.userId === user.id && item.feeType === "client_onboarding_fee" && item.status === outcome);
  const copy = {
    successful: "Payment successful. KYC verification is unlocked.",
    failed: "Payment failed. KYC remains locked.",
    pending: "Payment is pending. KYC remains locked until it succeeds.",
    processing: "Payment is processing. KYC remains locked.",
    reversed: "Payment was reversed. KYC remains locked.",
    refunded: "Payment was refunded. KYC remains locked.",
  }[outcome];
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle eyebrow={ONBOARDING_FEE_NAME} title={PAYMENT_LABEL[outcome]} lede={copy} />
      <Banner tone={outcome === "successful" ? "ok" : "warn"}>{outcome === "successful" ? "You can begin KYC." : KYC_LOCK_MESSAGE}</Banner>
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
        {outcome === "successful" ? (
          <Link to="/kyc" className="rounded-full bg-forest px-5 py-2.5 text-sm text-gold2">Begin KYC</Link>
        ) : (
          <Link to="/onboarding/fee/pay" className="rounded-full bg-forest px-5 py-2.5 text-sm text-gold2">Try payment again</Link>
        )}
        <Link to={`/receipts/${fee?.reference ?? ""}`} className="rounded-full border border-line bg-paper px-5 py-2.5 text-sm">View receipt</Link>
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
