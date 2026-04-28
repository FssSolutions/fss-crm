-- FSS CRM — Initial Schema
-- Run this in the Supabase SQL Editor

-- Drop existing tables (safe if empty)
drop table if exists tasks, expenses, quote_line_items, invoices, jobs, quotes, communications, price_book, clients cascade;

-- Clients
create table clients (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  created_at       timestamptz not null default now(),
  first_name       text not null default '',
  last_name        text not null default '',
  company_name     text,
  email            text,
  phone            text,
  billing_address  text,
  property_address text,
  city             text,
  lead_status      text not null default 'warm',
  lead_source      text,
  division         text,
  is_repeat_client boolean not null default false,
  tags             text[],
  notes            text,
  last_contacted_at  timestamptz,
  next_followup_at   timestamptz,
  referred_by      uuid references clients(id)
);
alter table clients enable row level security;
create policy "user_only" on clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Communications log
create table communications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  client_id        uuid not null references clients(id) on delete cascade,
  created_at       timestamptz not null default now(),
  contact_date     timestamptz not null default now(),
  method           text not null,
  direction        text not null default 'outbound',
  summary          text,
  follow_up_required boolean not null default false
);
alter table communications enable row level security;
create policy "user_only" on communications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Quotes
create table quotes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  quote_number     text not null,
  client_id        uuid references clients(id),
  division         text not null,
  status           text not null default 'draft',
  version          integer not null default 1,
  parent_quote_id  uuid references quotes(id),
  title            text not null,
  property_address text,
  subtotal         numeric(10,2) not null default 0,
  gst_amount       numeric(10,2) not null default 0,
  total            numeric(10,2) not null default 0,
  issued_date      date,
  expiry_date      date,
  accepted_date    date,
  notes            text,
  internal_notes   text,
  win_loss_reason  text,
  created_at       timestamptz not null default now()
);
alter table quotes enable row level security;
create policy "user_only" on quotes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Quote line items
create table quote_line_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  quote_id     uuid not null references quotes(id) on delete cascade,
  sort_order   integer not null default 0,
  description  text not null,
  quantity     numeric(10,2) not null default 1,
  unit         text,
  unit_price   numeric(10,2) not null default 0,
  line_total   numeric(10,2) not null default 0,
  is_taxable   boolean not null default true,
  category     text
);
alter table quote_line_items enable row level security;
create policy "user_only" on quote_line_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Jobs
create table jobs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  job_number           text not null,
  quote_id             uuid references quotes(id),
  client_id            uuid references clients(id),
  division             text not null,
  title                text not null,
  description          text,
  property_address     text,
  status               text not null default 'scheduled',
  scheduled_date       date,
  start_time           time,
  end_time             time,
  completed_date       date,
  quoted_amount        numeric(10,2),
  invoiced_amount      numeric(10,2),
  payment_status       text not null default 'unpaid',
  payment_received_at  date,
  payment_method       text,
  crew_lead            text,
  crew_size            integer default 1,
  is_recurring         boolean not null default false,
  recurrence_notes     text,
  gcal_event_id        text,
  labour_cost          numeric(10,2),
  material_cost        numeric(10,2),
  notes                text,
  created_at           timestamptz not null default now()
);
alter table jobs enable row level security;
create policy "user_only" on jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Invoices
create table invoices (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  invoice_number   text not null,
  job_id           uuid references jobs(id),
  client_id        uuid references clients(id),
  division         text not null,
  issued_date      date not null default current_date,
  due_date         date,
  subtotal         numeric(10,2) not null default 0,
  gst_amount       numeric(10,2) not null default 0,
  total            numeric(10,2) not null default 0,
  status           text not null default 'draft',
  qb_export_date   date,
  notes            text,
  created_at       timestamptz not null default now()
);
alter table invoices enable row level security;
create policy "user_only" on invoices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Expenses
create table expenses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  job_id       uuid references jobs(id),
  date         date not null,
  description  text not null,
  amount       numeric(10,2) not null,
  category     text not null,
  division     text not null,
  receipt_ref  text,
  created_at   timestamptz not null default now()
);
alter table expenses enable row level security;
create policy "user_only" on expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Price book
create table price_book (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  division      text not null,
  category      text not null,
  name          text not null,
  description   text,
  unit          text,
  default_price numeric(10,2) not null default 0,
  is_taxable    boolean not null default true,
  is_active     boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now()
);
alter table price_book enable row level security;
create policy "user_only" on price_book for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tasks
create table tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  due_date     date,
  title        text not null,
  description  text,
  client_id    uuid references clients(id),
  quote_id     uuid references quotes(id),
  job_id       uuid references jobs(id),
  is_complete  boolean not null default false,
  completed_at timestamptz,
  priority     text default 'medium'
);
alter table tasks enable row level security;
create policy "user_only" on tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
