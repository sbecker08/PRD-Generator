"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, LayoutDashboard, Shield, Save, Check, KeyRound, Plus, Copy, Trash2, Eye } from "lucide-react";
import UserMenu from "../components/user-menu";
import PageHeader from "../components/page-header";

type UserRole = "Business Requester" | "IS Reviewer" | "IS Engineer" | "Admin";

const ALL_ROLES: UserRole[] = [
  "Business Requester",
  "IS Reviewer",
  "IS Engineer",
  "Admin",
];

type UserRow = {
  id: string;
  entra_id: string;
  name: string;
  email: string;
  created_at: string;
  roles: UserRole[];
};

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
};

export default function AdminPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<
    Record<string, UserRole[]>
  >({});

  const isAdmin = session?.user?.roles?.includes("Admin");

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ id: string; name: string; key: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!isAdmin) {
      router.replace("/");
      return;
    }

    Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/api-keys").then((r) => r.json()),
    ])
      .then(([usersData, keysData]) => {
        setUsers(usersData);
        setApiKeys(keysData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionStatus, isAdmin, router]);

  async function createKey() {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setApiKeys((prev) => [data, ...prev]);
      setRevealedKey({ id: data.id, name: data.name, key: data.key });
      setNewKeyName("");
    }
    setCreatingKey(false);
  }

  async function revokeKey(id: string) {
    setRevokingId(id);
    const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    if (res.ok) {
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
      if (revealedKey?.id === id) setRevealedKey(null);
    }
    setRevokingId(null);
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  function toggleRole(userId: string, role: UserRole) {
    const current = pendingChanges[userId] ??
      users.find((u) => u.id === userId)?.roles ?? [];
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    setPendingChanges((prev) => ({ ...prev, [userId]: next }));
  }

  function getRoles(user: UserRow): UserRole[] {
    return pendingChanges[user.id] ?? user.roles;
  }

  function hasChanges(user: UserRow): boolean {
    if (!pendingChanges[user.id]) return false;
    const original = [...user.roles].sort();
    const current = [...pendingChanges[user.id]].sort();
    return JSON.stringify(original) !== JSON.stringify(current);
  }

  async function saveRoles(userId: string) {
    const roles = pendingChanges[userId];
    if (!roles) return;

    setSaving(userId);
    const res = await fetch(`/api/admin/users/${userId}/roles`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roles }),
    });

    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, roles } : u))
      );
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setSaved(userId);
      setTimeout(() => setSaved(null), 2000);
    }
    setSaving(null);
  }

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>
      <PageHeader
        icon={<Shield size={18} className="text-white" />}
        title="Admin"
        subtitle="User & Role Management"
        actions={
          <>
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <LayoutDashboard size={14} />
              Dashboard
            </Link>
            <UserMenu />
          </>
        }
      />

      <main className="px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {users.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <FileText size={28} className="text-primary-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-700 mb-2">
                No users yet
              </h2>
              <p className="text-sm text-gray-400">
                Users will appear here after they sign in for the first time.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">
                      User
                    </th>
                    {ALL_ROLES.map((role) => (
                      <th
                        key={role}
                        className="text-center px-3 py-3 font-semibold text-gray-600 whitespace-nowrap"
                      >
                        {role}
                      </th>
                    ))}
                    <th className="text-center px-3 py-3 font-semibold text-gray-600 w-20">
                      Save
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const roles = getRoles(user);
                    const changed = hasChanges(user);
                    const isSaving = saving === user.id;
                    const justSaved = saved === user.id;

                    return (
                      <tr
                        key={user.id}
                        className="border-b border-gray-50 hover:bg-gray-50/50"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">
                            {user.name}
                          </p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </td>
                        {ALL_ROLES.map((role) => (
                          <td key={role} className="text-center px-3 py-3">
                            <input
                              type="checkbox"
                              checked={roles.includes(role)}
                              onChange={() => toggleRole(user.id, role)}
                              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                            />
                          </td>
                        ))}
                        <td className="text-center px-3 py-3">
                          {justSaved ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600">
                              <Check size={14} />
                            </span>
                          ) : (
                            <button
                              onClick={() => saveRoles(user.id)}
                              disabled={!changed || isSaving}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-primary-600 hover:bg-primary-50"
                            >
                              <Save size={12} />
                              Save
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {/* API Keys */}
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound size={16} className="text-primary-500" />
              <h2 className="text-base font-semibold text-gray-800">API Keys</h2>
              <span className="text-xs text-gray-400 ml-1">for system integrations</span>
            </div>

            {/* Revealed key banner — shown once after creation */}
            {revealedKey && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Eye size={14} className="text-amber-600 shrink-0" />
                      <p className="text-sm font-semibold text-amber-800">
                        Copy this key now — it won&apos;t be shown again
                      </p>
                    </div>
                    <p className="text-xs text-amber-600 mb-2">Key: <span className="font-medium">{revealedKey.name}</span></p>
                    <code className="block text-xs font-mono bg-white border border-amber-200 rounded-lg px-3 py-2 text-amber-900 break-all select-all">
                      {revealedKey.key}
                    </code>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => copyKey(revealedKey.key)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                    >
                      {copiedKey ? <Check size={12} /> : <Copy size={12} />}
                      {copiedKey ? "Copied" : "Copy"}
                    </button>
                    <button
                      onClick={() => setRevealedKey(null)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-amber-600 hover:bg-amber-100 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Create new key */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Create New Key</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createKey()}
                  placeholder="e.g. CRM Integration"
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <button
                  onClick={createKey}
                  disabled={!newKeyName.trim() || creatingKey}
                  className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus size={14} />
                  {creatingKey ? "Creating…" : "Create"}
                </button>
              </div>
            </div>

            {/* Keys list */}
            {apiKeys.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-xl border border-gray-100 shadow-sm">
                <KeyRound size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No API keys yet</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Prefix</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Created</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Last used</th>
                      <th className="w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map((key) => (
                      <tr key={key.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">{key.name}</td>
                        <td className="px-4 py-3">
                          <code className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                            {key.key_prefix}…
                          </code>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(key.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {key.last_used_at
                            ? new Date(key.last_used_at).toLocaleString()
                            : <span className="text-gray-300">Never</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => revokeKey(key.id)}
                            disabled={revokingId === key.id}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <Trash2 size={12} />
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
