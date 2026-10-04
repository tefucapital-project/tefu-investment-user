import { useState } from "react";
import { Link } from "react-router-dom";
import { Banner, Button, PageTitle, Pill, SelectField, TextArea, TextField } from "../components/ui";
import { useClient } from "../context/AppState";
import { BANKS, FAQS, NIGERIA_STATES } from "../lib/catalog";
import { dateTime, formatPhone, fullName, maskAccount, passwordIssue } from "../lib/format";
import { TICKET_LABEL } from "../lib/labels";
import { visibleNotifications } from "../lib/selectors";

export function NotificationsPage() {
  const { user, state, markRead, markAllRead } = useClient();
  const notes = visibleNotifications(user, state);
  return (
    <div>
      <PageTitle title="Notifications" lede="Account, payments, investments, and security." action={<Button variant="secondary" onClick={markAllRead}>Mark all read</Button>} />
      <ul className="space-y-3">
        {notes.map((item) => (
          <li key={item.id} className="rounded-3xl border border-line bg-paper p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{item.title}</p>
              <Pill status={item.read ? "closed" : "pending"}>{item.read ? "Read" : "Unread"}</Pill>
            </div>
            <p className="mt-1 text-sm">{item.message}</p>
            <p className="mt-2 text-xs text-muted">{item.type} · {dateTime(item.createdAt)}</p>
            {!item.read ? <button type="button" className="mt-2 text-sm text-canopy" onClick={() => markRead(item.id)}>Mark read</button> : null}
          </li>
        ))}
        {notes.length === 0 ? <li className="text-sm text-muted">No notifications for the categories you have switched on.</li> : null}
      </ul>
    </div>
  );
}

export function ProfilePage() {
  const { user, updateProfile, updatePrefs } = useClient();
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [address, setAddress] = useState(user.kyc.personal.address);
  const [stateName, setStateName] = useState(user.kyc.personal.state);
  const [lga, setLga] = useState(user.kyc.personal.lga);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const locked = user.kyc.nin.status === "verified" || user.kyc.bvn.status === "verified";
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <PageTitle title="Profile" lede="Verified identity names stay locked. Address, email, and phone can be updated." />
        <form
          className="space-y-4 rounded-[2rem] border border-line bg-paper p-5"
          onSubmit={(event) => {
            event.preventDefault();
            const result = updateProfile({ email, phone, address, stateName, lga });
            if (!result.ok) {
              setSaved("");
              setError(result.error);
              return;
            }
            setError("");
            setSaved("Profile saved.");
          }}
        >
          {error ? <Banner tone="danger">{error}</Banner> : null}
          {saved ? <Banner tone="ok">{saved}</Banner> : null}
          <p className="text-sm">Name: {fullName(user)} {locked ? "· locked after identity verification" : ""}</p>
          {user.profile.photo ? <img src={user.profile.photo} alt="Profile" className="h-20 w-20 rounded-full object-cover" /> : null}
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Profile photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file || file.size > 500_000) return;
                const reader = new FileReader();
                reader.onload = () => updateProfile({ photo: String(reader.result) });
                reader.readAsDataURL(file);
              }}
            />
          </label>
          <TextField label="Email" value={email} onChange={setEmail} />
          <TextField label="Phone" value={phone} onChange={setPhone} />
          <TextField label="Address" value={address} onChange={setAddress} />
          <SelectField label="State" value={stateName} onChange={setStateName} options={NIGERIA_STATES} />
          <TextField label="LGA" value={lga} onChange={setLga} />
          <Button type="submit">Save profile</Button>
        </form>
      </section>
      <section className="rounded-[2rem] border border-line bg-paper p-5">
        <h2 className="font-serif text-2xl text-forest">Notification preferences</h2>
        <div className="mt-4 space-y-3 text-sm">
          {(Object.keys(user.notifPrefs) as Array<keyof typeof user.notifPrefs>).map((key) => (
            <label key={key} className="flex items-center justify-between gap-3 capitalize">
              {key}
              <input
                type="checkbox"
                checked={user.notifPrefs[key]}
                onChange={(event) => updatePrefs({ ...user.notifPrefs, [key]: event.target.checked })}
              />
            </label>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">Phone on file: {formatPhone(user.phone)}</p>
        <div className="mt-4 flex gap-4 text-sm">
          <Link to="/kyc/status" className="text-canopy">KYC information</Link>
          <Link to="/banks" className="text-canopy">Bank accounts</Link>
        </div>
      </section>
    </div>
  );
}

export function BanksPage() {
  const { user, saveBank } = useClient();
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [error, setError] = useState("");
  return (
    <div>
      <PageTitle title="Bank accounts" lede="Only a verified account can be selected for withdrawal." />
      <ul className="space-y-3">
        {user.banks.map((item) => (
          <li key={item.id} className="rounded-3xl border border-line bg-paper p-4 text-sm">
            <div className="flex items-center justify-between"><span>{item.bankName}</span><Pill status={item.status} /></div>
            <p className="mt-1">{item.accountName} · {maskAccount(item.accountNumber)}</p>
            <p className="text-muted">{item.reason}</p>
          </li>
        ))}
      </ul>
      <form
        className="mt-6 max-w-xl space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const result = saveBank({ bankName, accountNumber, accountName });
          setError(result.ok ? "" : result.error);
          if (result.ok) {
            setAccountNumber("");
            setAccountName("");
          }
        }}
      >
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <SelectField label="Bank name" value={bankName} onChange={setBankName} options={BANKS} />
        <TextField label="Account number" value={accountNumber} onChange={setAccountNumber} />
        <TextField label="Account name" value={accountName} onChange={setAccountName} />
        <Button type="submit">Verify account</Button>
      </form>
    </div>
  );
}

export function SecurityPage() {
  const { user, state, changePassword, setPin, setTwoFactor, logoutOthers, clearDeviceData } = useClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pin, setPinValue] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [passwordFor2fa, setPasswordFor2fa] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const sessions = state.sessions.filter((item) => item.userId === user.id && item.expiresAt > Date.now());
  const report = (result: { ok: boolean; error?: string }, success: string) => {
    if (!result.ok) {
      setMessage("");
      setError(result.error ?? "That could not be saved.");
      return;
    }
    setError("");
    setMessage(success);
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-[2rem] border border-line bg-paper p-5">
        <h2 className="font-serif text-2xl text-forest">Password</h2>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {message ? <Banner tone="ok">{message}</Banner> : null}
        <TextField label="Current password" type="password" value={current} onChange={setCurrent} />
        <TextField label="New password" type="password" value={next} onChange={setNext} />
        <Button
          onClick={async () => {
            const issue = passwordIssue(next);
            if (issue) {
              setError(issue);
              return;
            }
            report(await changePassword(current, next), "Password updated. Other sessions were signed out.");
          }}
        >
          Change password
        </Button>
        <h2 className="pt-4 font-serif text-2xl text-forest">Transaction PIN</h2>
        {user.pinHash ? <TextField label="Current PIN" value={currentPin} onChange={setCurrentPin} /> : null}
        <TextField label={user.pinHash ? "New PIN" : "Create a 4-digit PIN"} value={pin} onChange={setPinValue} />
        <Button onClick={async () => report(await setPin(pin, currentPin), "PIN saved.")}>Save PIN</Button>
      </section>
      <section className="space-y-4 rounded-[2rem] border border-line bg-paper p-5">
        <h2 className="font-serif text-2xl text-forest">Sessions</h2>
        <ul className="space-y-2 text-sm">
          {sessions.map((item) => (
            <li key={item.id} className="rounded-2xl bg-cream px-3 py-2">
              {item.device} · {item.ipLabel} {item.id === state.currentSessionId ? "· this device" : ""}
              <span className="block text-xs text-muted">Expires {dateTime(item.expiresAt)}</span>
            </li>
          ))}
        </ul>
        <Button variant="secondary" onClick={() => report(logoutOthers(), "Other devices were signed out.")}>Log out other devices</Button>
        <h2 className="pt-4 font-serif text-2xl text-forest">Two-factor sign-in</h2>
        <p className="text-sm text-muted">{user.twoFactor ? "A code is required after your password." : "Optional. Turn it on to require a code at sign-in."}</p>
        <TextField label="Password" type="password" value={passwordFor2fa} onChange={setPasswordFor2fa} />
        <Button variant="secondary" onClick={async () => report(await setTwoFactor(!user.twoFactor, passwordFor2fa), user.twoFactor ? "Two-factor sign-in is off." : "Two-factor sign-in is on.")}>
          {user.twoFactor ? "Turn off" : "Turn on"}
        </Button>
        <button type="button" className="block text-sm text-danger" onClick={clearDeviceData}>Remove demo data on this device</button>
      </section>
    </div>
  );
}

export function SupportPage() {
  const { state, user, createTicket, closeTicket } = useClient();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState<number | null>(0);
  const [error, setError] = useState("");
  const tickets = state.tickets.filter((item) => item.userId === user.id);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <PageTitle title="Help centre" lede="Short answers, then a ticket if you still need a person." />
        <div className="space-y-2">
          {FAQS.map((item, index) => (
            <button key={item.q} type="button" onClick={() => setOpen(open === index ? null : index)} className="block w-full rounded-3xl border border-line bg-paper px-4 py-3 text-left">
              <span className="font-medium">{item.q}</span>
              {open === index ? <span className="mt-2 block text-sm leading-6 text-muted">{item.a}</span> : null}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-forest">Contact support</h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const result = createTicket(subject, description);
            if (!result.ok) setError(result.error);
            else {
              setError("");
              setSubject("");
              setDescription("");
            }
          }}
        >
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <TextField label="Subject" value={subject} onChange={setSubject} />
          <TextArea label="Description" value={description} onChange={setDescription} />
          <Button type="submit">Create ticket</Button>
        </form>
        <ul className="mt-6 space-y-3">
          {tickets.map((item) => (
            <li key={item.id} className="rounded-3xl border border-line bg-paper p-4 text-sm">
              <div className="flex items-center justify-between"><span className="font-medium">{item.subject}</span><Pill status={item.status}>{TICKET_LABEL[item.status]}</Pill></div>
              <p className="mt-2 text-muted">{item.description}</p>
              <p className="mt-1 text-xs text-muted">{dateTime(item.createdAt)}</p>
              {item.status !== "closed" ? <button type="button" className="mt-2 text-canopy" onClick={() => closeTicket(item.id)}>Close ticket</button> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
