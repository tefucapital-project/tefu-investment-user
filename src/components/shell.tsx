import { Bell, Briefcase, Building2, Coins, FolderOpen, LayoutDashboard, LifeBuoy, LogOut, Menu, PieChart, Receipt, Shield, Sprout, Wallet, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useApp } from "../context/AppState";
import { naira } from "../lib/format";
import { homePath, visibleNotifications } from "../lib/selectors";
import { Logo } from "./ui";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/invest/mudarabah", label: "Mudarabah", icon: Sprout },
  { to: "/invest/ijarah", label: "Ijarah", icon: Building2 },
  { to: "/investments", label: "My Investments", icon: Briefcase },
  { to: "/portfolio", label: "Portfolio", icon: PieChart },
  { to: "/profits", label: "Profit History", icon: Coins },
  { to: "/fees", label: "Fee History", icon: Receipt },
  { to: "/transactions", label: "Transactions", icon: Wallet },
  { to: "/documents", label: "Documents", icon: FolderOpen },
  { to: "/support", label: "Support", icon: LifeBuoy },
];

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1">
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm ${isActive ? "bg-white/12 text-gold2" : "text-white/75 hover:bg-white/6"}`
            }
          >
            <Icon size={16} />
            {link.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  const { user, state, logout } = useApp();
  const [open, setOpen] = useState(false);
  if (!user) return <Navigate to="/login" replace />;
  const unread = visibleNotifications(user, state).filter((item) => !item.read).length;
  return (
    <div className="min-h-screen bg-cream">
      <aside className="forest-panel fixed inset-y-0 left-0 z-30 hidden w-64 flex-col px-4 py-5 text-white md:flex">
        <Logo light />
        <div className="mt-8 flex-1">
          <SideNav />
        </div>
        <div className="space-y-1 border-t border-white/10 pt-4">
          <NavLink to="/profile" className="block rounded-2xl px-3 py-2 text-sm text-white/80 hover:bg-white/6">Profile</NavLink>
          <NavLink to="/banks" className="block rounded-2xl px-3 py-2 text-sm text-white/80 hover:bg-white/6">Bank accounts</NavLink>
          <NavLink to="/security" className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm text-white/80 hover:bg-white/6">
            <Shield size={16} /> Security
          </NavLink>
          <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm text-white/80 hover:bg-white/6">
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-cream/90 px-4 py-3 backdrop-blur md:px-8">
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-line md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={18} />
          </button>
          <p className="hidden text-sm text-muted md:block">Available balance</p>
          <div className="flex items-center gap-3">
            <p className="font-serif text-lg text-forest">{naira(user.wallet.available)}</p>
            <NavLink to="/notifications" className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-paper" aria-label="Notifications">
              <Bell size={16} />
              {unread > 0 ? <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] text-white">{unread}</span> : null}
            </NavLink>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">
          <Outlet />
        </main>
        <p className="px-4 pb-8 text-center text-xs text-muted md:px-8">Records stay on this device. Profit and rental follow actual performance.</p>
      </div>
      {open ? (
        <div className="fixed inset-0 z-40 bg-ink/40 md:hidden" onClick={() => setOpen(false)}>
          <div className="forest-panel flex h-full w-72 flex-col px-4 py-5 text-white" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <Logo light />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
            </div>
            <SideNav onNavigate={() => setOpen(false)} />
            <div className="mt-4 space-y-1 border-t border-white/10 pt-4">
              <NavLink to="/profile" onClick={() => setOpen(false)} className="block rounded-2xl px-3 py-2 text-sm text-white/80">Profile</NavLink>
              <NavLink to="/banks" onClick={() => setOpen(false)} className="block rounded-2xl px-3 py-2 text-sm text-white/80">Bank accounts</NavLink>
              <NavLink to="/security" onClick={() => setOpen(false)} className="block rounded-2xl px-3 py-2 text-sm text-white/80">Security</NavLink>
              <button type="button" onClick={logout} className="block px-3 py-2 text-sm text-white/80">Log out</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function OnboardingShell() {
  const { user, logout } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  const steps = [
    { label: "Account", done: true },
    { label: "Client Onboarding Fee", done: Boolean(user.feePaidAt) },
    { label: "KYC", done: user.status === "active" },
  ];
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Logo />
          <button type="button" onClick={logout} className="text-sm text-muted">Log out</button>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <ol className="mb-6 flex flex-wrap gap-2">
          {steps.map((step) => (
            <li key={step.label} className={`rounded-full px-3 py-1 text-xs ${step.done ? "bg-forest text-gold2" : "bg-paper text-muted"}`}>
              {step.label}
            </li>
          ))}
        </ol>
        <Outlet />
      </div>
    </div>
  );
}

export function AuthFrame({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="forest-panel hidden flex-col justify-between p-12 text-gold2 lg:flex">
        <Logo light />
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold">Islamic investment</p>
          <h1 className="mt-4 max-w-md font-serif text-5xl leading-[1.05] text-white">Capital that shares in the outcome.</h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/75">
            Mudarabah profit-sharing and Ijarah leasing. Every fee is shown before you confirm. Returns follow the contract and the actual result.
          </p>
        </div>
        <p className="text-xs text-white/50">Client access only · No interest products</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h2 className="font-serif text-4xl text-forest">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{lede}</p>
          <div className="mt-6">{children}</div>
        </div>
      </section>
    </div>
  );
}

export function ClientLayout() {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  if (user.status === "suspended") return <Navigate to="/suspended" replace />;
  if (user.status === "otp_pending") return <Navigate to="/onboarding/fee" replace />;
  if (user.status === "active" || user.status === "kyc_approved") return <AppShell />;
  return <OnboardingShell />;
}

export function ActiveOnly() {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  if (user.status !== "active" && user.status !== "kyc_approved") return <Navigate to={homePath(user)} replace />;
  return <Outlet />;
}

export function RequireFee() {
  const { user } = useApp();
  if (!user?.feePaidAt) return <Navigate to="/onboarding/fee" replace />;
  return <Outlet />;
}

export function Guest({ children }: { children: ReactNode }) {
  const { user } = useApp();
  if (user) return <Navigate to={homePath(user)} replace />;
  return children;
}
