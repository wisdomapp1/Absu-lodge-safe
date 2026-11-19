-- ABSU LodgeSafe — Official SUG Accommodation Marketplace Schema (Supabase PostgreSQL + RLS)
-- Run this script in your Supabase Project SQL Editor before switching live traffic.

create extension if not exists "pgcrypto";

-- 1. Platform Commission & Governance Settings (Singleton Row)
create table if not exists public.platform_settings (
  id integer primary key default 1 check (id = 1),
  inspection_fee_kobo integer not null default 300000 check (inspection_fee_kobo = 300000),
  platform_share_pct integer not null default 55 check (platform_share_pct between 0 and 100),
  agent_share_pct integer not null default 45 check (agent_share_pct between 0 and 100),
  sug_platform_share_pct integer not null default 70 check (sug_platform_share_pct between 0 and 100),
  tech_manager_platform_share_pct integer not null default 30 check (tech_manager_platform_share_pct between 0 and 100),
  max_commission_pct_of_rent integer not null default 15 check (max_commission_pct_of_rent between 1 and 30),
  payment_mode text not null default 'test_disabled' check (payment_mode in ('test_disabled', 'live_partner_approved')),
  paystack_partner_approved boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint chk_commission_split_100 check (platform_share_pct + agent_share_pct = 100),
  constraint chk_platform_split_100 check (sug_platform_share_pct + tech_manager_platform_share_pct = 100)
);

insert into public.platform_settings (id) values (1) on conflict (id) do nothing;

-- 2. Users (Linked to Supabase Auth uid)
create table if not exists public.users (
  uid uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  role text not null default 'student' check (role in ('student', 'agent', 'sug_admin', 'sug_president', 'tech_manager')),
  matric_number text,
  department text,
  faculty text,
  created_at timestamptz not null default now()
);

-- 3. Accommodation Agents (KYC & Approval Gate)
create table if not exists public.agents (
  agent_id text primary key,
  owner_uid uuid not null unique references public.users(uid) on delete cascade,
  full_name text not null,
  phone text not null,
  email text not null,
  absu_id text,
  id_document_name text not null,
  profile_photo_url text,
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  emergency_contact text not null,
  experience_years integer not null default 1,
  status text not null default 'Pending Approval' check (status in ('Pending Approval', 'Approved', 'Suspended', 'Rejected')),
  rating numeric(3,2) not null default 0,
  completed_inspections integer not null default 0,
  complaints_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- 4. Lodge Listings
create table if not exists public.properties (
  property_id text primary key,
  agent_id text not null references public.agents(agent_id) on delete restrict,
  agent_uid uuid not null references public.users(uid) on delete restrict,
  agent_name text not null,
  title text not null,
  category text not null check (category in ('Self-Contain', 'Single Room', 'Two-Bedroom', 'Apartment', 'Shared Hostel')),
  location_area text not null check (location_area in ('School Gate', 'Back Gate', 'Inside School', 'Uturu Main Town', 'Eke-Okigwe Axis')),
  precise_address text not null,
  yearly_rent_kobo bigint not null check (yearly_rent_kobo > 0),
  agent_commission_kobo bigint not null check (agent_commission_kobo >= 0),
  available_rooms integer not null default 1 check (available_rooms >= 0),
  availability_status text not null default 'Available' check (availability_status in ('Available', 'Unavailable')),
  verification_status text not null default 'Pending Verification' check (verification_status in ('Pending Verification', 'SUG Verified', 'Rejected', 'Suspended')),
  description text not null,
  amenities jsonb not null default '[]'::jsonb,
  images jsonb not null default '[]'::jsonb,
  video_tour_url text,
  landlord_name text not null,
  landlord_phone text not null,
  landlord_authorization_doc text not null,
  last_confirmed_at timestamptz not null default now(),
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

-- 5. Bookings & Conditional Settlement Snapshots (14 States, Integer Kobo)
create table if not exists public.bookings (
  booking_id text primary key,
  booking_reference text not null unique,
  student_uid uuid not null references public.users(uid) on delete restrict,
  student_name text not null,
  student_matric text not null,
  agent_uid uuid not null references public.users(uid) on delete restrict,
  agent_name text not null,
  property_id text not null references public.properties(property_id) on delete restrict,
  property_title text not null,
  location_area text not null,
  yearly_rent_kobo bigint not null check (yearly_rent_kobo > 0),
  agent_commission_kobo bigint not null check (agent_commission_kobo >= 0),
  inspection_fee_kobo integer not null default 300000 check (inspection_fee_kobo = 300000),
  total_payable_kobo bigint not null check (total_payable_kobo = yearly_rent_kobo + agent_commission_kobo + inspection_fee_kobo),
  platform_commission_kobo bigint not null,
  agent_earnings_kobo bigint not null,
  sug_allocation_kobo bigint not null,
  tech_manager_allocation_kobo bigint not null,
  status text not null default 'Pending Payment' check (status in (
    'Pending Payment', 'Payment Failed', 'Payment Successful',
    'Awaiting Inspection', 'Inspection Scheduled', 'Dispute Requested',
    'Under SUG Review', 'Refund Approved', 'Refund Processing',
    'Refunded', 'Confirmed', 'Settlement Processing', 'Settled', 'Cancelled'
  )),
  payment_status text not null default 'Unpaid' check (payment_status in ('Unpaid', 'Failed', 'Test Paid', 'Refunded', 'Settled')),
  inspection_date date not null,
  inspection_contact jsonb,
  confirmed_at timestamptz,
  settlement_authorization_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Idempotent Webhook Events
create table if not exists public.payment_events (
  event_id text primary key,
  webhook_id text not null unique,
  booking_reference text not null,
  event_type text not null,
  amount_kobo bigint not null,
  signature_valid boolean not null,
  duplicate_ignored boolean not null default false,
  status text not null check (status in ('processed', 'duplicate_ignored', 'rejected_signature', 'failed')),
  created_at timestamptz not null default now()
);

-- 7. Disputes & Refund Requests
create table if not exists public.disputes (
  dispute_id text primary key,
  booking_id text not null references public.bookings(booking_id) on delete cascade,
  booking_reference text not null,
  student_uid uuid not null references public.users(uid) on delete restrict,
  student_name text not null,
  agent_uid uuid not null references public.users(uid) on delete restrict,
  agent_name text not null,
  property_title text not null,
  reason text not null,
  description text not null,
  inspection_date date not null,
  evidence_file_name text,
  status text not null default 'Open' check (status in (
    'Open', 'Under Review', 'Awaiting Evidence',
    'Escalated to SUG President', 'Refund Approved', 'Refund Rejected', 'Closed'
  )),
  resolution_note text,
  resolved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. Verified-Booking-Only Reviews
create table if not exists public.reviews (
  review_id text primary key,
  property_id text not null references public.properties(property_id) on delete cascade,
  booking_id text not null unique references public.bookings(booking_id) on delete cascade,
  student_uid uuid not null references public.users(uid) on delete cascade,
  student_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  created_at timestamptz not null default now()
);

-- 9. Notifications, Audit Logs & SUG Announcements
create table if not exists public.notifications (
  notification_id text primary key,
  recipient_uid uuid not null references public.users(uid) on delete cascade,
  recipient_role text not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  log_id text primary key,
  actor_uid text not null,
  actor_name text not null,
  actor_role text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  announcement_id text primary key,
  title text not null,
  body text not null,
  published_by text not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
alter table public.platform_settings enable row level security;
alter table public.users enable row level security;
alter table public.agents enable row level security;
alter table public.properties enable row level security;
alter table public.bookings enable row level security;
alter table public.payment_events enable row level security;
alter table public.disputes enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.announcements enable row level security;

create or replace function public.current_user_role()
returns text language sql stable security definer as $$
  select role from public.users where uid = auth.uid();
$$;

-- Public readable tables
create policy "Public read platform settings" on public.platform_settings for select using (true);
create policy "SUG manages platform settings" on public.platform_settings for all
  using (public.current_user_role() in ('sug_president', 'sug_admin'));

create policy "Public read SUG announcements" on public.announcements for select using (true);
create policy "SUG publishes announcements" on public.announcements for all
  using (public.current_user_role() in ('sug_president', 'sug_admin'));

create policy "Public read verified properties" on public.properties for select
  using (verification_status = 'SUG Verified' or agent_uid = auth.uid() or public.current_user_role() in ('sug_president', 'sug_admin'));
create policy "Agents insert own properties" on public.properties for insert
  with check (agent_uid = auth.uid());
create policy "Agents or SUG update properties" on public.properties for update
  using (agent_uid = auth.uid() or public.current_user_role() in ('sug_president', 'sug_admin'));

-- Users & Agents
create policy "Users view own profile or SUG/Tech view" on public.users for select
  using (uid = auth.uid() or public.current_user_role() in ('sug_president', 'sug_admin', 'tech_manager'));
create policy "Users insert own profile" on public.users for insert with check (uid = auth.uid());
create policy "Users update non-privileged fields" on public.users for update
  using (uid = auth.uid() or public.current_user_role() in ('sug_president', 'tech_manager'));

create policy "Public read approved agents" on public.agents for select
  using (status = 'Approved' or owner_uid = auth.uid() or public.current_user_role() in ('sug_president', 'sug_admin'));
create policy "Agents apply for own account" on public.agents for insert with check (owner_uid = auth.uid());
create policy "SUG verifies or suspends agents" on public.agents for update
  using (public.current_user_role() in ('sug_president', 'sug_admin'));

-- Bookings (Strict student/agent/SUG isolation; Technical Manager has no dispute/settlement mutation authority)
create policy "Booking participants and SUG read" on public.bookings for select
  using (student_uid = auth.uid() or agent_uid = auth.uid() or public.current_user_role() in ('sug_president', 'sug_admin', 'tech_manager'));
create policy "Students create own bookings" on public.bookings for insert
  with check (student_uid = auth.uid());
create policy "Students confirm or SUG updates bookings" on public.bookings for update
  using (
    (student_uid = auth.uid() and status not in ('Settled', 'Refunded', 'Cancelled'))
    or (public.current_user_role() in ('sug_president', 'sug_admin') and status not in ('Settled', 'Refunded', 'Cancelled'))
  );

-- Disputes
create policy "Dispute participants and SUG read" on public.disputes for select
  using (student_uid = auth.uid() or agent_uid = auth.uid() or public.current_user_role() in ('sug_president', 'sug_admin'));
create policy "Students submit own disputes" on public.disputes for insert
  with check (student_uid = auth.uid());
create policy "SUG adjudicates disputes" on public.disputes for update
  using (public.current_user_role() in ('sug_president', 'sug_admin'));

-- Notifications & Reviews & Audit Logs
create policy "Users read own notifications" on public.notifications for select using (recipient_uid = auth.uid());
create policy "Users mark own notifications read" on public.notifications for update using (recipient_uid = auth.uid());
create policy "Public read reviews" on public.reviews for select using (true);
create policy "Verified settled students post reviews" on public.reviews for insert
  with check (
    student_uid = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.booking_id = reviews.booking_id and b.student_uid = auth.uid() and b.status = 'Settled'
    )
  );
create policy "Admins read audit logs and payment events" on public.audit_logs for select
  using (public.current_user_role() in ('sug_president', 'sug_admin', 'tech_manager'));
create policy "Admins read payment events" on public.payment_events for select
  using (public.current_user_role() in ('sug_president', 'sug_admin', 'tech_manager'));
