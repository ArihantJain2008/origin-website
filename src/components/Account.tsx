import { useEffect, useState } from "react";
import { CheckCircle2, Download, LogOut, ShieldCheck, UserRound } from "lucide-react";
import Navbar from "./Navbar";
import Footer from "./Footer";

type Profile = { id: string; display_name: string; created_at: string };
type DownloadItem = { id: string; byte_count: number; created_at: string; installer_assets?: { filename?: string; platform?: string; application_versions?: { version?: string } } };
type Account = { user: { id: string; email: string }; profile: Profile; downloads: DownloadItem[] };
type Mode = "login" | "register" | "recover";
const inputClass = "w-full rounded-lg border border-border-default bg-canvas px-3.5 py-3 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

async function request(op: string, body?: Record<string, unknown>, method = "POST") {
  const response = await fetch(`/api/account?op=${op}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json() as { ok: boolean; error?: string; message?: string; recovery?: boolean; verificationRequired?: boolean; user?: Account["user"]; profile?: Profile; downloads?: DownloadItem[] };
  if (!response.ok || !result.ok) throw new Error(result.error ?? "Account request failed.");
  return result;
}

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const refresh = async () => {
    try {
      const result = await request("me", undefined, "GET");
      if (result.user && result.profile) { setAccount({ user: result.user, profile: result.profile, downloads: result.downloads ?? [] }); setDisplayName(result.profile.display_name); setEmail(result.user.email); }
      else setAccount(null);
    } catch { setAccount(null); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified")) setMessage("Your email is verified. You can sign in.");
    const tokenHash = params.get("token_hash"); const type = params.get("type");
    if (tokenHash && type) {
      setSending(true);
      void request("verify", { token_hash: tokenHash, type }).then(async (result) => {
        setMessage(result.message ?? "Email verified."); setRecoveryReady(Boolean(result.recovery));
        if (result.recovery) setMode("recover");
        await refresh();
        window.history.replaceState({}, "", "/account");
      }).catch((cause) => setError(cause instanceof Error ? cause.message : "Verification failed.")).finally(() => setSending(false));
    } else void refresh();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSending(true); setError(""); setMessage("");
    try {
      if (mode === "login") { await request("login", { email, password }); setMessage("Signed in."); await refresh(); }
      else if (mode === "register") { const result = await request("register", { email, password, displayName }); setMessage(result.message ?? "Check your email to verify your account."); if (!result.verificationRequired) await refresh(); }
      else { const result = await request("recover", { email }); setMessage(result.message ?? "If an account matches, a recovery email will be sent shortly."); }
      setPassword("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The request failed."); }
    finally { setSending(false); }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault(); setSending(true); setError(""); setMessage("");
    try { await request("profile", { displayName }); const changedEmail = email.toLowerCase() !== account?.user.email.toLowerCase(); if (changedEmail) await request("email", { email }); setMessage(changedEmail ? "Profile saved. Confirm the email change through the messages sent to your inboxes." : "Profile saved."); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Settings could not be saved."); }
    finally { setSending(false); }
  };
  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault(); setSending(true); setError(""); setMessage("");
    try { await request("password", { password }); setPassword(""); setRecoveryReady(false); setMessage("Password updated."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Password could not be updated."); }
    finally { setSending(false); }
  };
  const logout = async () => { setSending(true); try { await request("logout"); setAccount(null); setMode("login"); setMessage("You are signed out."); } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign out failed."); } finally { setSending(false); } };
  const deleteAccount = async () => {
    if (!window.confirm("Delete your Origin account and associated reviews and comments? This cannot be undone.")) return;
    setSending(true); setError("");
    try { await request("delete", {}); setAccount(null); setMessage("Your account was deleted."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Account could not be deleted."); }
    finally { setSending(false); }
  };

  return <div className="min-h-screen bg-canvas"><Navbar /><main className="mx-auto min-h-[75vh] max-w-[1000px] px-5 pb-24 pt-28 sm:px-8 sm:pt-36">
    <div className="mx-auto max-w-3xl"><p className="text-sm font-medium text-accent">Origin account</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Your account</h1><p className="mt-3 text-sm leading-relaxed text-secondary">Save your profile and see downloads made while you were signed in. Public downloads do not require an account.</p>
      {message && <p className="mt-6 flex gap-2 rounded-lg border border-success/25 bg-success/10 px-4 py-3 text-sm text-primary" role="status"><CheckCircle2 className="shrink-0 text-success" size={17} />{message}</p>}
      {error && <p className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{error}</p>}
      {busy || sending && !account ? <p className="mt-10 text-sm text-tertiary">Loading account…</p> : account ? <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-xl border border-border-subtle bg-surface p-6"><div className="mb-6 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-muted text-accent"><UserRound size={19} /></span><div><h2 className="font-semibold text-primary">Account settings</h2><p className="text-xs text-secondary">{account.user.email}</p></div></div>
          <form onSubmit={saveProfile} className="grid gap-4"><label className="grid gap-2 text-sm font-medium text-primary">Display name<input className={inputClass} value={displayName} maxLength={60} onChange={(event) => setDisplayName(event.target.value)} required /></label><label className="grid gap-2 text-sm font-medium text-primary">Email<input className={inputClass} value={email} type="email" maxLength={254} onChange={(event) => setEmail(event.target.value)} required /></label><button disabled={sending} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Save settings</button></form>
          <form onSubmit={changePassword} className="mt-7 grid gap-3 border-t border-border-subtle pt-6"><label className="grid gap-2 text-sm font-medium text-primary">{recoveryReady ? "New password" : "Change password"}<input className={inputClass} type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button disabled={sending} className="rounded-lg border border-border-default px-4 py-2.5 text-sm font-medium text-primary hover:bg-hover disabled:opacity-50">{recoveryReady ? "Set new password" : "Update password"}</button></form>
          <div className="mt-7 flex flex-wrap gap-3 border-t border-border-subtle pt-6"><button type="button" onClick={() => void logout()} disabled={sending} className="flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm text-secondary hover:bg-hover"><LogOut size={15} />Sign out</button><button type="button" onClick={() => void deleteAccount()} disabled={sending} className="rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/10">Delete account</button></div>
        </section>
        <section className="rounded-xl border border-border-subtle bg-surface p-6"><div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-muted text-accent"><Download size={19} /></span><div><h2 className="font-semibold text-primary">Download history</h2><p className="text-xs text-secondary">Full transfers recorded while signed in</p></div></div>
          {account.downloads.length ? <ul className="divide-y divide-border-subtle">{account.downloads.map((item) => <li key={item.id} className="py-3"><p className="text-sm font-medium text-primary">{item.installer_assets?.filename ?? "Origin installer"}</p><p className="mt-1 text-xs text-tertiary">{item.installer_assets?.application_versions?.version ?? ""} · {item.installer_assets?.platform ?? ""} · {new Date(item.created_at).toLocaleString()}</p></li>)}</ul> : <p className="rounded-lg bg-canvas p-4 text-sm text-secondary">No signed-in downloads yet. Anonymous downloads are not attached to your account.</p>}
          <div className="mt-6 flex gap-2 rounded-lg border border-border-subtle p-3 text-xs leading-relaxed text-tertiary"><ShieldCheck size={15} className="shrink-0" />Only downloads made with a valid signed-in session are listed here.</div>
        </section>
      </div> : <section className="mt-8 max-w-xl rounded-xl border border-border-subtle bg-surface p-6 sm:p-8"><div className="mb-6 flex flex-wrap gap-2">{(["login", "register", "recover"] as Mode[]).map((item) => <button key={item} type="button" onClick={() => { setMode(item); setError(""); }} className={`rounded-lg px-3 py-2 text-sm font-medium capitalize ${mode === item ? "bg-accent-muted text-accent" : "text-secondary hover:bg-hover"}`}>{item === "recover" ? "Reset password" : item}</button>)}</div>
        <form onSubmit={submit} className="grid gap-4">{mode === "register" && <label className="grid gap-2 text-sm font-medium text-primary">Display name<input className={inputClass} value={displayName} maxLength={60} onChange={(event) => setDisplayName(event.target.value)} required /></label>}<label className="grid gap-2 text-sm font-medium text-primary">Email<input className={inputClass} type="email" autoComplete="email" value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} required /></label>{mode !== "recover" && <label className="grid gap-2 text-sm font-medium text-primary">Password<input className={inputClass} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 12 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>}<button disabled={sending} className="mt-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Send recovery email"}</button></form>
        <p className="mt-5 text-xs leading-relaxed text-tertiary">Email verification is required according to your Supabase Auth settings. Downloads remain public without signing in.</p>
      </section>}
    </div></main><Footer /></div>;
}
