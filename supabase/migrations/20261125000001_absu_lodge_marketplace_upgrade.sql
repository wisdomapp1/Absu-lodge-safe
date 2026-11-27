-- ABSU LodgeSafe (Project: jjidjcnyknoavmefrrpi)
-- Additive Schema & RLS Security Alignment Migration
-- IMPORTANT: Safe, non-destructive migration. Preserves existing tables and data.
-- Maps existing tech_admin / tech_manager roles cleanly to super_admin.

create extension if not exists "pgcrypto";

-- 1. Ensure user_roles supports all 4 required roles without dropping legacy rows
alter table if exists public.user_roles drop constraint if exists user_roles_role_check;
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_roles') then
    update public.user_roles
    set role = 'super_admin'
    where role in ('tech_admin', 'tech_manager');

    alter table public.user_roles
      add constraint user_roles_role_check
      check (role in ('student', 'agent', 'sug_admin', 'super_admin'));
  end if;
end $$;

-- 2. Add WhatsApp & phone fields cleanly on profiles if missing
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    alter table public.profiles add column if not exists whatsapp_number text;
    alter table public.profiles add column if not exists phone text;
    alter table public.profiles add column if not exists full_name text;
  end if;
end $$;

-- 3. Align agents & private NIN/verification document isolation
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'agents') then
    alter table public.agents add column if not exists whatsapp_number text;
    alter table public.agents add column if not exists operating_area text;
    alter table public.agents add column if not exists experience_years integer default 1;
    alter table public.agents add column if not exists profile_photo_url text;
    alter table public.agents add column if not exists banned_at timestamptz;
    alter table public.agents add column if not exists ban_reason text;
  end if;
end $$;

-- 4. Update platform_settings safely for 40% Agent / 35% SUG / 25% Platform & ₦3,000 fixed inspection fee
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'platform_settings') then
    alter table public.platform_settings add column if not exists agent_share_pct integer not null default 40;
    alter table public.platform_settings add column if not exists sug_share_pct integer not null default 35;
    alter table public.platform_settings add column if not exists platform_share_pct integer not null default 25;
    alter table public.platform_settings add column if not exists hold_duration_hours integer not null default 48;
    alter table public.platform_settings add column if not exists inspection_fee_kobo integer not null default 300000;
  end if;
end $$;

-- 5. Properties: Caretaker details, discrete agent fees, rejection reason, suspicious flag, Cloudinary metadata
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'properties') then
    alter table public.properties add column if not exists landlord_name text;
    alter table public.properties add column if not exists landlord_phone text;
    alter table public.properties add column if not exists caretaker_name text;
    alter table public.properties add column if not exists caretaker_phone text;
    alter table public.properties add column if not exists rejection_reason text;
    alter table public.properties add column if not exists flagged_suspicious_reason text;
    alter table public.properties add column if not exists landlord_verified boolean not null default false;
    alter table public.properties add column if not exists lodge_status text not null default 'Pending';
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'property_media') then
    alter table public.property_media add column if not exists cloudinary_public_id text;
    alter table public.property_media add column if not exists media_type text;
  end if;
end $$;

-- 6. Bookings & Payments: 48-hour hold, split_at, boarding form fields, confirmation & refund lock
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'bookings') then
    alter table public.bookings add column if not exists agent_fee_kobo bigint;
    alter table public.bookings add column if not exists inspection_fee_kobo integer not null default 300000;
    alter table public.bookings add column if not exists total_booking_fee_kobo bigint;
    alter table public.bookings add column if not exists inspection_date date;
    alter table public.bookings add column if not exists inspection_time text;
    alter table public.bookings add column if not exists student_note text;
    alter table public.bookings add column if not exists student_whatsapp text;
    alter table public.bookings add column if not exists paid_at timestamptz;
    alter table public.bookings add column if not exists split_at timestamptz;
    alter table public.bookings add column if not exists confirmed_at timestamptz;
    alter table public.bookings add column if not exists auto_confirmed boolean not null default false;
    alter table public.bookings add column if not exists refund_locked boolean not null default false;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'payments') then
    alter table public.payments add column if not exists paystack_reference text;
    alter table public.payments add column if not exists agent_share_kobo bigint;
    alter table public.payments add column if not exists sug_share_kobo bigint;
    alter table public.payments add column if not exists platform_agent_share_kobo bigint;
    alter table public.payments add column if not exists platform_inspection_fee_kobo integer not null default 300000;
    alter table public.payments add column if not exists split_at timestamptz;
  end if;
end $$;

-- 7. Helper role function (server-controlled; prevents client privilege escalation)
create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and (
        ur.role = _role
        or (_role = 'super_admin' and ur.role in ('tech_admin', 'tech_manager', 'super_admin'))
      )
  );
$$;

-- 8. Server-side validation trigger to block rent-collection links inside property descriptions
create or replace function public.validate_property_safety()
returns trigger
language plpgsql
as $$
begin
  if new.description ~* '(https?://|www\.|paystack\.com|flutterwave|opayweb|pay\s+(your\s+)?rent\s+(to|via)\s+(me|agent)|send\s+rent\s+to\s+agent)' then
    raise exception 'Listing rejected: Descriptions cannot contain external payment links or rent collection instructions.';
  end if;
  if new.agent_fee_kobo is not null and new.agent_fee_kobo not in (500000, 1000000, 1500000, 2000000, 3000000, 4000000) then
    raise exception 'Invalid agent fee tier. Allowed values: ₦5,000, ₦10,000, ₦15,000, ₦20,000, ₦30,000, or ₦40,000.';
  end if;
  return new;
end;
$$;

-- 9. Strict RLS Hardening for sensitive tables (non-destructive drop-if-exists before recreate)
do $$
begin
  -- Protect verification documents (NIN / ID docs): only owner or super_admin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'agent_verification_documents') then
    alter table public.agent_verification_documents enable row level security;
    drop policy if exists "Admins and owner read verification docs" on public.agent_verification_documents;
    create policy "Admins and owner read verification docs"
      on public.agent_verification_documents for select
      using (
        exists (select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid())
        or public.has_role(auth.uid(), 'super_admin')
      );
  end if;

  -- Protect platform_settings so SUG Admin cannot read sensitive Paystack config
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'platform_settings') then
    alter table public.platform_settings enable row level security;
    drop policy if exists "Public read platform settings" on public.platform_settings;
    drop policy if exists "Only super_admin reads sensitive platform settings" on public.platform_settings;
    create policy "Only super_admin reads sensitive platform settings"
      on public.platform_settings for select
      using (public.has_role(auth.uid(), 'super_admin'));
    drop policy if exists "Only super_admin updates platform settings" on public.platform_settings;
    create policy "Only super_admin updates platform settings"
      on public.platform_settings for all
      using (public.has_role(auth.uid(), 'super_admin'));
  end if;

  -- Prevent client role escalation on user_roles
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_roles') then
    alter table public.user_roles enable row level security;
    drop policy if exists "Users read own role or super_admin reads all" on public.user_roles;
    create policy "Users read own role or super_admin reads all"
      on public.user_roles for select
      using (user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));
    drop policy if exists "Only super_admin modifies roles" on public.user_roles;
    create policy "Only super_admin modifies roles"
      on public.user_roles for all
      using (public.has_role(auth.uid(), 'super_admin'));
  end if;
end $$;
