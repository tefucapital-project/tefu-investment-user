import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "../components/ui";
import { useApp } from "../context/AppState";
import { ONBOARDING_FEE_AMOUNT, ONBOARDING_FEE_NAME } from "../lib/catalog";
import { naira } from "../lib/format";
import { homePath } from "../lib/selectors";

const journey = [
  ["Create an account", "Name, email, phone, and acceptance of the terms and privacy policy."],
  ["Verify email and phone", "A code is issued, it expires, and repeated wrong attempts are limited."],
  [ONBOARDING_FEE_NAME, "KYC stays locked until this payment is successful."],
  ["Complete KYC", "Personal details, NIN, BVN, a verified bank account, documents, and a photo."],
  ["Fund the wallet", "The wallet is credited only after a deposit is confirmed."],
  ["Invest and track", "Mudarabah or Ijarah, after you accept the agreement and confirm with your PIN."],
];

export function LandingPage() {
  const { user } = useApp();
  const continueTo = user ? homePath(user) : "/register";
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <a href="#journey" className="hidden rounded-full px-3 py-2 text-muted sm:inline">Journey</a>
          <a href="#structures" className="hidden rounded-full px-3 py-2 text-muted sm:inline">Structures</a>
          <Link to="/login" className="rounded-full px-3 py-2">Log in</Link>
          <Link to={continueTo} className="rounded-full bg-forest px-4 py-2 text-gold2">{user ? "Continue" : "Open account"}</Link>
        </nav>
      </header>
      <section className="paper-grid mx-auto grid max-w-6xl items-end gap-10 px-5 pb-16 pt-8 lg:grid-cols-[1.3fr_0.7fr]">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold">Tefu Investment</p>
          <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-[1.02] text-forest md:text-7xl">Invest in the venture. Not in interest.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted">
            A client platform for Mudarabah profit-sharing and Ijarah leasing. You see every fee before you confirm. Profit and rental follow the contract and what the investment actually earns.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={continueTo} className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-sm text-gold2">
              {user ? "Continue your account" : "Create your account"} <ArrowRight size={16} />
            </Link>
            <a href="#structures" className="rounded-full border border-line bg-paper px-5 py-3 text-sm">See the two structures</a>
          </div>
        </div>
        <aside className="rounded-[2rem] border border-line bg-paper p-6">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">{ONBOARDING_FEE_NAME}</p>
          <p className="mt-2 font-serif text-4xl text-forest">{naira(ONBOARDING_FEE_AMOUNT)}</p>
          <p className="mt-3 text-sm leading-6 text-muted">
            Charged once, before KYC. A pending, failed, or reversed payment does not unlock verification.
          </p>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-t border-line pt-3"><dt>Arrangement fee</dt><dd>0.50% on Mudarabah</dd></div>
            <div className="flex justify-between gap-4 border-t border-line pt-3"><dt>Ijarah fee</dt><dd>None</dd></div>
            <div className="flex justify-between gap-4 border-t border-line pt-3"><dt>Withdrawal fee</dt><dd>{naira(100)}</dd></div>
          </dl>
        </aside>
      </section>
      <section id="structures" className="bg-forest text-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-16 md:grid-cols-2">
          <article className="rounded-[2rem] bg-white/6 p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-gold2">Mudarabah</p>
            <h2 className="mt-3 font-serif text-3xl">You provide capital. Profit is shared.</h2>
            <p className="mt-3 text-sm leading-6 text-white/75">
              The ratio on each opportunity applies only if the venture makes a profit. Loss of capital follows the mudarabah rules disclosed on the opportunity. Nothing is booked as interest.
            </p>
          </article>
          <article className="rounded-[2rem] bg-white/6 p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-gold2">Ijarah</p>
            <h2 className="mt-3 font-serif text-3xl">You participate in a leased asset.</h2>
            <p className="mt-3 text-sm leading-6 text-white/75">
              Rental is distributed from rent that is actually collected. A schedule describes when that happens. It is not a guaranteed coupon.
            </p>
          </article>
        </div>
      </section>
      <section id="journey" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-serif text-4xl text-forest">The client journey</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-2">
          {journey.map(([title, body], index) => (
            <li key={title} className="rounded-3xl border border-line bg-paper p-5">
              <p className="text-xs text-gold">0{index + 1}</p>
              <h3 className="mt-2 font-serif text-2xl text-forest">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>
      <footer className="border-t border-line px-5 py-8 text-center text-xs text-muted">
        Tefu Investment · Client application · NIN and BVN are completed inside KYC
      </footer>
    </div>
  );
}
