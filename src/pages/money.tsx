import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Banner, Button, Empty, PageTitle, Pill, Stat } from "../components/ui";
import { useClient } from "../context/AppState";
import { MAX_DEPOSIT, MIN_DEPOSIT, MIN_WITHDRAWAL, WITHDRAWAL_FEE, WITHDRAWAL_FEE_PURPOSE } from "../lib/catalog";
import { dateTime, maskAccount, naira, roundMoney } from "../lib/format";
import { PAYMENT_LABEL, TX_LABEL } from "../lib/labels";
import type { TxType } from "../lib/types";

const depositMethods = ["Debit card", "Bank transfer", "USSD"];

export function WalletPage() {
  const { user, state } = useClient();
  const recent = state.transactions.filter((item) => item.userId === user.id).slice(0, 6);
  return (
    <div>
      <PageTitle eyebrow="Wallet" title="Available to use" lede="Invested funds are not part of this balance. A deposit is added only after payment succeeds." action={<Link to="/deposit" className="rounded-full bg-forest px-4 py-2 text-sm text-gold2">Deposit</Link>} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total wallet balance" value={naira(user.wallet.balance)} />
        <Stat label="Available" value={naira(user.wallet.available)} />
        <Stat label="Locked" value={naira(user.wallet.locked)} hint="Held only while a withdrawal is processing" />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link to="/withdraw" className="rounded-full border border-line bg-paper px-4 py-2 text-sm">Withdraw</Link>
        <Link to="/invest/mudarabah" className="rounded-full border border-line bg-paper px-4 py-2 text-sm">Invest</Link>
        <Link to="/transactions" className="rounded-full border border-line bg-paper px-4 py-2 text-sm">Transactions</Link>
      </div>
      <ul className="mt-6 divide-y divide-line rounded-[2rem] border border-line bg-paper px-4">
        {recent.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <span>{TX_LABEL[item.type]}</span>
            <span>{naira(item.amount)}</span>
            <Pill status={item.status} />
          </li>
        ))}
        {recent.length === 0 ? <li className="py-6 text-sm text-muted">No wallet activity yet.</li> : null}
      </ul>
    </div>
  );
}

export function DepositPage() {
  const { createDeposit } = useClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(depositMethods[0]);
  const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ reference: string; outcome: "successful" | "failed" } | null>(null);
  const value = Number(amount);
  const valid = value >= MIN_DEPOSIT && value <= MAX_DEPOSIT;

  const confirm = (outcome: "successful" | "failed") => {
    const response = createDeposit(value, method, outcome);
    if (!response.ok || !response.data) {
      setError(response.ok ? "The deposit could not be recorded." : response.error);
      return;
    }
    setResult({ reference: response.data.reference, outcome });
    setStep("done");
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="Deposit" lede="Deposit, enter the amount, choose a method, review the fee, then confirm. The wallet is credited only after a successful payment." />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {step === "form" ? (
        <div className="space-y-4 rounded-[2rem] border border-line bg-paper p-6">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Amount</span>
            <input className="w-full rounded-2xl border border-line px-3 py-2.5" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <span className="mt-1 block text-xs text-muted">Between {naira(MIN_DEPOSIT)} and {naira(MAX_DEPOSIT)}. Platform fee: {naira(0)}.</span>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Payment method</span>
            <select className="w-full rounded-2xl border border-line px-3 py-2.5" value={method} onChange={(event) => setMethod(event.target.value)}>
              {depositMethods.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <Button disabled={!valid} onClick={() => setStep("review")}>Review</Button>
        </div>
      ) : null}
      {step === "review" ? (
        <div className="space-y-3 rounded-[2rem] border border-line bg-paper p-6 text-sm">
          <p>Amount: {naira(value)}</p>
          <p>Method: {method}</p>
          <p>Platform fee: {naira(0)}</p>
          <p>You will receive: {naira(value)} in available balance if the payment succeeds.</p>
          <Button onClick={() => confirm("successful")}>Confirm payment</Button>
          <button type="button" className="block text-danger" onClick={() => confirm("failed")}>Simulate a failed payment</button>
        </div>
      ) : null}
      {step === "done" && result ? (
        <div className="rounded-[2rem] border border-line bg-paper p-6">
          <Pill status={result.outcome}>{PAYMENT_LABEL[result.outcome]}</Pill>
          <p className="mt-3 text-sm">{result.outcome === "successful" ? "The wallet has been credited." : "The wallet was not credited."}</p>
          <p className="mt-2 text-sm text-muted">Reference {result.reference}</p>
          <Link to={`/receipts/${result.reference}`} className="mt-4 inline-block text-sm text-canopy">Open receipt</Link>
        </div>
      ) : null}
    </div>
  );
}

export function WithdrawPage() {
  const { user, requestWithdrawal } = useClient();
  const verified = user.banks.filter((item) => item.status === "verified");
  const [bankId, setBankId] = useState(verified[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [error, setError] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const value = Number(amount);
  const total = roundMoney(value + WITHDRAWAL_FEE);
  const bank = verified.find((item) => item.id === bankId);

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="Withdraw" lede="Withdrawals go only to a verified bank account, and only from available balance. Invested funds stay in the investment." />
      {verified.length === 0 ? <Empty title="No verified account" body="Verify a bank account in KYC before you withdraw." /> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {step === "form" && verified.length > 0 ? (
        <div className="space-y-4 rounded-[2rem] border border-line bg-paper p-6">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Verified bank account</span>
            <select className="w-full rounded-2xl border border-line px-3 py-2.5" value={bankId} onChange={(event) => setBankId(event.target.value)}>
              {verified.map((item) => <option key={item.id} value={item.id}>{item.bankName} · {maskAccount(item.accountNumber)}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Amount</span>
            <input className="w-full rounded-2xl border border-line px-3 py-2.5" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          {value >= MIN_WITHDRAWAL && total > user.wallet.available ? <Banner tone="danger">That amount plus the withdrawal fee is above your available balance. Invested funds cannot be withdrawn.</Banner> : null}
          <Button disabled={!bank || value < MIN_WITHDRAWAL || total > user.wallet.available} onClick={() => setStep("review")}>Review</Button>
        </div>
      ) : null}
      {step === "review" && bank ? (
        <form
          className="space-y-3 rounded-[2rem] border border-line bg-paper p-6 text-sm"
          onSubmit={async (event) => {
            event.preventDefault();
            const response = await requestWithdrawal(bank.id, value, pin);
            if (!response.ok || !response.data) {
              setError(response.ok ? "The withdrawal could not be recorded." : response.error);
              return;
            }
            setReferenceId(response.data.reference);
            setStep("done");
          }}
        >
          <p>Account: {bank.bankName} · {bank.accountName}</p>
          <p>Amount: {naira(value)}</p>
          <p>Withdrawal fee: {naira(WITHDRAWAL_FEE)}</p>
          <p>{WITHDRAWAL_FEE_PURPOSE}</p>
          <p>Total deducted from available balance: {naira(total)}</p>
          <p>Available now: {naira(user.wallet.available)}</p>
          <label className="block">
            <span className="mb-1.5 block font-medium">{user.pinHash ? "Transaction PIN" : "Create a 4-digit transaction PIN"}</span>
            <input className="w-full rounded-2xl border border-line px-3 py-2.5" type="password" autoComplete="off" inputMode="numeric" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} />
          </label>
          <Button type="submit" disabled={pin.length !== 4}>Confirm withdrawal</Button>
        </form>
      ) : null}
      {step === "done" ? (
        <div className="rounded-[2rem] border border-line bg-paper p-6">
          <Pill status="successful">Successful</Pill>
          <p className="mt-3 text-sm">Reference {referenceId}</p>
          <Link to={`/receipts/${referenceId}`} className="mt-3 inline-block text-sm text-canopy">View receipt</Link>
        </div>
      ) : null}
    </div>
  );
}

const filters: { id: string; label: string; types: TxType[] }[] = [
  { id: "all", label: "All", types: [] },
  { id: "deposits", label: "Deposits", types: ["deposit"] },
  { id: "withdrawals", label: "Withdrawals", types: ["withdrawal"] },
  { id: "investments", label: "Investments", types: ["mudarabah_investment", "ijarah_investment"] },
  { id: "profit", label: "Profit", types: ["profit_distribution"] },
  { id: "rental", label: "Rental", types: ["rental_payment"] },
  { id: "fees", label: "Fees", types: ["client_onboarding_fee", "fee"] },
  { id: "refunds", label: "Refunds", types: ["refund"] },
  { id: "reversals", label: "Reversals", types: ["reversal"] },
];

export function TransactionsPage() {
  const { user, state } = useClient();
  const [filter, setFilter] = useState("all");
  const rows = useMemo(() => {
    const mine = state.transactions.filter((item) => item.userId === user.id);
    const chosen = filters.find((item) => item.id === filter);
    if (!chosen || chosen.types.length === 0) return mine;
    return mine.filter((item) => chosen.types.includes(item.type));
  }, [filter, state.transactions, user.id]);
  return (
    <div>
      <PageTitle title="Transactions" lede="Every item has its own reference." />
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`rounded-full px-3 py-1.5 text-xs ${filter === item.id ? "bg-forest text-gold2" : "bg-paper text-muted"}`}>{item.label}</button>
        ))}
      </div>
      {rows.length === 0 ? <Empty title="Nothing in this filter" body="New activity will show here with its reference and status." /> : (
        <div className="overflow-x-auto rounded-[2rem] border border-line bg-paper">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-3">Reference</th><th>Type</th><th>Amount</th><th>Date</th><th>Status</th><th>Description</th></tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="px-4 py-3">{item.reference}</td>
                  <td>{TX_LABEL[item.type]}</td>
                  <td>{naira(item.amount)}</td>
                  <td>{dateTime(item.createdAt)}</td>
                  <td><Pill status={item.status} /></td>
                  <td className="max-w-xs pr-4">{item.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="text-center">
        <h1 className="font-serif text-4xl text-forest">That page is not in the client app</h1>
        <button type="button" className="mt-4 text-sm text-canopy" onClick={() => navigate("/")}>Back to Tefu</button>
      </div>
    </div>
  );
}
