import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const KEY = "tefu.investment.user.v1";

export function RecoverDemoPage() {
  const payload = useMemo(() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  }, []);
  const users = useMemo(() => {
    if (!payload) return [];
    try {
      const parsed = JSON.parse(payload) as { users?: { email?: string; phone?: string; firstName?: string; lastName?: string; status?: string }[] };
      return Array.isArray(parsed.users) ? parsed.users : [];
    } catch {
      return [];
    }
  }, [payload]);
  const [copied, setCopied] = useState(false);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="font-serif text-3xl text-forest">Recover demo signups</p>
      <p className="mt-3 text-sm leading-6 text-muted">
        Browser-only demo accounts are stored in this device under <code>{KEY}</code>. If this browser still has them, download or copy the JSON and import it in the admin Clients page.
      </p>
      {!payload ? (
        <p className="mt-6 rounded-2xl border border-line bg-paper p-4 text-sm">No demo signup data was found in this browser.</p>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-sm">{users.length} account(s) found on this device.</p>
          <ul className="space-y-2 text-sm">
            {users.map((user) => (
              <li key={`${user.email}-${user.phone}`} className="rounded-2xl border border-line bg-paper px-4 py-3">
                {(user.firstName || "") + " " + (user.lastName || "")} · {user.email} · {user.phone} · {user.status}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-full bg-forest px-4 py-2 text-sm text-gold2"
              onClick={async () => {
                await navigator.clipboard.writeText(payload);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy JSON"}
            </button>
            <a
              className="rounded-full border border-line px-4 py-2 text-sm"
              href={`data:application/json,${encodeURIComponent(payload)}`}
              download="tefu-demo-users.json"
            >
              Download JSON
            </a>
          </div>
        </div>
      )}
      <p className="mt-8 text-sm">
        <Link className="text-canopy" to="/">
          Back to home
        </Link>
      </p>
    </main>
  );
}
