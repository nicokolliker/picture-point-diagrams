
-- ============ enums ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'editor', 'viewer');
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE public.approval_decision AS ENUM ('approve', 'reject');
CREATE TYPE public.import_status AS ENUM ('pending', 'generating', 'ready', 'failed');

-- ============ profiles ============
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ user_roles ============
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ has_role helper ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin', 'admin')
  )
$$;

-- ============ doc_approvers ============
CREATE TABLE public.doc_approvers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  required_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(doc_id, user_id)
);
ALTER TABLE public.doc_approvers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_doc_approvers_doc ON public.doc_approvers(doc_id);

-- ============ publish_requests ============
CREATE TABLE public.publish_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id TEXT NOT NULL,
  doc_name TEXT NOT NULL,
  version_number INT NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  required_approvals INT NOT NULL DEFAULT 1,
  status request_status NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
ALTER TABLE public.publish_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_publish_requests_doc ON public.publish_requests(doc_id);
CREATE INDEX idx_publish_requests_status ON public.publish_requests(status);

-- ============ approvals ============
CREATE TABLE public.approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.publish_requests(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES auth.users(id),
  decision approval_decision NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(request_id, approver_id)
);
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

-- ============ granola_imports ============
CREATE TABLE public.granola_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id TEXT NOT NULL,
  note_title TEXT,
  generated_doc_id TEXT,
  status import_status NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.granola_imports ENABLE ROW LEVEL SECURITY;

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Signup trigger ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));

  IF lower(NEW.email) = 'nkolliker@chillit.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'editor')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ Auto-approve when threshold reached ============
CREATE OR REPLACE FUNCTION public.check_approval_threshold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INT;
  v_status request_status;
  v_approves INT;
  v_rejects INT;
BEGIN
  SELECT required_approvals, status INTO v_required, v_status
  FROM public.publish_requests WHERE id = NEW.request_id;

  IF v_status <> 'pending' THEN RETURN NEW; END IF;

  SELECT
    COUNT(*) FILTER (WHERE decision='approve'),
    COUNT(*) FILTER (WHERE decision='reject')
  INTO v_approves, v_rejects
  FROM public.approvals WHERE request_id = NEW.request_id;

  IF v_rejects > 0 THEN
    UPDATE public.publish_requests SET status='rejected', resolved_at=now()
    WHERE id = NEW.request_id;
  ELSIF v_approves >= v_required THEN
    UPDATE public.publish_requests SET status='approved', resolved_at=now()
    WHERE id = NEW.request_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_approval
  AFTER INSERT ON public.approvals
  FOR EACH ROW EXECUTE FUNCTION public.check_approval_threshold();

-- ============ RLS policies ============

-- profiles: everyone signed in can read; only owner or admin can edit
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- user_roles: everyone signed in can read (to see who can approve);
-- only admins can write; super_admin can manage anything
CREATE POLICY "user_roles_select_all" ON public.user_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_admin_write" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- doc_approvers: read by anyone signed in; managed by admins
CREATE POLICY "doc_approvers_select" ON public.doc_approvers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "doc_approvers_admin_write" ON public.doc_approvers
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- publish_requests: anyone signed in can see all (transparency);
-- editors create; admins or requester can cancel
CREATE POLICY "publish_requests_select" ON public.publish_requests
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "publish_requests_insert" ON public.publish_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "publish_requests_update" ON public.publish_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR auth.uid() = requested_by);

-- approvals: anyone signed in can see (audit); only listed approvers (or super_admin) can insert
CREATE POLICY "approvals_select" ON public.approvals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "approvals_insert" ON public.approvals
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = approver_id AND (
      public.has_role(auth.uid(), 'super_admin')
      OR EXISTS (
        SELECT 1 FROM public.doc_approvers da
        JOIN public.publish_requests pr ON pr.doc_id = da.doc_id
        WHERE pr.id = approvals.request_id AND da.user_id = auth.uid()
      )
    )
  );

-- granola_imports: per-user
CREATE POLICY "granola_imports_owner" ON public.granola_imports
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
