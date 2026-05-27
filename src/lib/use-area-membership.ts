import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type AreaRole =
  | "owner"
  | "editor"
  | "approver"
  | "auditor"
  | "viewer"
  | "notified";

export interface AreaMembership {
  area_id: string;
  role: AreaRole;
}

/**
 * Roles the current user holds across areas. Returns a map of areaId → roles[],
 * plus convenience checks. Super admins implicitly hold all roles in every area.
 */
export function useAreaMembership() {
  const { user, isAdmin, isSuperAdmin, loading: authLoading } = useAuth();
  const [memberships, setMemberships] = useState<AreaMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setMemberships([]);
      setLoading(false);
      return;
    }
    let alive = true;
    supabase
      .from("area_members")
      .select("area_id, role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!alive) return;
        setMemberships((data as AreaMembership[]) ?? []);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const rolesByArea = new Map<string, Set<AreaRole>>();
  for (const m of memberships) {
    if (!rolesByArea.has(m.area_id)) rolesByArea.set(m.area_id, new Set());
    rolesByArea.get(m.area_id)!.add(m.role);
  }

  const hasRoleInAreas = (
    areaIds: string[] | undefined,
    accepted: AreaRole[],
  ): boolean => {
    if (isSuperAdmin || isAdmin) return true;
    if (!areaIds || areaIds.length === 0) return true; // unscoped doc → permissive
    return areaIds.some((aid) => {
      const roles = rolesByArea.get(aid);
      if (!roles) return false;
      return accepted.some((r) => roles.has(r));
    });
  };

  const hasAnyRoleAnywhere = (accepted: AreaRole[]): boolean => {
    if (isSuperAdmin || isAdmin) return true;
    return memberships.some((m) => accepted.includes(m.role));
  };

  return {
    memberships,
    rolesByArea,
    loading: loading || authLoading,
    hasRoleInAreas,
    hasAnyRoleAnywhere,
    canEdit: (areaIds?: string[]) =>
      hasRoleInAreas(areaIds, ["owner", "editor"]),
    canAudit: (areaIds?: string[]) =>
      hasRoleInAreas(areaIds, ["owner", "auditor"]),
    canApprove: (areaIds?: string[]) =>
      hasRoleInAreas(areaIds, ["owner", "approver"]),
  };
}
