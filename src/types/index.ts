// YourClub — All TypeScript Types

export interface Club {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  primary_colour: string;
  address?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  phone?: string;
  email?: string;
  website?: string;
  abn?: string;
  gst_registered: boolean;
  financial_year_start: string;
  membership_renewal_month: number;
  ga_connect_api_key?: string;
  ga_connect_club_id?: string;
  stripe_secret_key?: string;
  stripe_publishable_key?: string;
  welcome_message?: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  club_id?: string;
  member_id?: string;
  role: 'super_admin' | 'admin' | 'comp_admin' | 'member';
  first_name?: string;
  last_name?: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  name: string;
  address?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  website?: string;
  holes: number;
  tees?: CourseTee[];
  created_at: string;
  updated_at: string;
}

export interface CourseTee {
  id: string;
  course_id: string;
  tee_name: string;
  gender: 'M' | 'F' | 'O';
  par: number;
  course_rating?: number;
  slope_rating?: number;
  holes: number;
  course_holes?: CourseHole[];
}

export interface CourseHole {
  id: string;
  course_tee_id: string;
  hole_number: number;
  par: number;
  stroke_index?: number;
  distance_metres?: number;
}

export interface MembershipType {
  id: string;
  club_id: string;
  name: string;
  description?: string;
  annual_fee: number;
  monthly_fee?: number;
  handicap_eligible: boolean;
  tee_sheet_access: boolean;
  comp_eligible: boolean;
  min_age?: number;
  max_age?: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type MemberStatus = 'active' | 'suspended' | 'resigned' | 'pending' | 'deceased';

export interface Member {
  id: string;
  club_id: string;
  auth_user_id?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: 'M' | 'F' | 'O';
  golf_id?: string;
  membership_type_id?: string;
  status: MemberStatus;
  join_date?: string;
  active_from?: string;
  active_until?: string;
  renewal_date?: string;
  expiry_date?: string;
  billing_cycle: 'annual' | 'monthly';
  handicap?: number;
  handicap_updated_at?: string;
  address?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
  portal_invited_at?: string;
  created_at: string;
  updated_at: string;
  membership_type?: MembershipType;
  account?: MemberAccount;
}

export interface MemberAccount {
  id: string;
  member_id: string;
  club_id: string;
  credit_balance: number;
  prize_balance: number;
  updated_at: string;
}

export type TransactionBalanceType = 'credit' | 'prize';
export type TransactionType = 'debit' | 'credit';
export type TransactionCategory = 'top_up' | 'booking' | 'event_entry' | 'refund' | 'prize_award' | 'shop_purchase' | 'manual';

export interface MemberAccountTransaction {
  id: string;
  member_id: string;
  club_id: string;
  balance_type: TransactionBalanceType;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  description?: string;
  reference_id?: string;
  created_by?: string;
  created_at: string;
}

export interface PrizeTemplate {
  id: string;
  club_id: string;
  name: string;
  format?: string;
  player_count_min: number;
  player_count_max: number;
  divisions_enabled: boolean;
  prizes: PrizeItem[];
  created_at: string;
  updated_at: string;
}

export interface PrizeItem {
  position: number;
  division?: string | null;
  amount: number;
  description: string;
}

export interface TeeSheetConfig {
  id: string;
  club_id: string;
  name: string;
  course_id?: string;
  course_tee_id?: string;
  tee_sheet_type: 'general' | 'competition';
  open_time: string;
  close_time: string;
  slot_interval_minutes: number;
  max_players_per_slot: number;
  booking_cost_credits: number;
  advance_booking_days: number;
  same_day_cutoff_minutes: number;
  guests_per_booking: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  course?: Course;
}

export type SlotStatus = 'open' | 'blocked' | 'competition';

export interface TeeTimeSlot {
  id: string;
  club_id: string;
  tee_sheet_config_id?: string;
  date: string;
  time: string;
  status: SlotStatus;
  block_reason?: string;
  competition_id?: string;
  bookings?: Booking[];
}

export interface Booking {
  id: string;
  club_id: string;
  slot_id: string;
  booked_by_member_id: string;
  credits_deducted: number;
  created_at: string;
  cancelled_at?: string;
  cancelled_by?: string;
  players?: BookingPlayer[];
  slot?: TeeTimeSlot;
  booked_by?: Member;
}

export interface BookingPlayer {
  id: string;
  booking_id: string;
  member_id?: string;
  guest_name?: string;
  position: number;
  member?: Member;
}

export type CompetitionFormat = 'stableford' | 'stroke' | 'par' | '4bbb' | 'ambrose';
export type CompetitionStatus = 'draft' | 'entries_open' | 'in_progress' | 'results_pending' | 'finalised';

export interface DivisionConfig {
  name: string;
  handicap_min: number;
  handicap_max: number;
}

export interface Competition {
  id: string;
  club_id: string;
  name: string;
  date: string;
  format: CompetitionFormat;
  course_id?: string;
  course_tee_id?: string;
  handicap_allowance_pct: number;
  divisions_enabled: boolean;
  division_config: DivisionConfig[];
  status: CompetitionStatus;
  notes?: string;
  tee_sheet_linked: boolean;
  tee_sheet_config_id?: string;
  ntp_holes?: number[];
  ld_holes?: number[];
  prize_template_id?: string;
  results_published_at?: string;
  ga_submitted_at?: string;
  created_at: string;
  updated_at: string;
  course?: Course;
  course_tee?: CourseTee;
  entries?: CompetitionEntry[];
  entry_count?: number;
}

export type EntryStatus = 'entered' | 'withdrawn' | 'dns' | 'dnf';

export interface CompetitionEntry {
  id: string;
  competition_id: string;
  club_id: string;
  member_id: string;
  playing_handicap?: number;
  handicap_index_at_entry?: number;
  division?: string;
  starting_time?: string;
  starting_hole?: number;
  group_number?: number;
  status: EntryStatus;
  scorecard_token: string;
  created_at: string;
  updated_at: string;
  member?: Member;
  scorecard?: Scorecard;
}

export interface HoleScore {
  hole: number;
  par: number;
  stroke_index: number;
  gross: number | null;
  net?: number;
  points?: number;
  ntp?: boolean;
  ld?: boolean;
}

export interface Scorecard {
  id: string;
  entry_id: string;
  club_id: string;
  submitted_by?: string;
  submitted_at?: string;
  verified: boolean;
  verified_by?: string;
  hole_scores: HoleScore[];
  total_gross?: number;
  total_net?: number;
  total_points?: number;
  ntp_holes?: number[];
  ld_holes?: number[];
  result_notes?: string;
  ga_submission_id?: string;
  ga_submitted_at?: string;
  ga_status: 'pending' | 'submitted' | 'accepted' | 'rejected';
  ga_error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface CompetitionResult {
  id: string;
  competition_id: string;
  entry_id: string;
  club_id: string;
  division?: string;
  gross_position?: number;
  net_position?: number;
  points_position?: number;
  prize_description?: string;
  prize_amount: number;
  prize_paid: boolean;
  created_at: string;
  entry?: CompetitionEntry;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';

export interface Invoice {
  id: string;
  club_id: string;
  member_id: string;
  membership_type_id?: string;
  billing_cycle: 'annual' | 'monthly';
  period_start?: string;
  period_end?: string;
  amount: number;
  gst_amount: number;
  status: InvoiceStatus;
  due_date?: string;
  paid_at?: string;
  payment_method?: string;
  payment_reference?: string;
  stripe_payment_intent_id?: string;
  stripe_invoice_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  member?: Member;
  membership_type?: MembershipType;
}

export type PostType = 'general' | 'results' | 'alert' | 'news';

export interface NoticeboardPost {
  id: string;
  club_id: string;
  title: string;
  body?: string;
  post_type: PostType;
  pinned: boolean;
  comments_enabled: boolean;
  published_at: string;
  expires_at?: string;
  created_by?: string;
  competition_id?: string;
  created_at: string;
  updated_at: string;
  comments?: NoticeboardComment[];
  comment_count?: number;
}

export interface NoticeboardComment {
  id: string;
  post_id: string;
  club_id: string;
  member_id: string;
  body: string;
  deleted_at?: string;
  created_at: string;
  member?: Member;
}

export interface EmailLog {
  id: string;
  club_id: string;
  recipient_member_id?: string;
  recipient_email: string;
  email_type?: string;
  subject?: string;
  sent_at: string;
  resend_id?: string;
  status: 'sent' | 'delivered' | 'bounced' | 'failed';
}

// Dashboard stats
export interface DashboardStats {
  total_members: number;
  active_members: number;
  expiring_members: number;
  comps_this_week: number;
  outstanding_invoices: number;
  outstanding_amount: number;
}
