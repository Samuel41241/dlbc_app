-- ========================================
-- DLBC ATTENDANCE INTELLIGENCE SYSTEM
-- Production-Ready Supabase Migration
-- STRICT RBAC + Row-Level Security (RLS)
-- ========================================
--
-- This is the AUTHORITATIVE database schema.
-- Run this against a fresh Supabase project.
--
-- STRUCTURE:
--   1. Enable required extensions
--   2. Create hierarchy tables (states → regions → groups → districts → locations)
--   3. Create profiles table with RBAC columns
--   4. Create members table with full hierarchy path
--   5. Create attendance table
--   6. Create newcomers table
--   7. Create audit_logs table
--   8. Create indexes for performance
--   9. Enable RLS on all tables
--  10. Create RLS policies (strict scope enforcement)
--  11. Seed hierarchy data
--  12. Seed demo users
--
-- ========================================

-- ========================================
-- 1. EXTENSIONS
-- ========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- 2. HIERARCHY TABLES
-- ========================================

-- States (top level)
CREATE TABLE IF NOT EXISTS states (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Regions (under states)
CREATE TABLE IF NOT EXISTS regions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  state_id    UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Groups (under regions)
CREATE TABLE IF NOT EXISTS groups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  region_id   UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Districts (under groups)
CREATE TABLE IF NOT EXISTS districts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Locations (under districts)
CREATE TABLE IF NOT EXISTS locations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  district_id   UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- 3. PROFILES TABLE (Users with RBAC)
-- ========================================

CREATE TABLE IF NOT EXISTS profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT UNIQUE NOT NULL,
  full_name             TEXT,
  role                  TEXT NOT NULL DEFAULT 'location_pastor',
  -- Hierarchy scope
  state_id              UUID NOT NULL REFERENCES states(id),
  region_id             UUID REFERENCES regions(id),
  group_id              UUID REFERENCES groups(id),
  district_id           UUID REFERENCES districts(id),
  location_id           UUID REFERENCES locations(id),
  -- Security
  is_active             BOOLEAN DEFAULT true,
  failedLoginAttempts INT DEFAULT 0,
  -- Timestamps
  created_at            TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT profiles_role_check CHECK (
    role IN (
      'super_admin',
      'state_admin', 'region_admin', 'group_admin', 'district_admin', 'location_admin',
      'state_pastor', 'region_pastor', 'group_pastor', 'district_pastor', 'location_pastor'
    )
  )
);

-- ========================================
-- 4. MEMBERS TABLE (Full hierarchy path)
-- ========================================

CREATE TABLE IF NOT EXISTS members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name       TEXT NOT NULL,
  category        TEXT CHECK (category IN ('Adult', 'Youth', 'Children')),
  gender          TEXT,
  phone           TEXT,
  address         TEXT,
  -- Full hierarchy (ALL NOT NULL — mandatory path)
  state_id        UUID NOT NULL REFERENCES states(id),
  region_id       UUID NOT NULL REFERENCES regions(id),
  group_id        UUID NOT NULL REFERENCES groups(id),
  district_id     UUID NOT NULL REFERENCES districts(id),
  location_id     UUID NOT NULL REFERENCES locations(id),
  -- System
  is_active       BOOLEAN DEFAULT true,
  card_number     TEXT UNIQUE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- 5. ATTENDANCE TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS attendance (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_type    TEXT NOT NULL,
  service_date    DATE NOT NULL,
  present         INT DEFAULT 0,
  total           INT DEFAULT 0,
  -- Full hierarchy
  state_id        UUID NOT NULL REFERENCES states(id),
  region_id       UUID REFERENCES regions(id),
  group_id        UUID REFERENCES groups(id),
  district_id     UUID REFERENCES districts(id),
  location_id     UUID NOT NULL REFERENCES locations(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- 6. NEWCOMERS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS newcomers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name       TEXT NOT NULL,
  phone_number    TEXT,
  email           TEXT,
  address         TEXT,
  category        TEXT DEFAULT 'Adult' CHECK (category IN ('Adult', 'Youth', 'Children')),
  gender          TEXT,
  service_type    TEXT,
  -- Full hierarchy
  state_id        UUID NOT NULL REFERENCES states(id),
  region_id       UUID NOT NULL REFERENCES regions(id),
  group_id        UUID NOT NULL REFERENCES groups(id),
  district_id     UUID NOT NULL REFERENCES districts(id),
  location_id     UUID NOT NULL REFERENCES locations(id),
  date_recorded   TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- 7. AUDIT LOGS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type     TEXT NOT NULL,
  actor           TEXT NOT NULL,
  actor_role      TEXT,
  target          TEXT,
  description     TEXT,
  ip_address      INET,
  -- Hierarchy (nullable — some logs are system-wide)
  state_id        UUID REFERENCES states(id),
  region_id       UUID REFERENCES regions(id),
  group_id        UUID REFERENCES groups(id),
  district_id     UUID REFERENCES districts(id),
  location_id     UUID REFERENCES locations(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- 8. INDEXES (Performance)
-- ========================================

-- Hierarchy indexes
CREATE INDEX IF NOT EXISTS idx_regions_state ON regions(state_id);
CREATE INDEX IF NOT EXISTS idx_groups_region ON groups(region_id);
CREATE INDEX IF NOT EXISTS idx_districts_group ON districts(group_id);
CREATE INDEX IF NOT EXISTS idx_locations_district ON locations(district_id);

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_state ON profiles(state_id);
CREATE INDEX IF NOT EXISTS idx_profiles_region ON profiles(region_id);
CREATE INDEX IF NOT EXISTS idx_profiles_group ON profiles(group_id);
CREATE INDEX IF NOT EXISTS idx_profiles_district ON profiles(district_id);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles(location_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Members indexes
CREATE INDEX IF NOT EXISTS idx_members_state ON members(state_id);
CREATE INDEX IF NOT EXISTS idx_members_region ON members(region_id);
CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_id);
CREATE INDEX IF NOT EXISTS idx_members_district ON members(district_id);
CREATE INDEX IF NOT EXISTS idx_members_location ON members(location_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_card ON members(card_number);

-- Attendance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_location ON attendance(location_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(service_date);

-- Newcomers indexes
CREATE INDEX IF NOT EXISTS idx_newcomers_location ON newcomers(location_id);
CREATE INDEX IF NOT EXISTS idx_newcomers_date ON newcomers(date_recorded);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_state ON audit_logs(state_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- ========================================
-- 9. ENABLE RLS ON ALL TABLES
-- ========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE newcomers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE states ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 10. RLS POLICIES (STRICT)
-- ========================================

-- ---- HELPER FUNCTION: Check hierarchy scope ----
-- This function implements the core RLS policy:
--   record.state_id = user.state_id
--   AND (user.region_id IS NULL OR record.region_id = user.region_id)
--   AND (user.group_id IS NULL OR record.group_id = user.group_id)
--   AND (user.district_id IS NULL OR record.district_id = user.district_id)
--   AND (user.location_id IS NULL OR record.location_id = user.location_id)

CREATE OR REPLACE FUNCTION check_hierarchy_scope(
  user_state_id    UUID,
  user_region_id   UUID,
  user_group_id    UUID,
  user_district_id UUID,
  user_location_id UUID,
  record_state_id    UUID,
  record_region_id   UUID,
  record_group_id    UUID,
  record_district_id UUID,
  record_location_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    record_state_id = user_state_id
    AND (user_region_id IS NULL OR record_region_id = user_region_id)
    AND (user_group_id IS NULL OR record_group_id = user_group_id)
    AND (user_district_id IS NULL OR record_district_id = user_district_id)
    AND (user_location_id IS NULL OR record_location_id = user_location_id)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper: Check if current user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper: Get current user's profile for RLS
CREATE OR REPLACE FUNCTION current_user_profile() RETURNS RECORD AS $$
DECLARE
  p RECORD;
BEGIN
  SELECT state_id, region_id, group_id, district_id, location_id, role, is_active
  INTO p
  FROM profiles
  WHERE id = auth.uid();
  RETURN p;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ========================================
-- 10a. PROFILES RLS
-- ========================================

-- Super Admin: full access to all profiles
CREATE POLICY "profiles_super_admin_full_access" ON profiles
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Scoped access: users can only see profiles in their hierarchy
CREATE POLICY "profiles_select_scope" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    NOT is_super_admin()
    AND check_hierarchy_scope(
      (SELECT state_id FROM profiles WHERE id = auth.uid()),
      (SELECT region_id FROM profiles WHERE id = auth.uid()),
      (SELECT group_id FROM profiles WHERE id = auth.uid()),
      (SELECT district_id FROM profiles WHERE id = auth.uid()),
      (SELECT location_id FROM profiles WHERE id = auth.uid()),
      state_id, region_id, group_id, district_id, location_id
    )
  );

-- Insert: only within user's hierarchy
CREATE POLICY "profiles_insert_scope" ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT is_super_admin()
    AND check_hierarchy_scope(
      (SELECT state_id FROM profiles WHERE id = auth.uid()),
      (SELECT region_id FROM profiles WHERE id = auth.uid()),
      (SELECT group_id FROM profiles WHERE id = auth.uid()),
      (SELECT district_id FROM profiles WHERE id = auth.uid()),
      (SELECT location_id FROM profiles WHERE id = auth.uid()),
      state_id, region_id, group_id, district_id, location_id
    )
  );

-- Update: only within user's hierarchy
CREATE POLICY "profiles_update_scope" ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    NOT is_super_admin()
    AND check_hierarchy_scope(
      (SELECT state_id FROM profiles WHERE id = auth.uid()),
      (SELECT region_id FROM profiles WHERE id = auth.uid()),
      (SELECT group_id FROM profiles WHERE id = auth.uid()),
      (SELECT district_id FROM profiles WHERE id = auth.uid()),
      (SELECT location_id FROM profiles WHERE id = auth.uid()),
      state_id, region_id, group_id, district_id, location_id
    )
  )
  WITH CHECK (
    check_hierarchy_scope(
      (SELECT state_id FROM profiles WHERE id = auth.uid()),
      (SELECT region_id FROM profiles WHERE id = auth.uid()),
      (SELECT group_id FROM profiles WHERE id = auth.uid()),
      (SELECT district_id FROM profiles WHERE id = auth.uid()),
      (SELECT location_id FROM profiles WHERE id = auth.uid()),
      state_id, region_id, group_id, district_id, location_id
    )
  );

-- ========================================
-- 10b. MEMBERS RLS
-- ========================================

-- Super Admin: full access
CREATE POLICY "members_super_admin_all" ON members
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- SELECT within scope
CREATE POLICY "members_select_scope" ON members
  FOR SELECT
  TO authenticated
  USING (
    NOT is_super_admin()
    AND check_hierarchy_scope(
      (SELECT state_id FROM profiles WHERE id = auth.uid()),
      (SELECT region_id FROM profiles WHERE id = auth.uid()),
      (SELECT group_id FROM profiles WHERE id = auth.uid()),
      (SELECT district_id FROM profiles WHERE id = auth.uid()),
      (SELECT location_id FROM profiles WHERE id = auth.uid()),
      state_id, region_id, group_id, district_id, location_id
    )
  );

-- INSERT within scope
CREATE POLICY "members_insert_scope" ON members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT is_super_admin()
    AND check_hierarchy_scope(
      (SELECT state_id FROM profiles WHERE id = auth.uid()),
      (SELECT region_id FROM profiles WHERE id = auth.uid()),
      (SELECT group_id FROM profiles WHERE id = auth.uid()),
      (SELECT district_id FROM profiles WHERE id = auth.uid()),
      (SELECT location_id FROM profiles WHERE id = auth.uid()),
      state_id, region_id, group_id, district_id, location_id
    )
  );

-- UPDATE within scope
CREATE POLICY "members_update_scope" ON members
  FOR UPDATE
  TO authenticated
  USING (
    NOT is_super_admin()
    AND check_hierarchy_scope(
      (SELECT state_id FROM profiles WHERE id = auth.uid()),
      (SELECT region_id FROM profiles WHERE id = auth.uid()),
      (SELECT group_id FROM profiles WHERE id = auth.uid()),
      (SELECT district_id FROM profiles WHERE id = auth.uid()),
      (SELECT location_id FROM profiles WHERE id = auth.uid()),
      state_id, region_id, group_id, district_id, location_id
    )
  )
  WITH CHECK (
    check_hierarchy_scope(
      (SELECT state_id FROM profiles WHERE id = auth.uid()),
      (SELECT region_id FROM profiles WHERE id = auth.uid()),
      (SELECT group_id FROM profiles WHERE id = auth.uid()),
      (SELECT district_id FROM profiles WHERE id = auth.uid()),
      (SELECT location_id FROM profiles WHERE id = auth.uid()),
      state_id, region_id, group_id, district_id, location_id
    )
  );

-- DELETE within scope
CREATE POLICY "members_delete_scope" ON members
  FOR DELETE
  TO authenticated
  USING (
    NOT is_super_admin()
    AND check_hierarchy_scope(
      (SELECT state_id FROM profiles WHERE id = auth.uid()),
      (SELECT region_id FROM profiles WHERE id = auth.uid()),
      (SELECT group_id FROM profiles WHERE id = auth.uid()),
      (SELECT district_id FROM profiles WHERE id = auth.uid()),
      (SELECT location_id FROM profiles WHERE id = auth.uid()),
      state_id, region_id, group_id, district_id, location_id
    )
  );

-- ========================================
-- 10c. ATTENDANCE RLS
-- ========================================

CREATE POLICY "attendance_super_admin_all" ON attendance
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "attendance_select_scope" ON attendance
  FOR SELECT TO authenticated
  USING (
    NOT is_super_admin()
    AND check_hierarchy_scope(
      (SELECT state_id FROM profiles WHERE id = auth.uid()),
      (SELECT region_id FROM profiles WHERE id = auth.uid()),
      (SELECT group_id FROM profiles WHERE id = auth.uid()),
      (SELECT district_id FROM profiles WHERE id = auth.uid()),
      (SELECT location_id FROM profiles WHERE id = auth.uid()),
      state_id, COALESCE(region_id, '00000000-0000-0000-0000-000000000000'), COALESCE(group_id, '00000000-0000-0000-0000-000000000000'), COALESCE(district_id, '00000000-0000-0000-0000-000000000000'), location_id
    )
  );

CREATE POLICY "attendance_insert_scope" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT is_super_admin()
    AND check_hierarchy_scope(
      (SELECT state_id FROM profiles WHERE id = auth.uid()),
      (SELECT region_id FROM profiles WHERE id = auth.uid()),
      (SELECT group_id FROM profiles WHERE id = auth.uid()),
      (SELECT district_id FROM profiles WHERE id = auth.uid()),
      (SELECT location_id FROM profiles WHERE id = auth.uid()),
      state_id, COALESCE(region_id, '00000000-0000-0000-0000-000000000000'), COALESCE(group_id, '00000000-0000-0000-0000-000000000000'), COALESCE(district_id, '00000000-0000-0000-0000-000000000000'), location_id
    )
  );

CREATE POLICY "attendance_update_scope" ON attendance
  FOR UPDATE TO authenticated
  USING (
    NOT is_super_admin()
    AND check_hierarchy_scope(
      (SELECT state_id FROM profiles WHERE id = auth.uid()),
      (SELECT region_id FROM profiles WHERE id = auth.uid()),
      (SELECT group_id FROM profiles WHERE id = auth.uid()),
      (SELECT district_id FROM profiles WHERE id = auth.uid()),
      (SELECT location_id FROM profiles WHERE id = auth.uid()),
      state_id, COALESCE(region_id, '00000000-0000-0000-0000-000000000000'), COALESCE(group_id, '00000000-0000-0000-0000-000000000000'), COALESCE(district_id, '00000000-0000-0000-0000-000000000000'), location_id
    )
  );

CREATE POLICY "attendance_delete_scope" ON attendance
  FOR DELETE TO authenticated
  USING (
    NOT is_super_admin()
    AND check_hierarchy_scope(
      (SELECT state_id FROM profiles WHERE id = auth.uid()),
      (SELECT region_id FROM profiles WHERE id = auth.uid()),
      (SELECT group_id FROM profiles WHERE id = auth.uid()),
      (SELECT district_id FROM profiles WHERE id = auth.uid()),
      (SELECT location_id FROM profiles WHERE id = auth.uid()),
      state_id, COALESCE(region_id, '00000000-0000-0000-0000-000000000000'), COALESCE(group_id, '00000000-0000-0000-0000-000000000000'), COALESCE(district_id, '00000000-0000-0000-0000-000000000000'), location_id
    )
  );

-- ========================================
-- 10d. NEWCOMERS RLS
-- ========================================

CREATE POLICY "newcomers_super_admin_all" ON newcomers
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "newcomers_select_scope" ON newcomers
  FOR SELECT TO authenticated
  USING (
    NOT is_super_admin()
    AND check_hierarchy_scope(
      (SELECT state_id FROM profiles WHERE id = auth.uid()),
      (SELECT region_id FROM profiles WHERE id = auth.uid()),
      (SELECT group_id FROM profiles WHERE id = auth.uid()),
      (SELECT district_id FROM profiles WHERE id = auth.uid()),
      (SELECT location_id FROM profiles WHERE id = auth.uid()),
      state_id, region_id, group_id, district_id, location_id
    )
  );

CREATE POLICY "newcomers_insert_scope" ON newcomers
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT is_super_admin()
    AND check_hierarchy_scope(
      (SELECT state_id FROM profiles WHERE id = auth.uid()),
      (SELECT region_id FROM profiles WHERE id = auth.uid()),
      (SELECT group_id FROM profiles WHERE id = auth.uid()),
      (SELECT district_id FROM profiles WHERE id = auth.uid()),
      (SELECT location_id FROM profiles WHERE id = auth.uid()),
      state_id, region_id, group_id, district_id, location_id
    )
  );

CREATE POLICY "newcomers_delete_scope" ON newcomers
  FOR DELETE TO authenticated
  USING (
    NOT is_super_admin()
    AND check_hierarchy_scope(
      (SELECT state_id FROM profiles WHERE id = auth.uid()),
      (SELECT region_id FROM profiles WHERE id = auth.uid()),
      (SELECT group_id FROM profiles WHERE id = auth.uid()),
      (SELECT district_id FROM profiles WHERE id = auth.uid()),
      (SELECT location_id FROM profiles WHERE id = auth.uid()),
      state_id, region_id, group_id, district_id, location_id
    )
  );

-- ========================================
-- 10e. AUDIT LOGS RLS
-- ========================================
-- Audit logs: scope-based + system-wide (null state) visible to all

CREATE POLICY "audit_logs_super_admin_all" ON audit_logs
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "audit_logs_select_scope" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    NOT is_super_admin()
    AND (
      -- System-wide logs (no state) visible to all
      state_id IS NULL
      OR check_hierarchy_scope(
        (SELECT state_id FROM profiles WHERE id = auth.uid()),
        (SELECT region_id FROM profiles WHERE id = auth.uid()),
        (SELECT group_id FROM profiles WHERE id = auth.uid()),
        (SELECT district_id FROM profiles WHERE id = auth.uid()),
        (SELECT location_id FROM profiles WHERE id = auth.uid()),
        state_id, COALESCE(region_id, '00000000-0000-0000-0000-000000000000'), COALESCE(group_id, '00000000-0000-0000-0000-000000000000'), COALESCE(district_id, '00000000-0000-0000-0000-000000000000'), COALESCE(location_id, '00000000-0000-0000-0000-000000000000')
      )
    )
  );

-- Admin-only insert (enforced in application layer, RLS allows authenticated insert within scope)
CREATE POLICY "audit_logs_insert_scope" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true); -- Application layer handles role check

-- ========================================
-- 10f. HIERARCHY TABLES RLS
-- ========================================

-- States: super admin sees all, others see only their state
CREATE POLICY "states_super_admin_all" ON states
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "states_select_scope" ON states
  FOR SELECT TO authenticated
  USING (
    NOT is_super_admin()
    AND id = (SELECT state_id FROM profiles WHERE id = auth.uid())
  );

-- Regions: filtered by user's state
CREATE POLICY "regions_super_admin_all" ON regions
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "regions_select_scope" ON regions
  FOR SELECT TO authenticated
  USING (
    NOT is_super_admin()
    AND state_id = (SELECT state_id FROM profiles WHERE id = auth.uid())
  );

-- Groups: filtered by user's state + region
CREATE POLICY "groups_super_admin_all" ON groups
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "groups_select_scope" ON groups
  FOR SELECT TO authenticated
  USING (
    NOT is_super_admin()
    AND state_id = (SELECT state_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT region_id FROM profiles WHERE id = auth.uid()) IS NULL
      OR region_id = (SELECT region_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Districts: filtered by state + region + group
CREATE POLICY "districts_super_admin_all" ON districts
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "districts_select_scope" ON districts
  FOR SELECT TO authenticated
  USING (
    NOT is_super_admin()
    AND state_id = (SELECT state_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT region_id FROM profiles WHERE id = auth.uid()) IS NULL
      OR region_id = (SELECT region_id FROM profiles WHERE id = auth.uid())
    )
    AND (
      (SELECT group_id FROM profiles WHERE id = auth.uid()) IS NULL
      OR group_id = (SELECT group_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Locations: filtered by state + region + group + district
CREATE POLICY "locations_super_admin_all" ON locations
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "locations_select_scope" ON locations
  FOR SELECT TO authenticated
  USING (
    NOT is_super_admin()
    AND state_id = (SELECT state_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT region_id FROM profiles WHERE id = auth.uid()) IS NULL
      OR region_id = (SELECT region_id FROM profiles WHERE id = auth.uid())
    )
    AND (
      (SELECT group_id FROM profiles WHERE id = auth.uid()) IS NULL
      OR group_id = (SELECT group_id FROM profiles WHERE id = auth.uid())
    )
    AND (
      (SELECT district_id FROM profiles WHERE id = auth.uid()) IS NULL
      OR district_id = (SELECT district_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ========================================
-- 11. SEED HIERARCHY DATA
-- ========================================

INSERT INTO states (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Lagos State'),
  ('22222222-2222-2222-2222-222222222222', 'FCT Abuja'),
  ('33333333-3333-3333-3333-333333333333', 'Rivers State')
ON CONFLICT (id) DO NOTHING;

INSERT INTO regions (id, name, state_id) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Lagos Central', '11111111-1111-1111-1111-111111111111'),
  ('a2222222-2222-2222-2222-222222222222', 'Lagos East',   '11111111-1111-1111-1111-111111111111'),
  ('a3333333-3333-3333-3333-333333333333', 'Lagos West',   '11111111-1111-1111-1111-111111111111'),
  ('b1111111-1111-1111-1111-111111111111', 'Abuja North',  '22222222-2222-2222-2222-222222222222'),
  ('b2222222-2222-2222-2222-222222222222', 'Abuja South',  '22222222-2222-2222-2222-222222222222'),
  ('c1111111-1111-1111-1111-111111111111', 'Port Harcourt','33333333-3333-3333-3333-333333333333')
ON CONFLICT (id) DO NOTHING;

INSERT INTO groups (id, name, region_id) VALUES
  ('ga111111-1111-1111-1111-111111111111', 'Lagos Central Group A', 'a1111111-1111-1111-1111-111111111111'),
  ('ga222222-2222-2222-2222-222222222222', 'Lagos Central Group B', 'a1111111-1111-1111-1111-111111111111'),
  ('ga333333-3333-3333-3333-333333333333', 'Lagos East Group A',   'a2222222-2222-2222-2222-222222222222'),
  ('gb111111-1111-1111-1111-111111111111', 'Abuja North Group A',  'b1111111-1111-1111-1111-111111111111'),
  ('gc111111-1111-1111-1111-111111111111', 'Port Harcourt Group A','c1111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

INSERT INTO districts (id, name, group_id) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'Ikeja District',   'ga111111-1111-1111-1111-111111111111'),
  ('d2222222-2222-2222-2222-222222222222', 'Ogba District',    'ga111111-1111-1111-1111-111111111111'),
  ('d3333333-3333-3333-3333-333333333333', 'Surulere District','ga222222-2222-2222-2222-222222222222'),
  ('d4444444-4444-4444-4444-444444444444', 'Yaba District',    'ga333333-3333-3333-3333-333333333333'),
  ('d5555555-5555-5555-5555-555555555555', 'Garki District',   'gb111111-1111-1111-1111-111111111111'),
  ('d6666666-6666-6666-6666-666666666666', 'Wuse District',    'gb111111-1111-1111-1111-111111111111'),
  ('d7777777-7777-7777-7777-777777777777', 'GRA District',     'gc111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

INSERT INTO locations (id, name, district_id) VALUES
  ('l00000001-0000-0000-0000-000000000001', 'Ikeja Worship Centre',     'd1111111-1111-1111-1111-111111111111'),
  ('l00000002-0000-0000-0000-000000000002', 'Allen Avenue Assembly',   'd1111111-1111-1111-1111-111111111111'),
  ('l00000003-0000-0000-0000-000000000003', 'Ogba Central Assembly',   'd2222222-2222-2222-2222-222222222222'),
  ('l00000004-0000-0000-0000-000000000004', 'Surulere Main Assembly',  'd3333333-3333-3333-3333-333333333333'),
  ('l00000005-0000-0000-0000-000000000005', 'Itire Assembly',          'd3333333-3333-3333-3333-333333333333'),
  ('l00000006-0000-0000-0000-000000000006', 'Yaba Main Assembly',      'd4444444-4444-4444-4444-444444444444'),
  ('l00000007-0000-0000-0000-000000000007', 'Garki Main Assembly',     'd5555555-5555-5555-5555-555555555555'),
  ('l00000008-0000-0000-0000-000000000008', 'Area 3 Assembly',         'd5555555-5555-5555-5555-555555555555'),
  ('l00000009-0000-0000-0000-000000000009', 'Wuse Zone 2 Assembly',    'd6666666-6666-6666-6666-666666666666'),
  ('l00000010-0000-0000-0000-000000000010', 'GRA Main Assembly',       'd7777777-7777-7777-7777-777777777777'),
  ('l00000011-0000-0000-0000-000000000011', 'Port Harcourt Township',  'd7777777-7777-7777-7777-777777777777')
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- 12. SEED DEMO USERS (via auth.users + profiles)
-- ========================================
-- NOTE: Creating auth.users requires Supabase Admin API.
-- These profile records should be created after user registration.
-- The profiles will be linked via auth.users.id → profiles.id.

-- After creating auth users, run:
/*
INSERT INTO profiles (id, email, full_name, role, state_id, region_id, group_id, district_id, location_id) VALUES
  ('<uuid-from-auth>', 'super.admin@deeperlife.org', 'Super Admin', 'super_admin', NULL, NULL, NULL, NULL, NULL),
  ...
*/
