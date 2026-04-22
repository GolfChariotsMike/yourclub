-- YourClub Initial Schema
-- All tables, RLS policies, indexes, and triggers

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- UTILITY: updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MODULE 9: CLUBS (core, everything references this)
-- ============================================================
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_colour TEXT DEFAULT '#16a34a',
  address TEXT,
  suburb TEXT,
  state TEXT,
  postcode TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  abn TEXT,
  gst_registered BOOLEAN DEFAULT FALSE,
  financial_year_start TEXT DEFAULT '07-01',
  membership_renewal_month INT DEFAULT 7,
  ga_connect_api_key TEXT,
  ga_connect_club_id TEXT,
  stripe_secret_key TEXT,
  stripe_publishable_key TEXT,
  welcome_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_clubs_updated_at
  BEFORE UPDATE ON clubs
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- PROFILES (Supabase auth users linked to club members)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  member_id UUID,  -- will be set after members table created
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('super_admin', 'admin', 'comp_admin', 'member')),
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- MODULE 9: COURSES (shared system-wide library)
-- ============================================================
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  suburb TEXT,
  state TEXT,
  postcode TEXT,
  website TEXT,
  holes INT NOT NULL DEFAULT 18,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TABLE course_tees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tee_name TEXT NOT NULL,       -- e.g. "Yellow", "White", "Red"
  gender TEXT NOT NULL DEFAULT 'M' CHECK (gender IN ('M', 'F', 'O')),
  par INT NOT NULL DEFAULT 72,
  course_rating NUMERIC(5,1),
  slope_rating INT,
  holes INT NOT NULL DEFAULT 18,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE course_holes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_tee_id UUID NOT NULL REFERENCES course_tees(id) ON DELETE CASCADE,
  hole_number INT NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  par INT NOT NULL DEFAULT 4 CHECK (par BETWEEN 3 AND 6),
  stroke_index INT CHECK (stroke_index BETWEEN 1 AND 18),
  distance_metres INT,
  UNIQUE(course_tee_id, hole_number)
);

CREATE INDEX idx_course_tees_course_id ON course_tees(course_id);
CREATE INDEX idx_course_holes_course_tee_id ON course_holes(course_tee_id);

-- ============================================================
-- MODULE 1: MEMBERSHIP TYPES
-- ============================================================
CREATE TABLE membership_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  annual_fee NUMERIC(10,2) DEFAULT 0,
  monthly_fee NUMERIC(10,2),
  handicap_eligible BOOLEAN DEFAULT TRUE,
  tee_sheet_access BOOLEAN DEFAULT TRUE,
  comp_eligible BOOLEAN DEFAULT TRUE,
  min_age INT,
  max_age INT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_membership_types_updated_at
  BEFORE UPDATE ON membership_types
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX idx_membership_types_club_id ON membership_types(club_id);

-- ============================================================
-- MODULE 1: MEMBERS
-- ============================================================
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('M', 'F', 'O')),
  golf_id TEXT,
  membership_type_id UUID REFERENCES membership_types(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'resigned', 'pending', 'deceased')),
  join_date DATE DEFAULT CURRENT_DATE,
  active_from DATE,
  active_until DATE,
  renewal_date DATE,
  expiry_date DATE,
  billing_cycle TEXT DEFAULT 'annual' CHECK (billing_cycle IN ('annual', 'monthly')),
  handicap NUMERIC(5,1),
  handicap_updated_at TIMESTAMPTZ,
  address TEXT,
  suburb TEXT,
  state TEXT,
  postcode TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  portal_invited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX idx_members_club_id ON members(club_id);
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_golf_id ON members(golf_id);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_renewal_date ON members(renewal_date);

-- Add FK from profiles to members
ALTER TABLE profiles ADD CONSTRAINT fk_profiles_member_id
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL;

-- ============================================================
-- MODULE 1: MEMBER ACCOUNTS (wallets)
-- ============================================================
CREATE TABLE member_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  credit_balance NUMERIC(10,2) DEFAULT 0,
  prize_balance NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, club_id)
);

CREATE TRIGGER set_member_accounts_updated_at
  BEFORE UPDATE ON member_accounts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX idx_member_accounts_member_id ON member_accounts(member_id);

CREATE TABLE member_account_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  balance_type TEXT NOT NULL CHECK (balance_type IN ('credit', 'prize')),
  type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
  category TEXT NOT NULL CHECK (category IN ('top_up', 'booking', 'event_entry', 'refund', 'prize_award', 'shop_purchase', 'manual')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  reference_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_member_id ON member_account_transactions(member_id);
CREATE INDEX idx_transactions_club_id ON member_account_transactions(club_id);
CREATE INDEX idx_transactions_created_at ON member_account_transactions(created_at DESC);

-- ============================================================
-- MODULE 1: PRIZE TEMPLATES
-- ============================================================
CREATE TABLE prize_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  format TEXT CHECK (format IN ('stableford', 'stroke', 'par', '4bbb', 'ambrose')),
  player_count_min INT DEFAULT 1,
  player_count_max INT DEFAULT 9999,
  divisions_enabled BOOLEAN DEFAULT FALSE,
  prizes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_prize_templates_updated_at
  BEFORE UPDATE ON prize_templates
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX idx_prize_templates_club_id ON prize_templates(club_id);

-- ============================================================
-- MODULE 3: TEE SHEET
-- ============================================================
CREATE TABLE tee_sheet_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  course_tee_id UUID REFERENCES course_tees(id) ON DELETE SET NULL,
  tee_sheet_type TEXT DEFAULT 'general' CHECK (tee_sheet_type IN ('general', 'competition')),
  open_time TIME DEFAULT '06:30',
  close_time TIME DEFAULT '18:00',
  slot_interval_minutes INT DEFAULT 10,
  max_players_per_slot INT DEFAULT 4,
  booking_cost_credits NUMERIC(10,2) DEFAULT 0,
  advance_booking_days INT DEFAULT 7,
  same_day_cutoff_minutes INT DEFAULT 30,
  guests_per_booking INT DEFAULT 2,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_tee_sheet_configs_updated_at
  BEFORE UPDATE ON tee_sheet_configs
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX idx_tee_sheet_configs_club_id ON tee_sheet_configs(club_id);

CREATE TABLE tee_time_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  tee_sheet_config_id UUID REFERENCES tee_sheet_configs(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'blocked', 'competition')),
  block_reason TEXT,
  competition_id UUID,  -- FK added after competitions table
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tee_sheet_config_id, date, time)
);

CREATE INDEX idx_tee_time_slots_club_date ON tee_time_slots(club_id, date);
CREATE INDEX idx_tee_time_slots_config_date ON tee_time_slots(tee_sheet_config_id, date);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES tee_time_slots(id) ON DELETE CASCADE,
  booked_by_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  credits_deducted NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES members(id) ON DELETE SET NULL
);

CREATE INDEX idx_bookings_club_id ON bookings(club_id);
CREATE INDEX idx_bookings_slot_id ON bookings(slot_id);
CREATE INDEX idx_bookings_member_id ON bookings(booked_by_member_id);

CREATE TABLE booking_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  guest_name TEXT,
  position INT NOT NULL DEFAULT 1 CHECK (position BETWEEN 1 AND 8),
  CONSTRAINT check_member_or_guest CHECK (member_id IS NOT NULL OR guest_name IS NOT NULL)
);

CREATE INDEX idx_booking_players_booking_id ON booking_players(booking_id);
CREATE INDEX idx_booking_players_member_id ON booking_players(member_id);

-- ============================================================
-- MODULE 4: COMPETITIONS
-- ============================================================
CREATE TABLE competitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('stableford', 'stroke', 'par', '4bbb', 'ambrose')),
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  course_tee_id UUID REFERENCES course_tees(id) ON DELETE SET NULL,
  handicap_allowance_pct NUMERIC(5,2) DEFAULT 100,
  divisions_enabled BOOLEAN DEFAULT FALSE,
  division_config JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'entries_open', 'in_progress', 'results_pending', 'finalised')),
  notes TEXT,
  tee_sheet_linked BOOLEAN DEFAULT FALSE,
  tee_sheet_config_id UUID REFERENCES tee_sheet_configs(id) ON DELETE SET NULL,
  ntp_holes INT[],
  ld_holes INT[],
  prize_template_id UUID REFERENCES prize_templates(id) ON DELETE SET NULL,
  results_published_at TIMESTAMPTZ,
  ga_submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_competitions_updated_at
  BEFORE UPDATE ON competitions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX idx_competitions_club_id ON competitions(club_id);
CREATE INDEX idx_competitions_date ON competitions(date);
CREATE INDEX idx_competitions_status ON competitions(status);

-- Add FK from tee_time_slots to competitions
ALTER TABLE tee_time_slots ADD CONSTRAINT fk_slots_competition
  FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE SET NULL;

CREATE TABLE competition_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  playing_handicap NUMERIC(5,1),
  handicap_index_at_entry NUMERIC(5,1),
  division TEXT,
  starting_time TIME,
  starting_hole INT DEFAULT 1,
  group_number INT,
  status TEXT DEFAULT 'entered' CHECK (status IN ('entered', 'withdrawn', 'dns', 'dnf')),
  scorecard_token TEXT DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(competition_id, member_id)
);

CREATE TRIGGER set_competition_entries_updated_at
  BEFORE UPDATE ON competition_entries
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX idx_competition_entries_comp_id ON competition_entries(competition_id);
CREATE INDEX idx_competition_entries_member_id ON competition_entries(member_id);
CREATE INDEX idx_competition_entries_token ON competition_entries(scorecard_token);

CREATE TABLE scorecards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL REFERENCES competition_entries(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES members(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES members(id) ON DELETE SET NULL,
  hole_scores JSONB DEFAULT '[]',
  total_gross INT,
  total_net INT,
  total_points INT,
  ntp_holes INT[],
  ld_holes INT[],
  result_notes TEXT,
  ga_submission_id TEXT,
  ga_submitted_at TIMESTAMPTZ,
  ga_status TEXT DEFAULT 'pending' CHECK (ga_status IN ('pending', 'submitted', 'accepted', 'rejected')),
  ga_error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_scorecards_updated_at
  BEFORE UPDATE ON scorecards
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX idx_scorecards_entry_id ON scorecards(entry_id);
CREATE INDEX idx_scorecards_club_id ON scorecards(club_id);

CREATE TABLE competition_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES competition_entries(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  division TEXT,
  gross_position INT,
  net_position INT,
  points_position INT,
  prize_description TEXT,
  prize_amount NUMERIC(10,2) DEFAULT 0,
  prize_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(competition_id, entry_id)
);

CREATE INDEX idx_competition_results_comp_id ON competition_results(competition_id);
CREATE INDEX idx_competition_results_entry_id ON competition_results(entry_id);

-- ============================================================
-- MODULE 7: INVOICES
-- ============================================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  membership_type_id UUID REFERENCES membership_types(id) ON DELETE SET NULL,
  billing_cycle TEXT DEFAULT 'annual' CHECK (billing_cycle IN ('annual', 'monthly')),
  period_start DATE,
  period_end DATE,
  amount NUMERIC(10,2) NOT NULL,
  gst_amount NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  payment_reference TEXT,
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX idx_invoices_club_id ON invoices(club_id);
CREATE INDEX idx_invoices_member_id ON invoices(member_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- ============================================================
-- MODULE 8: COMMUNICATIONS
-- ============================================================
CREATE TABLE noticeboard_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  post_type TEXT DEFAULT 'general' CHECK (post_type IN ('general', 'results', 'alert', 'news')),
  pinned BOOLEAN DEFAULT FALSE,
  comments_enabled BOOLEAN DEFAULT TRUE,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  competition_id UUID REFERENCES competitions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_noticeboard_posts_updated_at
  BEFORE UPDATE ON noticeboard_posts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX idx_noticeboard_posts_club_id ON noticeboard_posts(club_id);
CREATE INDEX idx_noticeboard_posts_published_at ON noticeboard_posts(club_id, published_at DESC);

CREATE TABLE noticeboard_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES noticeboard_posts(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_noticeboard_comments_post_id ON noticeboard_comments(post_id);

CREATE TABLE email_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  recipient_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  email_type TEXT,
  subject TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  resend_id TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'bounced', 'failed'))
);

CREATE INDEX idx_email_log_club_id ON email_log(club_id);
CREATE INDEX idx_email_log_member_id ON email_log(recipient_member_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prize_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_tees ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_holes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tee_sheet_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tee_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE noticeboard_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE noticeboard_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tee_sheet_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prize_templates ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's club_id
CREATE OR REPLACE FUNCTION get_my_club_id()
RETURNS UUID AS $$
  SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_club_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin', 'comp_admin')
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Helper function to get current user's member_id
CREATE OR REPLACE FUNCTION get_my_member_id()
RETURNS UUID AS $$
  SELECT member_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- CLUBS: admins can read/update their own club
CREATE POLICY "club_members_can_view_own_club" ON clubs
  FOR SELECT USING (id = get_my_club_id());

CREATE POLICY "admins_can_update_club" ON clubs
  FOR UPDATE USING (id = get_my_club_id() AND is_club_admin());

-- PROFILES: users can view/update their own profile
CREATE POLICY "users_can_view_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid() OR (club_id = get_my_club_id() AND is_club_admin()));

CREATE POLICY "users_can_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "admins_can_insert_profiles" ON profiles
  FOR INSERT WITH CHECK (is_club_admin() OR id = auth.uid());

-- MEMBERSHIP TYPES: all club members can view, admins can modify
CREATE POLICY "club_members_view_membership_types" ON membership_types
  FOR SELECT USING (club_id = get_my_club_id());

CREATE POLICY "admins_manage_membership_types" ON membership_types
  FOR ALL USING (club_id = get_my_club_id() AND is_club_admin());

-- MEMBERS: admins can manage all, members can view own record
CREATE POLICY "admins_manage_members" ON members
  FOR ALL USING (club_id = get_my_club_id() AND is_club_admin());

CREATE POLICY "members_view_own_record" ON members
  FOR SELECT USING (id = get_my_member_id());

-- MEMBER ACCOUNTS: admins manage all, members view own
CREATE POLICY "admins_manage_accounts" ON member_accounts
  FOR ALL USING (club_id = get_my_club_id() AND is_club_admin());

CREATE POLICY "members_view_own_account" ON member_accounts
  FOR SELECT USING (member_id = get_my_member_id());

-- TRANSACTIONS: admins manage all, members view own
CREATE POLICY "admins_manage_transactions" ON member_account_transactions
  FOR ALL USING (club_id = get_my_club_id() AND is_club_admin());

CREATE POLICY "members_view_own_transactions" ON member_account_transactions
  FOR SELECT USING (member_id = get_my_member_id());

-- COURSES: all authenticated users can view (shared library)
CREATE POLICY "all_users_view_courses" ON courses
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "all_users_view_course_tees" ON course_tees
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "all_users_view_course_holes" ON course_holes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admins can add courses to shared library
CREATE POLICY "admins_insert_courses" ON courses
  FOR INSERT WITH CHECK (is_club_admin());

CREATE POLICY "admins_insert_course_tees" ON course_tees
  FOR INSERT WITH CHECK (is_club_admin());

CREATE POLICY "admins_insert_course_holes" ON course_holes
  FOR INSERT WITH CHECK (is_club_admin());

-- TEE SHEET CONFIGS
CREATE POLICY "club_members_view_tee_sheet_configs" ON tee_sheet_configs
  FOR SELECT USING (club_id = get_my_club_id());

CREATE POLICY "admins_manage_tee_sheet_configs" ON tee_sheet_configs
  FOR ALL USING (club_id = get_my_club_id() AND is_club_admin());

-- TEE TIME SLOTS
CREATE POLICY "club_members_view_slots" ON tee_time_slots
  FOR SELECT USING (club_id = get_my_club_id());

CREATE POLICY "admins_manage_slots" ON tee_time_slots
  FOR ALL USING (club_id = get_my_club_id() AND is_club_admin());

-- BOOKINGS: admins manage all, members view own
CREATE POLICY "admins_manage_bookings" ON bookings
  FOR ALL USING (club_id = get_my_club_id() AND is_club_admin());

CREATE POLICY "members_view_own_bookings" ON bookings
  FOR SELECT USING (booked_by_member_id = get_my_member_id());

CREATE POLICY "members_create_bookings" ON bookings
  FOR INSERT WITH CHECK (
    club_id = get_my_club_id()
    AND booked_by_member_id = get_my_member_id()
  );

CREATE POLICY "members_cancel_own_bookings" ON bookings
  FOR UPDATE USING (
    club_id = get_my_club_id()
    AND booked_by_member_id = get_my_member_id()
  );

-- BOOKING PLAYERS: accessible via booking
CREATE POLICY "club_members_view_booking_players" ON booking_players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
      AND b.club_id = get_my_club_id()
    )
  );

CREATE POLICY "admins_manage_booking_players" ON booking_players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
      AND b.club_id = get_my_club_id()
      AND is_club_admin()
    )
  );

CREATE POLICY "members_manage_own_booking_players" ON booking_players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
      AND b.booked_by_member_id = get_my_member_id()
    )
  );

-- COMPETITIONS: members view, admins manage
CREATE POLICY "club_members_view_competitions" ON competitions
  FOR SELECT USING (club_id = get_my_club_id());

CREATE POLICY "admins_manage_competitions" ON competitions
  FOR ALL USING (club_id = get_my_club_id() AND is_club_admin());

-- COMPETITION ENTRIES
CREATE POLICY "club_members_view_entries" ON competition_entries
  FOR SELECT USING (club_id = get_my_club_id());

CREATE POLICY "admins_manage_entries" ON competition_entries
  FOR ALL USING (club_id = get_my_club_id() AND is_club_admin());

-- SCORECARDS: public access for guest scoring via token (handled in app layer), club members view
CREATE POLICY "club_members_view_scorecards" ON scorecards
  FOR SELECT USING (club_id = get_my_club_id());

CREATE POLICY "admins_manage_scorecards" ON scorecards
  FOR ALL USING (club_id = get_my_club_id() AND is_club_admin());

CREATE POLICY "anon_view_scorecards" ON scorecards
  FOR SELECT USING (TRUE); -- guests can read via token in app layer

-- COMPETITION RESULTS
CREATE POLICY "club_members_view_results" ON competition_results
  FOR SELECT USING (club_id = get_my_club_id());

CREATE POLICY "admins_manage_results" ON competition_results
  FOR ALL USING (club_id = get_my_club_id() AND is_club_admin());

-- INVOICES: admins manage, members view own
CREATE POLICY "admins_manage_invoices" ON invoices
  FOR ALL USING (club_id = get_my_club_id() AND is_club_admin());

CREATE POLICY "members_view_own_invoices" ON invoices
  FOR SELECT USING (member_id = get_my_member_id());

-- NOTICEBOARD POSTS: club members view, admins manage
CREATE POLICY "club_members_view_posts" ON noticeboard_posts
  FOR SELECT USING (club_id = get_my_club_id());

CREATE POLICY "admins_manage_posts" ON noticeboard_posts
  FOR ALL USING (club_id = get_my_club_id() AND is_club_admin());

-- NOTICEBOARD COMMENTS: club members view + insert own, admins delete
CREATE POLICY "club_members_view_comments" ON noticeboard_comments
  FOR SELECT USING (club_id = get_my_club_id());

CREATE POLICY "members_insert_comments" ON noticeboard_comments
  FOR INSERT WITH CHECK (
    club_id = get_my_club_id()
    AND member_id = get_my_member_id()
  );

CREATE POLICY "admins_delete_comments" ON noticeboard_comments
  FOR DELETE USING (club_id = get_my_club_id() AND is_club_admin());

CREATE POLICY "members_delete_own_comments" ON noticeboard_comments
  FOR DELETE USING (member_id = get_my_member_id());

-- EMAIL LOG
CREATE POLICY "admins_view_email_log" ON email_log
  FOR SELECT USING (club_id = get_my_club_id() AND is_club_admin());

CREATE POLICY "system_insert_email_log" ON email_log
  FOR INSERT WITH CHECK (club_id = get_my_club_id());

-- PRIZE TEMPLATES
CREATE POLICY "club_members_view_prize_templates" ON prize_templates
  FOR SELECT USING (club_id = get_my_club_id());

CREATE POLICY "admins_manage_prize_templates" ON prize_templates
  FOR ALL USING (club_id = get_my_club_id() AND is_club_admin());

-- ============================================================
-- FUNCTION: auto-create member_account on member insert
-- ============================================================
CREATE OR REPLACE FUNCTION create_member_account()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO member_accounts (member_id, club_id, credit_balance, prize_balance)
  VALUES (NEW.id, NEW.club_id, 0, 0)
  ON CONFLICT (member_id, club_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_member_insert_create_account
  AFTER INSERT ON members
  FOR EACH ROW EXECUTE FUNCTION create_member_account();

-- ============================================================
-- FUNCTION: auto-create profile on auth user creation
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- SEED: Sample courses (shared library)
-- ============================================================
INSERT INTO courses (id, name, suburb, state, holes) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Royal Perth Golf Club', 'Perth', 'WA', 18),
  ('00000000-0000-0000-0000-000000000002', 'Joondalup Resort Country Club', 'Connolly', 'WA', 18),
  ('00000000-0000-0000-0000-000000000003', 'The Vines Resort & Country Club', 'The Vines', 'WA', 18),
  ('00000000-0000-0000-0000-000000000004', 'Lake Karrinyup Country Club', 'Karrinyup', 'WA', 18),
  ('00000000-0000-0000-0000-000000000005', 'Wembley Golf Course', 'Wembley', 'WA', 18);
