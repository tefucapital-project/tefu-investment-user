import { Link } from "react-router-dom";
import { PageTitle, Pill, Stat } from "../components/ui";
import { useClient } from "../context/AppState";
import { dateTime, fullName, naira, shortDate } from "../lib/format";
import { KYC_STATUS_LABEL, TX_LABEL } from "../lib/labels";
import { portfolioOf, visibleNotifications } from "../lib/selectors";

export function DashboardPage() {
  const { user, state } = useClient();
  const book = portfolioOf(state, user.id);
  const activity = state.transactions.filter((item) => item.userId === user.id).slice(0, 5);
  const notes = visibleNotifications(user, state).slice(0, 3);
  const upcoming = book.holdings.filter((item) => item.status === "active").slice(0, 3);
  return (
    <div>
      <PageTitle
        eyebrow={fullName(user)}
        title="Your investment account"
        lede="Balances, holdings, and distributions. Profit and rental appear here only after they are actually paid."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Wallet balance" value={naira(user.wallet.balance)} hint={`Available ${naira(user.wallet.available)}`} />
        <Stat label="Invested" value={naira(book.invested)} hint={`${book.active} active`} />
        <Stat label="Profit received" value={naira(book.profit)} hint="From recorded distributions" />
        <Stat label="Withdrawals" value={naira(book.withdrawals)} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[2rem] border border-line bg-paper p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl text-forest">Investments</h2>
            <Link to="/investments" className="text-sm text-canopy">View all</Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Mini label="Mudarabah" value={naira(book.mudarabah)} />
            <Mini label="Ijarah" value={naira(book.ijarah)} />
            <Mini label="Active" value={String(book.active)} />
            <Mini label="Completed" value={String(book.completed)} />
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {upcoming.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 border-t border-line pt-2">
                <span>{item.name}</span>
                <span className="text-muted">Matures {shortDate(item.maturityDate)}</span>
              </li>
            ))}
            {upcoming.length === 0 ? <li className="text-muted">No active investments yet.</li> : null}
          </ul>
        </section>
        <section className="rounded-[2rem] border border-line bg-paper p-5">
          <h2 className="font-serif text-2xl text-forest">KYC</h2>
          {user.kyc.status === "approved" ? (
            <p className="mt-3 text-ok">KYC: Verified ✓</p>
          ) : (
            <p className="mt-3">KYC: {user.kyc.completion}% Complete</p>
          )}
          <p className="mt-1 text-sm text-muted">{KYC_STATUS_LABEL[user.kyc.status]}</p>
          <Link to="/kyc/status" className="mt-4 inline-block text-sm text-canopy">View KYC status</Link>
          <h3 className="mt-6 font-medium">Notifications</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {notes.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.title}</span>
                <span className="block text-muted">{item.message}</span>
              </li>
            ))}
            {notes.length === 0 ? <li className="text-muted">Nothing new.</li> : null}
          </ul>
        </section>
      </div>
      <section className="mt-4 rounded-[2rem] border border-line bg-paper p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl text-forest">Recent activity</h2>
          <Link to="/transactions" className="text-sm text-canopy">Transactions</Link>
        </div>
        <ul className="mt-3 divide-y divide-line text-sm">
          {activity.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span>{TX_LABEL[item.type]}</span>
              <span>{naira(item.amount)}</span>
              <span className="text-muted">{dateTime(item.createdAt)}</span>
              <Pill status={item.status} />
            </li>
          ))}
          {activity.length === 0 ? <li className="py-3 text-muted">Deposits, investments, fees, and distributions will appear here.</li> : null}
        </ul>
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-cream px-3 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-serif text-xl text-forest">{value}</p>
    </div>
  );
}
