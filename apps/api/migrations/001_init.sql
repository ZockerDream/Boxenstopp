-- Boxenstopp – Grundschema. Eine Instanz = eine Firma.
CREATE EXTENSION IF NOT EXISTS citext;

-- Zeitpunkt in der Zeitzone der Verbindung (wird von der API gesetzt) als 'JJJJ-MM-TT HH:MM'
CREATE FUNCTION local_ts(t timestamptz) RETURNS text LANGUAGE sql STABLE AS $$ SELECT to_char(t, 'YYYY-MM-DD HH24:MI') $$;

CREATE TABLE settings (key text PRIMARY KEY, value jsonb NOT NULL);

-- ---------- Personal, Ränge, Gruppen, Rechte ----------
CREATE TABLE ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position int NOT NULL,
  pay jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ranks_position_uq UNIQUE (position) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT ''
);
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','leave','locked','left','invited','pending')),
  is_owner boolean NOT NULL DEFAULT false,
  rank_id uuid REFERENCES ranks(id) ON DELETE RESTRICT,
  staff_no text NOT NULL DEFAULT '',
  duty_no text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  joined_on date NOT NULL DEFAULT current_date,
  left_on date,
  pay_model jsonb,
  totp_secret text,
  totp_enabled boolean NOT NULL DEFAULT false,
  force_2fa boolean NOT NULL DEFAULT false,
  expires_on date,
  failed_logins int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  ui jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE group_members (
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);
-- target_type: rank | group | user
CREATE TABLE permissions (
  target_type text NOT NULL CHECK (target_type IN ('rank','group','user')),
  target_id uuid NOT NULL,
  module text NOT NULL,
  level smallint NOT NULL CHECK (level BETWEEN 0 AND 4),
  PRIMARY KEY (target_type, target_id, module)
);
CREATE TABLE permission_flags (
  target_type text NOT NULL CHECK (target_type IN ('rank','group','user')),
  target_id uuid NOT NULL,
  flag text NOT NULL,
  value numeric NOT NULL,
  PRIMARY KEY (target_type, target_id, flag)
);
CREATE TABLE rank_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_rank text, to_rank text, by_user uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text, at timestamptz NOT NULL DEFAULT now()
);

-- Systemrollen (Administration)
CREATE TABLE system_roles (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  fixed boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false
);
CREATE TABLE system_role_perms (role_id text NOT NULL REFERENCES system_roles(id) ON DELETE CASCADE, perm text NOT NULL, PRIMARY KEY (role_id, perm));
CREATE TABLE user_system_roles (user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, role_id text NOT NULL REFERENCES system_roles(id) ON DELETE CASCADE, PRIMARY KEY (user_id, role_id));

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  pending_2fa boolean NOT NULL DEFAULT false,
  ip text, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL, name text NOT NULL DEFAULT '',
  rank_id uuid REFERENCES ranks(id) ON DELETE CASCADE,
  role_id text REFERENCES system_roles(id) ON DELETE SET NULL,
  group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL, used_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE password_resets (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, used_at timestamptz
);
CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL, prefix text NOT NULL, key_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(), last_used_at timestamptz, revoked_at timestamptz
);
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  area text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', ip text
);
CREATE INDEX audit_at_idx ON audit_log(at DESC);
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL, text text NOT NULL, link text NOT NULL DEFAULT '', tone text NOT NULL DEFAULT 'info',
  dedupe text, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX notifications_dedupe_uq ON notifications(user_id, dedupe) WHERE dedupe IS NOT NULL;

-- ---------- Preisliste, Lager ----------
CREATE TABLE vehicle_classes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, position int NOT NULL DEFAULT 0);
CREATE TABLE catalog_categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, position int NOT NULL DEFAULT 0);
CREATE TABLE price_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, pct numeric(5,2) NOT NULL DEFAULT 0,
  cats jsonb NOT NULL DEFAULT '{}', is_default boolean NOT NULL DEFAULT false
);
CREATE TABLE parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sku text NOT NULL DEFAULT '', name text NOT NULL, unit text NOT NULL DEFAULT 'Stk',
  stock numeric(12,2) NOT NULL DEFAULT 0, reserved numeric(12,2) NOT NULL DEFAULT 0, min_stock numeric(12,2) NOT NULL DEFAULT 0,
  location text NOT NULL DEFAULT '', buy numeric(14,2) NOT NULL DEFAULT 0, sell numeric(14,2) NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true
);
CREATE TABLE catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES catalog_categories(id) ON DELETE RESTRICT,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('flat','labor','part','bundle')),
  unit text NOT NULL DEFAULT 'pauschal',
  price numeric(14,2) NOT NULL DEFAULT 0,
  surcharge jsonb,            -- {classId: Prozent}
  class_prices jsonb,         -- {classId: Preis}
  material numeric(14,2) NOT NULL DEFAULT 0,
  minutes int NOT NULL DEFAULT 0,
  warranty int NOT NULL DEFAULT 0,
  req text[] NOT NULL DEFAULT '{}',   -- training:<id> | license:<id>
  group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  tuning jsonb,               -- ["Motor", 2]
  parts jsonb,                -- [{"part": id, "qty": n}]
  part_id uuid REFERENCES parts(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  note text NOT NULL DEFAULT '',
  position int NOT NULL DEFAULT 0
);
CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  qty numeric(12,2) NOT NULL,
  kind text NOT NULL CHECK (kind IN ('in','out','reserve','release','adjust','inventory')),
  ref text NOT NULL DEFAULT '', reason text NOT NULL DEFAULT '',
  by_user uuid REFERENCES users(id) ON DELETE SET NULL,
  at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Kunden, Fahrzeuge ----------
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'person' CHECK (kind IN ('person','company','authority')),
  phone text NOT NULL DEFAULT '',
  price_group_id uuid REFERENCES price_groups(id) ON DELETE SET NULL,
  terms_days int NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  warning text, blocked text,
  since date NOT NULL DEFAULT current_date,
  archived boolean NOT NULL DEFAULT false
);
CREATE TABLE customer_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  at timestamptz NOT NULL DEFAULT now(), body text NOT NULL
);
CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate text NOT NULL, make text NOT NULL DEFAULT '', model text NOT NULL DEFAULT '',
  class_id uuid REFERENCES vehicle_classes(id) ON DELETE RESTRICT,
  color text NOT NULL DEFAULT '', vin text NOT NULL DEFAULT '', km int NOT NULL DEFAULT 0,
  owner_id uuid REFERENCES customers(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','scrapped','stolen')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX vehicles_plate_uq ON vehicles (upper(replace(plate, ' ', ''))) WHERE status <> 'scrapped';
CREATE TABLE vehicle_owner_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  from_at date NOT NULL DEFAULT current_date, to_at date
);
CREATE TABLE vehicle_tuning (
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  category text NOT NULL, level int NOT NULL, source text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vehicle_id, category)
);

-- ---------- Aufträge, Einsätze, Termine ----------
CREATE TABLE bays (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, position int NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true);
CREATE TABLE number_sequences (kind text NOT NULL, year int NOT NULL, last int NOT NULL DEFAULT 0, PRIMARY KEY (kind, year));
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  no text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('quote','accepted','in_progress','waiting_parts','done','invoiced','picked_up','rejected','cancelled')),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  price_group_id uuid REFERENCES price_groups(id) ON DELETE SET NULL,
  request text NOT NULL DEFAULT '', mileage int NOT NULL DEFAULT 0, condition jsonb NOT NULL DEFAULT '{}',
  due date, bay_id uuid REFERENCES bays(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  cancel_reason text
);
CREATE TABLE order_assignees (order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (order_id, user_id));
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES catalog_items(id) ON DELETE SET NULL,
  name text NOT NULL, kind text NOT NULL,
  qty numeric(10,2) NOT NULL DEFAULT 1, unit_price numeric(14,2) NOT NULL, disc numeric(5,2) NOT NULL DEFAULT 0,
  by_user uuid REFERENCES users(id) ON DELETE SET NULL,
  parts jsonb,                 -- eingefrorene Teile [{part, qty}]
  parts_taken boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(), user_id uuid REFERENCES users(id) ON DELETE SET NULL, text text NOT NULL
);
CREATE TABLE order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL, at timestamptz NOT NULL DEFAULT now(), body text NOT NULL
);
CREATE TABLE discount_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  pct numeric(5,2) NOT NULL, status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','rejected')),
  decided_by uuid REFERENCES users(id) ON DELETE SET NULL, decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE callouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  no text NOT NULL UNIQUE, at timestamptz NOT NULL DEFAULT now(),
  location text NOT NULL, requested_by text NOT NULL DEFAULT 'Kunde',
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','en_route','on_site','done','cancelled')),
  fee numeric(14,2) NOT NULL DEFAULT 0, catalog_item_id uuid REFERENCES catalog_items(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL, invoice_id uuid
);
CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL, time text NOT NULL DEFAULT '', bay_id uuid REFERENCES bays(id) ON DELETE CASCADE,
  title text NOT NULL, customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL, note text NOT NULL DEFAULT ''
);

-- ---------- Finanzen ----------
CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  kind text NOT NULL DEFAULT 'bank' CHECK (kind IN ('bank','cash','tax_reserve','other')), archived boolean NOT NULL DEFAULT false
);
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('income','expense','transfer_in','transfer_out')),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  title text NOT NULL, category text NOT NULL DEFAULT 'Sonstiges',
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','invoice','reserve','stock','recurring','tax','payroll','closing','transfer','refund')),
  source_id uuid, taxable boolean NOT NULL DEFAULT false,
  booked_at date NOT NULL DEFAULT current_date,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_booked_idx ON transactions(booked_at);
CREATE TABLE recurring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  type text NOT NULL DEFAULT 'expense' CHECK (type IN ('income','expense')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0), category text NOT NULL DEFAULT 'Sonstiges',
  every text NOT NULL CHECK (every IN ('weekly','monthly','yearly')), next_run date NOT NULL,
  active boolean NOT NULL DEFAULT true, taxable boolean NOT NULL DEFAULT false
);
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  no text NOT NULL UNIQUE,
  order_id uuid REFERENCES orders(id) ON DELETE RESTRICT,
  callout_id uuid REFERENCES callouts(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT,
  issued date NOT NULL DEFAULT current_date, due date NOT NULL DEFAULT current_date,
  total numeric(14,2) NOT NULL, paid numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','partial','paid','cancelled','credit')),
  cancels_id uuid REFERENCES invoices(id), cancel_reason text,
  snapshot jsonb NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL,           -- negativ = Erstattung bei Storno
  method text NOT NULL DEFAULT 'Bar', account_id uuid NOT NULL REFERENCES accounts(id),
  at date NOT NULL DEFAULT current_date, by_user uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoice_payments_at_idx ON invoice_payments(at);
CREATE TABLE tax_rates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rate numeric(5,2) NOT NULL, valid_from date NOT NULL UNIQUE, by_user uuid REFERENCES users(id) ON DELETE SET NULL);
CREATE TABLE tax_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_from date NOT NULL UNIQUE, period_to date NOT NULL,
  revenue numeric(14,2) NOT NULL, tax numeric(14,2) NOT NULL,
  filed_at timestamptz NOT NULL DEFAULT now(), filed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  account_id uuid REFERENCES accounts(id), transaction_id uuid REFERENCES transactions(id)
);
CREATE TABLE cash_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id), day date NOT NULL,
  expected numeric(14,2) NOT NULL, counted numeric(14,2) NOT NULL, reason text NOT NULL DEFAULT '',
  by_user uuid REFERENCES users(id) ON DELETE SET NULL, at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, day)
);
CREATE TABLE payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_from date NOT NULL UNIQUE, period_to date NOT NULL, total numeric(14,2) NOT NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL, approved_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payroll_lines (
  run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hours numeric(8,2) NOT NULL, hourly numeric(14,2) NOT NULL, commission_base numeric(14,2) NOT NULL,
  commission numeric(14,2) NOT NULL, fixed numeric(14,2) NOT NULL, adjust numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL, transaction_id uuid REFERENCES transactions(id),
  PRIMARY KEY (run_id, user_id)
);

-- Unveränderlichkeit: abgeschlossene Dinge werden in der DB geschützt
CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable: %', TG_TABLE_NAME USING ERRCODE = 'P0001'; END $$;
CREATE TRIGGER payroll_runs_immutable BEFORE UPDATE OR DELETE ON payroll_runs FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER tax_periods_immutable BEFORE UPDATE OR DELETE ON tax_periods FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER invoice_payments_immutable BEFORE UPDATE OR DELETE ON invoice_payments FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE FUNCTION invoices_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'immutable: invoices' USING ERRCODE = 'P0001'; END IF;
  IF NEW.total <> OLD.total OR NEW.snapshot <> OLD.snapshot OR NEW.no <> OLD.no OR NEW.issued <> OLD.issued THEN
    RAISE EXCEPTION 'immutable: invoices' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invoices_immutable BEFORE UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION invoices_guard();

-- ---------- Personal ----------
CREATE TABLE shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL, ended_at timestamptz,
  source text NOT NULL DEFAULT 'clock' CHECK (source IN ('clock','manual')),
  reason text NOT NULL DEFAULT '', edited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  CHECK (ended_at IS NULL OR ended_at > started_at)
);
CREATE UNIQUE INDEX shifts_open_uq ON shifts(user_id) WHERE ended_at IS NULL;
CREATE TABLE absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL, from_day date NOT NULL, to_day date NOT NULL, note text NOT NULL DEFAULT '',
  CHECK (to_day >= from_day)
);
CREATE TABLE staff_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL, level int, day date NOT NULL DEFAULT current_date,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL, text text NOT NULL,
  self_visible boolean NOT NULL DEFAULT false, expires date
);
CREATE TABLE trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text NOT NULL DEFAULT '',
  months int, test boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true
);
CREATE TABLE rank_requirements (rank_id uuid NOT NULL REFERENCES ranks(id) ON DELETE CASCADE, training_id uuid NOT NULL REFERENCES trainings(id) ON DELETE CASCADE, PRIMARY KEY (rank_id, training_id));
CREATE TABLE training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  day date NOT NULL, time text NOT NULL DEFAULT '', location text NOT NULL DEFAULT '',
  trainer_id uuid REFERENCES users(id) ON DELETE SET NULL, done boolean NOT NULL DEFAULT false
);
CREATE TABLE training_participants (
  session_id uuid NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  result text NOT NULL DEFAULT 'registered' CHECK (result IN ('registered','passed','failed','no_show')),
  PRIMARY KEY (session_id, user_id)
);
CREATE TABLE certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  training_id uuid NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  valid_from date NOT NULL DEFAULT current_date, valid_until date,
  source text NOT NULL DEFAULT 'manual', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE license_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  holder text NOT NULL DEFAULT 'member' CHECK (holder IN ('member','firm')), months int
);
CREATE TABLE licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id uuid NOT NULL REFERENCES license_types(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  no text NOT NULL DEFAULT '', issuer text NOT NULL DEFAULT '',
  issued date NOT NULL DEFAULT current_date, expires date,
  status text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','suspended','revoked')), reason text
);
CREATE TABLE board_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, body text NOT NULL DEFAULT '',
  pinned boolean NOT NULL DEFAULT false, author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE board_reads (post_id uuid NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (post_id, user_id));

-- ---------- Administration ----------
CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), no serial, title text NOT NULL, body text NOT NULL DEFAULT '',
  page text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','rejected')),
  by_user uuid REFERENCES users(id) ON DELETE SET NULL, at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL, body text NOT NULL, at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, url text NOT NULL, events text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true, last_status text, last_at timestamptz
);
CREATE TABLE job_runs (
  id bigserial PRIMARY KEY, job text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz, status text NOT NULL DEFAULT 'running', message text NOT NULL DEFAULT ''
);
CREATE INDEX job_runs_job_idx ON job_runs(job, started_at DESC);

-- ---------- Grunddaten ----------
INSERT INTO system_roles (id, name, description, fixed, is_default) VALUES
  ('admin', 'Administrator', 'Alle Systemrechte', true, false),
  ('user', 'Benutzer', 'Keine Systemrechte', true, true),
  ('support', 'Support', 'Benutzer ansehen, Tickets, Audit-Log', false, false);
INSERT INTO system_role_perms (role_id, perm) VALUES
  ('support','user:read'), ('support','server:read'), ('support','audit:read'), ('support','ticket:manage');
INSERT INTO settings (key, value) VALUES
  ('firm', '{"name":"","short":"BXS","address":"","phone":"","hours":"","invoiceFooter":"Zahlbar innerhalb von 3 Tagen.","termsDays":3}'),
  ('logo', '{"kind":"preset","preset":"wrench","data":null}'),
  ('features', '{"stock":true,"callouts":true,"appointments":true,"taxReserve":true,"publicPricelist":false,"fourEyes":false,"qualHard":false}'),
  ('tax', '{"period":"week","reserveAccount":null,"payrollAccount":null}'),
  ('security', '{"minPassword":10,"maxFailed":5,"lockMinutes":15,"sessionDays":7,"require2fa":"off","allowlist":"","registration":false,"maintenance":false,"maintenanceText":"Wir schrauben gerade selbst – gleich wieder da."}');
