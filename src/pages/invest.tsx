import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Banner, Button, Empty, Modal, PageTitle, Pill } from "../components/ui";
import { useClient } from "../context/AppState";
import { AGREEMENTS } from "../lib/catalog";
import { dateTime, naira, roundMoney, shortDate } from "../lib/format";
import { arrangementFee, durationLabel, feePurpose, lookupOpportunity, portfolioOf } from "../lib/selectors";
import type { LiveOpportunity } from "../lib/types";

function OppList({ kind }: { kind: "mudarabah" | "ijarah" }) {
  const { opportunities } = useClient();
  const rows = opportunities.filter((item) => item.kind === kind);
  return (
    <div>
      <PageTitle
        eyebrow={kind === "mudarabah" ? "Mudarabah" : "Ijarah"}
        title={kind === "mudarabah" ? "Open profit-sharing opportunities" : "Open lease participations"}
        lede={kind === "mudarabah"
          ? "Profit is shared only if the venture earns it. The ratio is not interest and it is not guaranteed."
          : "Rental is distributed from rent actually collected. It is not a guaranteed coupon."}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((item) => <OppCard key={item.id} item={item} />)}
      </div>
    </div>
  );
}

function OppCard({ item }: { item: LiveOpportunity }) {
  const funded = Math.min(100, Math.round((item.funded / item.target) * 100));
  return (
    <Link to={`/invest/${item.kind}/${item.id}`} className="rounded-[2rem] border border-line bg-paper p-5 hover:border-canopy">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-2xl text-forest">{item.name}</h2>
        <Pill status={item.status === "open" ? "active" : "pending"}>{item.status === "open" ? "Open" : "Fully funded"}</Pill>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">{item.summary}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-cream"><div className="h-full bg-forest" style={{ width: `${funded}%` }} /></div>
      <p className="mt-2 text-xs text-muted">{naira(item.funded)} funded of {naira(item.target)}</p>
      <p className="mt-3 text-sm">From {naira(item.min)} · {durationLabel(item)}</p>
    </Link>
  );
}

export function MudarabahListPage() {
  return <OppList kind="mudarabah" />;
}

export function IjarahListPage() {
  return <OppList kind="ijarah" />;
}

export function OpportunityPage() {
  const { id = "" } = useParams();
  const { state } = useClient();
  const navigate = useNavigate();
  const item = lookupOpportunity(state, id);
  const [amount, setAmount] = useState("");
  const [doc, setDoc] = useState<{ title: string; body: string } | null>(null);
  if (!item) return <Empty title="Opportunity not found" body="It may have been removed from this version." />;
  const value = Number(amount);
  const fee = arrangementFee(item.kind, Number.isFinite(value) ? value : 0);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <article>
        <PageTitle eyebrow={item.kind === "mudarabah" ? "Mudarabah" : "Ijarah"} title={item.name} lede={item.summary} />
        <div className="rounded-[2rem] border border-gold/40 bg-gold2/30 p-4 text-sm leading-6">
          {item.shariah} Returns follow this structure and actual performance. They are not guaranteed interest.
        </div>
        <p className="mt-4 text-sm leading-7">{item.description}</p>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <Fact label="Minimum" value={naira(item.min)} />
          <Fact label="Maximum" value={naira(item.max)} />
          <Fact label="Target" value={naira(item.target)} />
          <Fact label="Funded" value={naira(item.funded)} />
          <Fact label="Remaining" value={naira(item.remaining)} />
          <Fact label="Duration" value={durationLabel(item)} />
          <Fact label="Start" value="When your investment is confirmed" />
          <Fact label="Expected maturity" value={durationLabel(item) + " after the start date"} />
          {item.kind === "mudarabah" ? <Fact label="Profit-sharing" value={`Investor ${item.investorShare}% · Manager ${item.managerShare}% of profit`} /> : null}
          {item.kind === "ijarah" ? <Fact label="Asset type" value={item.assetType} /> : null}
          {item.kind === "ijarah" ? <Fact label="Asset value" value={naira(item.assetValue)} /> : null}
          {item.kind === "ijarah" ? <Fact label="Takaful" value={item.takaful} /> : null}
          <Fact label="Distribution schedule" value={item.schedule} />
          <Fact label="Status" value={item.status === "open" ? "Open" : "Fully funded"} />
        </dl>
        <h3 className="mt-6 font-serif text-2xl text-forest">Risk</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">{item.risk.map((risk) => <li key={risk}>{risk}</li>)}</ul>
        <h3 className="mt-6 font-serif text-2xl text-forest">Documents</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {item.documents.map((document) => (
            <button key={document.title} type="button" className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm" onClick={() => setDoc(document)}>{document.title}</button>
          ))}
        </div>
      </article>
      <aside className="h-fit rounded-[2rem] border border-line bg-paper p-5">
        <h2 className="font-serif text-2xl text-forest">Invest</h2>
        <label className="mt-4 block text-sm">
          <span className="mb-1.5 block font-medium">Amount</span>
          <input className="w-full rounded-2xl border border-line px-3 py-2.5" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={item.status !== "open"} />
        </label>
        <p className="mt-3 text-sm text-muted">Arrangement fee on this amount: {naira(fee)}. {feePurpose(item.kind)}</p>
        <Button className="mt-4 w-full" disabled={item.status !== "open" || !value} onClick={() => navigate(`/invest/${item.kind}/${item.id}/confirm?amount=${value}`)}>
          {item.status === "open" ? "Review investment" : "Fully funded"}
        </Button>
      </aside>
      {doc ? <Modal title={doc.title} onClose={() => setDoc(null)}>{doc.body}</Modal> : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-paper px-3 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export function ConfirmPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const { user, state, createInvestment } = useClient();
  const item = lookupOpportunity(state, id);
  const [accepted, setAccepted] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ holdingId: string; reference: string } | null>(null);
  const amount = Number(params.get("amount") ?? "0");
  if (!item) return <Empty title="Opportunity not found" body="Return to the opportunity list and choose again." />;
  const fee = arrangementFee(item.kind, amount);
  const total = roundMoney(amount + fee);
  const agreement = item.kind === "mudarabah" ? AGREEMENTS.mudarabah : AGREEMENTS.ijarah;
  if (done) {
    return (
      <div className="mx-auto max-w-xl">
        <PageTitle title="Investment confirmed" lede={`${item.name} is now in My Investments. No profit or rental has been declared.`} />
        <div className="rounded-[2rem] border border-line bg-paper p-6 text-sm">
          <p>Reference {done.reference}</p>
          <p className="mt-2">Amount invested {naira(amount)}</p>
          <p>Fee {naira(fee)}</p>
          <Link to={`/investments/${done.holdingId}`} className="mt-4 inline-block text-canopy">Open investment</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title={`Confirm ${item.name}`} lede="Read the fee and the agreement. The wallet is deducted only after you accept and enter your PIN." />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {total > user.wallet.available ? <Banner tone="danger">Your available balance is not enough for this investment and the applicable fee.</Banner> : null}
      <div className="space-y-2 rounded-[2rem] border border-line bg-paper p-6 text-sm">
        <p>Amount {naira(amount)}</p>
        <p>Arrangement fee {naira(fee)}</p>
        <p>{feePurpose(item.kind)}</p>
        <p>Total deducted {naira(total)}</p>
        <p>Available balance {naira(user.wallet.available)}</p>
        <p>Balance after confirmation {total > user.wallet.available ? "Not enough available balance" : naira(user.wallet.available - total)}</p>
        <p>Distribution: {item.schedule}</p>
      </div>
      <div className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-[2rem] border border-line bg-cream p-4 text-sm leading-6">{agreement.body}</div>
      <p className="mt-2 text-xs text-muted">{agreement.type} · version {agreement.version}</p>
      <label className="mt-4 flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
        <span>I accept {agreement.title}, version {agreement.version}.</span>
      </label>
      <label className="mt-4 block text-sm">
        <span className="mb-1.5 block font-medium">{user.pinHash ? "Transaction PIN" : "Create a 4-digit transaction PIN"}</span>
        <input className="w-full rounded-2xl border border-line bg-white px-3 py-2.5" type="password" autoComplete="off" inputMode="numeric" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} />
      </label>
      <Button
        className="mt-4"
        disabled={!accepted || pin.length !== 4 || total > user.wallet.available || amount <= 0}
        onClick={async () => {
          const result = await createInvestment({ opportunityId: item.id, amount, accepted, pin });
          if (!result.ok || !result.data) setError(result.ok ? "The investment could not be created." : result.error);
          else setDone(result.data);
        }}
      >
        Confirm investment
      </Button>
    </div>
  );
}

const tabs = ["all", "mudarabah", "ijarah", "active", "completed", "pending"] as const;

export function MyInvestmentsPage() {
  const { user, state } = useClient();
  const [tab, setTab] = useState<(typeof tabs)[number]>("all");
  const rows = portfolioOf(state, user.id).holdings.filter((item) => {
    if (tab === "all") return true;
    if (tab === "mudarabah" || tab === "ijarah") return item.kind === tab;
    return item.status === tab;
  });
  return (
    <div>
      <PageTitle title="My investments" lede="Mudarabah and Ijarah you have confirmed." />
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-full px-3 py-1.5 text-xs capitalize ${tab === item ? "bg-forest text-gold2" : "bg-paper"}`}>{item}</button>
        ))}
      </div>
      {rows.length === 0 ? <Empty title="No investments in this tab" body="When you confirm an opportunity, it appears here." /> : (
        <div className="overflow-x-auto rounded-[2rem] border border-line bg-paper">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-muted"><tr><th className="px-4 py-3">ID</th><th>Type</th><th>Amount</th><th>Date</th><th>Duration</th><th>Status</th><th>Maturity</th></tr></thead>
            <tbody>
              {rows.map((item) => {
                const opp = lookupOpportunity(state, item.opportunityId);
                const received = state.distributions.filter((entry) => entry.investmentId === item.id).reduce((sum, entry) => sum + entry.amount, 0);
                return (
                  <tr key={item.id} className="border-t border-line">
                    <td className="px-4 py-3"><Link to={`/investments/${item.id}`} className="text-canopy">{item.reference}</Link></td>
                    <td className="capitalize">{item.kind}</td>
                    <td>{naira(item.amount)}</td>
                    <td>{shortDate(item.investedAt)}</td>
                    <td>{opp ? durationLabel(opp) : "—"}</td>
                    <td><Pill status={item.status} /></td>
                    <td>{shortDate(item.maturityDate)} · received {naira(received)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function HoldingPage() {
  const { holdingId = "" } = useParams();
  const { user, state } = useClient();
  const holding = state.holdings.find((item) => item.id === holdingId && item.userId === user.id);
  if (!holding) return <Empty title="Investment not found" body="It is not on this account." />;
  const opp = lookupOpportunity(state, holding.opportunityId);
  const acceptance = state.acceptances.find((item) => item.id === holding.acceptanceId);
  const docs = state.documents.filter((item) => item.reference === holding.reference || item.reference === acceptance?.reference);
  const payouts = state.distributions.filter((item) => item.investmentId === holding.id);
  const txs = state.transactions.filter((item) => item.userId === user.id && (item.reference === holding.reference || item.description.includes(holding.name)));
  return (
    <div>
      <PageTitle eyebrow={holding.reference} title={holding.name} lede={opp?.shariah} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Fact label="Amount invested" value={naira(holding.amount)} />
        <Fact label="Invested" value={dateTime(holding.investedAt)} />
        <Fact label="Maturity" value={shortDate(holding.maturityDate)} />
      </div>
      <div className="mt-4"><Pill status={holding.status} /></div>
      <section className="mt-6">
        <h2 className="font-serif text-2xl">Distributions</h2>
        {payouts.length === 0 ? <p className="mt-2 text-sm text-muted">None yet. A distribution is recorded only when the investment actually pays profit or rental.</p> : (
          <ul className="mt-2 text-sm">{payouts.map((item) => <li key={item.id}>{naira(item.amount)} · {item.reference}</li>)}</ul>
        )}
      </section>
      <section className="mt-6">
        <h2 className="font-serif text-2xl">Transactions</h2>
        <ul className="mt-2 space-y-2 text-sm">{txs.map((item) => <li key={item.id}>{item.reference} · {naira(item.amount)} · {item.description}</li>)}</ul>
      </section>
      <section className="mt-6">
        <h2 className="font-serif text-2xl">Agreement and documents</h2>
        {acceptance ? <p className="mt-2 text-sm">Accepted {acceptance.agreementType} version {acceptance.version} on {dateTime(acceptance.acceptedAt)}. Reference {acceptance.reference}.</p> : null}
        <ul className="mt-2 text-sm">{docs.map((item) => <li key={item.id}>{item.name}</li>)}{opp?.documents.map((item) => <li key={item.title}>{item.title}</li>)}</ul>
        <p className="mt-3 text-sm text-muted">No investment updates have been published for this holding.</p>
      </section>
    </div>
  );
}
