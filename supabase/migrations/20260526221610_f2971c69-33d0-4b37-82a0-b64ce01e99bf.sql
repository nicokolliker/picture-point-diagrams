
-- Roles por área
CREATE TYPE public.area_role AS ENUM ('owner','editor','approver','auditor','viewer','notified');

CREATE TABLE public.area_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.area_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (area_id, user_id, role)
);
CREATE INDEX idx_area_members_user ON public.area_members(user_id);
CREATE INDEX idx_area_members_area ON public.area_members(area_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.area_members TO authenticated;
GRANT ALL ON public.area_members TO service_role;
ALTER TABLE public.area_members ENABLE ROW LEVEL SECURITY;

-- Helper: ¿usuario tiene rol X en área?
CREATE OR REPLACE FUNCTION public.has_area_role(_user_id uuid, _area_id uuid, _role public.area_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.area_members
    WHERE user_id = _user_id AND area_id = _area_id AND role = _role
  );
$$;

-- Helper: ¿usuario es owner del área? (owner o super_admin)
CREATE OR REPLACE FUNCTION public.is_area_owner(_user_id uuid, _area_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'super_admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.area_members
                 WHERE user_id = _user_id AND area_id = _area_id AND role = 'owner');
$$;

CREATE POLICY area_members_select ON public.area_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY area_members_write_owner ON public.area_members
  FOR ALL TO authenticated
  USING (public.is_area_owner(auth.uid(), area_id))
  WITH CHECK (public.is_area_owner(auth.uid(), area_id));

-- Notificados por documento
CREATE TABLE public.doc_notified (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_id, user_id)
);
CREATE INDEX idx_doc_notified_doc ON public.doc_notified(doc_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doc_notified TO authenticated;
GRANT ALL ON public.doc_notified TO service_role;
ALTER TABLE public.doc_notified ENABLE ROW LEVEL SECURITY;

CREATE POLICY doc_notified_select ON public.doc_notified
  FOR SELECT TO authenticated USING (true);
CREATE POLICY doc_notified_write_admin ON public.doc_notified
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Auditorías
CREATE TYPE public.audit_status AS ENUM ('open','closed_green','closed_yellow','closed_red');
CREATE TYPE public.finding_severity AS ENUM ('info','opportunity','inconsistency','risk');

CREATE TABLE public.audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id text NOT NULL,
  doc_name text NOT NULL,
  auditor_id uuid NOT NULL,
  status public.audit_status NOT NULL DEFAULT 'open',
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX idx_audits_doc ON public.audits(doc_id);
-- Solo una auditoría abierta por proceso
CREATE UNIQUE INDEX uniq_audits_one_open_per_doc
  ON public.audits(doc_id) WHERE status = 'open';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audits TO authenticated;
GRANT ALL ON public.audits TO service_role;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY audits_select ON public.audits
  FOR SELECT TO authenticated USING (true);
CREATE POLICY audits_insert_auditor ON public.audits
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = auditor_id);
CREATE POLICY audits_update_own ON public.audits
  FOR UPDATE TO authenticated
  USING (auth.uid() = auditor_id OR public.is_admin(auth.uid()));
CREATE POLICY audits_delete_admin ON public.audits
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_audits_updated_at
  BEFORE UPDATE ON public.audits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Hallazgos
CREATE TABLE public.audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  page_id text,
  shape_id text,
  severity public.finding_severity NOT NULL DEFAULT 'opportunity',
  title text NOT NULL,
  description text,
  promoted_to_doc_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_findings_audit ON public.audit_findings(audit_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_findings TO authenticated;
GRANT ALL ON public.audit_findings TO service_role;
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY findings_select ON public.audit_findings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY findings_write_auditor ON public.audit_findings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.audits a
                 WHERE a.id = audit_id AND (a.auditor_id = auth.uid() OR public.is_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.audits a
                      WHERE a.id = audit_id AND (a.auditor_id = auth.uid() OR public.is_admin(auth.uid()))));
