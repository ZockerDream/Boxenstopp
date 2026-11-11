-- 0.3.0: Fuhrpark, Fahrzeug-Katalog mit Bildern, Tuning-Pakete, Regelwerk

-- Bilder (für Katalog-Modelle und Fuhrpark), in der Datenbank – damit sind sie im Backup
CREATE TABLE images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('model','fleet')),
  owner_id uuid NOT NULL,
  mime text NOT NULL,
  data bytea NOT NULL,
  size int NOT NULL,
  caption text NOT NULL DEFAULT '',
  position int NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX images_owner_idx ON images(owner_type, owner_id, position);

-- Fahrzeug-Katalog (Modelle)
CREATE TABLE vehicle_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make text NOT NULL, model text NOT NULL,
  class_id uuid REFERENCES vehicle_classes(id) ON DELETE SET NULL,
  body text NOT NULL DEFAULT '',          -- Bauform: Coupé, Limousine, SUV …
  price numeric(14,2),                    -- Neupreis im RP (Orientierung)
  seats int, top_speed int, drive text NOT NULL DEFAULT '', fuel text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '', tuning_note text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (make, model)
);
ALTER TABLE vehicles ADD COLUMN model_id uuid REFERENCES vehicle_models(id) ON DELETE SET NULL;

-- Fuhrpark der Werkstatt
CREATE TABLE fleet_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                               -- Rufname, z. B. „Abschlepper 1“
  plate text NOT NULL,
  kind text NOT NULL DEFAULT 'Servicewagen',
  model_id uuid REFERENCES vehicle_models(id) ON DELETE SET NULL,
  make text NOT NULL DEFAULT '', model text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','in_use','workshop','retired')),
  driver_id uuid REFERENCES users(id) ON DELETE SET NULL,
  km int NOT NULL DEFAULT 0,
  service_due date, service_km int, insurance_until date,
  purchase_price numeric(14,2), purchased_on date,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX fleet_plate_uq ON fleet_vehicles (upper(replace(plate, ' ', ''))) WHERE status <> 'retired';
CREATE TABLE fleet_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id uuid NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('checkout','checkin','service','damage','fuel','cost','note','status')),
  started_at timestamptz, ended_at timestamptz,
  km_start int, km_end int,
  amount numeric(14,2), transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  text text NOT NULL DEFAULT '',
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fleet_log_idx ON fleet_log(fleet_id, at DESC);
ALTER TABLE callouts ADD COLUMN fleet_id uuid REFERENCES fleet_vehicles(id) ON DELETE SET NULL;
ALTER TABLE transactions DROP CONSTRAINT transactions_source_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_source_check CHECK (source IN ('manual','invoice','reserve','stock','recurring','tax','payroll','closing','transfer','refund','fleet'));

-- Tuning-Pakete
CREATE TABLE tuning_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, description text NOT NULL DEFAULT '',
  items uuid[] NOT NULL DEFAULT '{}',          -- Leistungen der Preisliste
  discount numeric(5,2) NOT NULL DEFAULT 0,    -- Paketrabatt in %
  active boolean NOT NULL DEFAULT true,
  position int NOT NULL DEFAULT 0
);

-- Regelwerk: Dienstverordnung, Firmen-Kodex … mit Versionen und Lesebestätigung
CREATE TABLE rule_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, body text NOT NULL DEFAULT '',
  version int NOT NULL DEFAULT 1,
  require_ack boolean NOT NULL DEFAULT true,
  position int NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rule_doc_versions (
  doc_id uuid NOT NULL REFERENCES rule_docs(id) ON DELETE CASCADE,
  version int NOT NULL, title text NOT NULL, body text NOT NULL, note text NOT NULL DEFAULT '',
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL, changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (doc_id, version)
);
CREATE TABLE rule_acks (
  doc_id uuid NOT NULL REFERENCES rule_docs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version int NOT NULL, at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (doc_id, user_id, version)
);

-- Rechte für die neuen Funktionen aus verwandten Funktionen übernehmen, damit bestehende Ränge sofort passen
INSERT INTO permissions (target_type, target_id, module, level)
  SELECT target_type, target_id, 'fleet', level FROM permissions WHERE module = 'vehicles' ON CONFLICT DO NOTHING;
INSERT INTO permissions (target_type, target_id, module, level)
  SELECT target_type, target_id, 'models', level FROM permissions WHERE module = 'catalog' ON CONFLICT DO NOTHING;
INSERT INTO permissions (target_type, target_id, module, level)
  SELECT target_type, target_id, 'tuning', level FROM permissions WHERE module = 'catalog' ON CONFLICT DO NOTHING;
INSERT INTO permissions (target_type, target_id, module, level)
  SELECT 'rank', target_id, 'rules', CASE WHEN level = 4 THEN 4 ELSE 2 END FROM permissions WHERE target_type = 'rank' AND module = 'settings' ON CONFLICT DO NOTHING;
