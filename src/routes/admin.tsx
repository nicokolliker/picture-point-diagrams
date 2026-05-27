import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useDiagramStore } from "@/lib/diagram-store";
import { ArrowLeft, Shield, UserPlus } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — FlowIt" }] }),
  component: AdminPage,
});

type Profile = { id: string; email: string; display_name: string | null };
type RoleRow = { user_id: string; role: "super_admin" | "admin" | "editor" | "viewer" };
type ApproverRow = { id: string; doc_id: string; user_id: string; required_count: number };
type AreaRow = { id: string; name: string; color: string };
type AreaMemberRow = {
  id: string;
  area_id: string;
  user_id: string;
  role: "owner" | "editor" | "approver" | "auditor" | "viewer" | "notified";
};
type NotifiedRow = { id: string; doc_id: string; user_id: string };

const AREA_ROLES: AreaMemberRow["role"][] = [
  "owner",
  "editor",
  "approver",
  "auditor",
  "viewer",
  "notified",
];

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const docs = useDiagramStore((s) => s.documents);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [approvers, setApprovers] = useState<ApproverRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [areaMembers, setAreaMembers] = useState<AreaMemberRow[]>([]);
  const [notified, setNotified] = useState<NotifiedRow[]>([]);

  const [docId, setDocId] = useState<string>("");
  const [newApproverId, setNewApproverId] = useState<string>("");
  const [required, setRequired] = useState<number>(1);

  const [amAreaId, setAmAreaId] = useState<string>("");
  const [amUserId, setAmUserId] = useState<string>("");
  const [amRole, setAmRole] = useState<AreaMemberRow["role"]>("editor");

  const [notifDocId, setNotifDocId] = useState<string>("");
  const [notifUserId, setNotifUserId] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const refresh = async () => {
    const [p, r, a, ar, am, n] = await Promise.all([
      supabase.from("profiles").select("id,email,display_name"),
      supabase.from("user_roles").select("user_id,role"),
      supabase.from("doc_approvers").select("*"),
      supabase.from("areas").select("id,name,color").order("sort_order"),
      supabase.from("area_members").select("*"),
      supabase.from("doc_notified").select("*"),
    ]);
    setProfiles((p.data as Profile[]) ?? []);
    setRoles((r.data as RoleRow[]) ?? []);
    setApprovers((a.data as ApproverRow[]) ?? []);
    setAreas((ar.data as AreaRow[]) ?? []);
    setAreaMembers((am.data as AreaMemberRow[]) ?? []);
    setNotified((n.data as NotifiedRow[]) ?? []);
  };

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin]);

  if (loading) return <div className="p-8">Loading…</div>;
  if (!isAdmin)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Shield className="mx-auto h-10 w-10 text-[#9CA3AF]" />
          <p className="mt-3 text-[#6B7280]">You need admin access to view this page.</p>
          <Link to="/home" className="mt-4 inline-block text-[#5B6CF8] hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );

  const setRole = async (userId: string, role: RoleRow["role"]) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) toast.error(error.message);
    else toast.success("Role updated");
    refresh();
  };

  const addApprover = async () => {
    if (!docId || !newApproverId) return;
    const { error } = await supabase.from("doc_approvers").insert({
      doc_id: docId,
      user_id: newApproverId,
      required_count: required,
    });
    if (error) toast.error(error.message);
    else toast.success("Approver added");
    refresh();
  };

  const removeApprover = async (id: string) => {
    await supabase.from("doc_approvers").delete().eq("id", id);
    refresh();
  };

  const profileName = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p ? p.display_name || p.email : id.slice(0, 8);
  };

  const docName = (id: string) => docs.find((d) => d.id === id)?.name ?? id;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="flex h-14 items-center justify-between border-b border-[#EBEBEB] bg-white px-4">
        <div className="flex items-center gap-3">
          <Link to="/home" className="text-[#6B7280] hover:text-[#111827]">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-semibold">Admin</h1>
        </div>
        <div className="text-sm text-[#6B7280]">{user?.email}</div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 p-8">
        <section className="rounded-lg border border-[#EBEBEB] bg-white p-5">
          <h2 className="mb-3 text-base font-semibold">Users & roles</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => {
                const current = roles.find((r) => r.user_id === p.id)?.role ?? "viewer";
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.display_name ?? p.email}</div>
                      <div className="text-xs text-[#6B7280]">{p.email}</div>
                    </TableCell>
                    <TableCell>
                      <Select value={current} onValueChange={(v) => setRole(p.id, v as RoleRow["role"])}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="super_admin">Super admin</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>

        <section className="rounded-lg border border-[#EBEBEB] bg-white p-5">
          <h2 className="mb-3 text-base font-semibold">Approvers per document</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <Label>Document</Label>
              <Select value={docId} onValueChange={setDocId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a document" />
                </SelectTrigger>
                <SelectContent>
                  {docs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Approver</Label>
              <Select value={newApproverId} onValueChange={setNewApproverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a user" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name ?? p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Required approvals</Label>
              <Input
                type="number"
                min={1}
                value={required}
                onChange={(e) => setRequired(parseInt(e.target.value || "1"))}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addApprover} className="w-full bg-[#5B6CF8] hover:bg-[#4856E0]">
                <UserPlus className="h-4 w-4" />
                Add approver
              </Button>
            </div>
          </div>

          <Table className="mt-5">
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Approver</TableHead>
                <TableHead>Required</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvers.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{docName(a.doc_id)}</TableCell>
                  <TableCell>{profileName(a.user_id)}</TableCell>
                  <TableCell>{a.required_count}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => removeApprover(a.id)}>
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {approvers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-[#9CA3AF]">
                    No approvers yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
      </main>
    </div>
  );
}
