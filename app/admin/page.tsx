"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, LayoutDashboard, Shield, Save, Check } from "lucide-react";
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

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!isAdmin) {
      router.replace("/");
      return;
    }

    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionStatus, isAdmin, router]);

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
        <div className="max-w-4xl mx-auto">
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
        </div>
      </main>
    </div>
  );
}
