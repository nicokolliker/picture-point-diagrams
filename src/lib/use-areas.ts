import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Area = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  sort_order: number;
};

export function useAreas() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("areas")
      .select("id,name,color,icon,sort_order")
      .order("sort_order", { ascending: true });
    setAreas((data as Area[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { areas, loading, refresh };
}

export async function createArea(name: string, color: string) {
  const max = await supabase
    .from("areas")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = (max.data?.sort_order ?? 0) + 1;
  return supabase.from("areas").insert({ name, color, sort_order: next });
}

export async function updateArea(id: string, patch: Partial<Pick<Area, "name" | "color" | "sort_order">>) {
  return supabase.from("areas").update(patch).eq("id", id);
}

export async function deleteArea(id: string) {
  return supabase.from("areas").delete().eq("id", id);
}
