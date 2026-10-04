import { Link, useParams } from "react-router-dom";
import { Empty, PageTitle, Pill } from "../components/ui";
import { useClient } from "../context/AppState";
import { dateTime, naira, shortDate } from "../lib/format";
import { findReceipt, portfolioOf, receiptsFor } from "../lib/selectors";

export function PortfolioPage() {
  const { user, state } = useClient();
  const book = portfolioOf(state, user.id);
  const total = book.invested || 1;
  const mud = book.invested ? Math.round((book.mudarabah / total) * 100) : 0;
  const ij = book.invested ? Math.round((book.ijarah / total) * 100) : 0;
  const txs = state.transactions.filter((item) => item.userId === user.id && (item.type === "mudarabah_investment" || item.type === "ijarah_investment" || item.type === "profit_distribution" || item.type === "rental_payment"));
  return (
    <div>
      <PageTitle title="Portfolio" lede="How your confirmed investments are split. The ring is a picture of allocation, not a performance forecast." />
      <div className="grid items-center gap-6 rounded-[2rem] border border-line bg-paper p-6 md:grid-cols-[180px_1fr]">
        <div className="relative mx-auto h-40 w-40 rounded-full" style={{ background: book.invested ? `conic-gradient(#0c3a31 0 ${mud}%, #a67c2d ${mud}% ${mud + ij}%, #e5dccb 0)` : "#e5dccb" }}>
          <div className="absolute inset-6 grid place-items-center rounded-full bg-paper text-center text-xs text-muted">{book.invested ? "Allocated" : "No holdings"}</div>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <Item label="Total invested" value={naira(book.invested)} />
          <Item label="Mudarabah allocation" value={naira(book.mudarabah)} />
          <Item label="Ijarah allocation" value={naira(book.ijarah)} />
          <Item label="Active" value={String(book.active)} />
          <Item label="Completed" value={String(book.completed)} />
          <Item label="Total distributions" value={naira(book.profit)} />
        </dl>
      </div>
      <h2 className="mt-8 font-serif text-2xl text-forest">Portfolio transactions</h2>
      <ul className="mt-3 divide-y divide-line text-sm">
        {txs.map((item) => <li key={item.id} className="flex justify-between py-2"><span>{item.description}</span><span>{naira(item.amount)}</span></li>)}
        {txs.length === 0 ? <li className="text-muted">Investments you confirm will be listed here.</li> : null}
      </ul>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted">{label}</dt><dd className="font-serif text-xl text-forest">{value}</dd></div>;
}

export function ProfitsPage() {
  const { user, state } = useClient();
  const rows = portfolioOf(state, user.id).distributions;
  return (
    <div>
      <PageTitle title="Profit history" lede="Mudarabah profit, Ijarah rental, and any other approved distribution. Each record has its own reference. Amounts follow the agreement and actual performance." />
      {rows.length === 0 ? <Empty title="No distributions yet" body="When an investment pays profit or rental, the credit, date, and reference will show here. Nothing is accrued in advance." /> : (
        <ul className="space-y-3">
          {rows.map((item) => (
            <li key={item.id} className="rounded-3xl border border-line bg-paper p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{item.investmentName}</span>
                <Pill status="successful">{item.type === "mudarabah_profit" ? "Mudarabah Profit" : item.type === "ijarah_rental" ? "Ijarah Rental" : "Other approved distribution"}</Pill>
              </div>
              <p className="mt-2">{naira(item.amount)} · {shortDate(item.date)} · {item.reference}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FeesPage() {
  const { user, state } = useClient();
  const fees = state.fees.filter((item) => item.userId === user.id);
  return (
    <div>
      <PageTitle title="Client fee history" lede="The first fee is always shown as the Client Onboarding Fee." />
      {fees.length === 0 ? <Empty title="No fees yet" body="The Client Onboarding Fee will appear here after you attempt payment." /> : (
        <div className="overflow-x-auto rounded-[2rem] border border-line bg-paper">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-xs uppercase text-muted"><tr><th className="px-4 py-3">Fee</th><th>Amount</th><th>Date</th><th>Status</th><th>Method</th><th>Reference</th></tr></thead>
            <tbody>
              {fees.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="px-4 py-3">{item.name}</td>
                  <td>{naira(item.amount)}</td>
                  <td>{dateTime(item.paidAt ?? item.createdAt)}</td>
                  <td><Pill status={item.status} /></td>
                  <td>{item.paymentMethod}</td>
                  <td><Link to={`/receipts/${item.reference}`} className="text-canopy">{item.reference}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AgreementsPage() {
  const { user, state } = useClient();
  const rows = state.acceptances.filter((item) => item.userId === user.id);
  return (
    <div>
      <PageTitle title="Agreements" lede="Each acceptance stores the version, the time, and the client." />
      <ul className="space-y-3">
        {rows.map((item) => (
          <li key={item.id} className="rounded-3xl border border-line bg-paper p-4 text-sm">
            <p className="font-medium">{item.agreementType} · version {item.version}</p>
            <p className="mt-1 text-muted">Accepted {dateTime(item.acceptedAt)} · {item.reference} · {item.status}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DocumentsPage() {
  const { user, state } = useClient();
  const docs = state.documents.filter((item) => item.userId === user.id);
  return (
    <div>
      <PageTitle title="Documents" lede="KYC files, agreements you accepted, and investment confirmations." action={<Link to="/agreements" className="text-sm text-canopy">Agreements</Link>} />
      {docs.length === 0 ? <Empty title="No documents yet" body="Uploads and accepted agreements will be listed here." /> : (
        <ul className="space-y-3">
          {docs.map((item) => (
            <li key={item.id} className="rounded-3xl border border-line bg-paper p-4 text-sm">
              <p className="font-medium">{item.name}</p>
              <p className="text-muted">{item.docType} · {item.status} · {item.reference || "—"}</p>
              {item.dataUrl ? <img src={item.dataUrl} alt="" className="mt-3 max-h-40 rounded-2xl" /> : null}
              {item.body ? <p className="mt-2 whitespace-pre-wrap text-muted">{item.body.slice(0, 280)}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReceiptsPage() {
  const { user, state } = useClient();
  const rows = receiptsFor(state, user.id);
  return (
    <div>
      <PageTitle title="Receipts" lede="Fees, deposits, withdrawals, and investment confirmations." />
      <ul className="space-y-2 text-sm">
        {rows.map((item) => (
          <li key={item.reference}>
            <Link to={`/receipts/${item.reference}`} className="flex items-center justify-between rounded-2xl border border-line bg-paper px-4 py-3">
              <span>{item.title}</span>
              <span>{naira(item.amount)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReceiptPage() {
  const { reference = "" } = useParams();
  const { user, state } = useClient();
  const receipt = findReceipt(state, user.id, decodeURIComponent(reference));
  if (!receipt) return <Empty title="Receipt not found" body="Check the reference in fee history or transactions." />;
  return (
    <div className="mx-auto max-w-xl rounded-[2rem] border border-line bg-paper p-6">
      <p className="text-xs uppercase tracking-[0.16em] text-gold">Tefu Investment</p>
      <h1 className="mt-2 font-serif text-3xl text-forest">{receipt.title}</h1>
      <p className="mt-1 text-sm text-muted">{dateTime(receipt.date)}</p>
      <div className="mt-4"><Pill status={receipt.status} /></div>
      <dl className="mt-4">
        {receipt.lines.map((line) => (
          <div key={line.label} className="grid grid-cols-[140px_1fr] gap-3 border-t border-line py-2 text-sm">
            <dt className="text-muted">{line.label}</dt>
            <dd>{line.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
