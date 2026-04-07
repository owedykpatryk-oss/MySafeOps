-- ═══════════════════════════════════════════
-- MySafeOps — Cloudflare D1 Database Schema
-- ═══════════════════════════════════════════

-- ═══ ORGANISATIONS ═══
CREATE TABLE IF NOT EXISTS organisations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#f97316',
  secondary_color TEXT DEFAULT '#0d9488',
  safety_policy TEXT,
  doc_footer TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','solo','team','business')),
  plan_expires TEXT,
  storage_used_bytes INTEGER DEFAULT 0,
  storage_limit_bytes INTEGER DEFAULT 104857600, -- 100MB free
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ═══ USERS ═══
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT, -- bcrypt
  role TEXT DEFAULT 'worker' CHECK (role IN ('admin','supervisor','worker')),
  phone TEXT,
  avatar_url TEXT,
  active INTEGER DEFAULT 1,
  last_login TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_email ON users(email);

-- ═══ PROJECTS ═══
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ref TEXT,
  address TEXT,
  postcode TEXT,
  what3words TEXT,
  client TEXT,
  principal_contractor TEXT,
  principal_designer TEXT,
  cdm_notifiable INTEGER DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  description TEXT,
  site_manager TEXT,
  site_supervisor TEXT,
  hs_advisor TEXT,
  nearest_ae TEXT,
  assembly_point TEXT,
  emergency_contact TEXT,
  emergency_procedure TEXT,
  latitude REAL,
  longitude REAL,
  site_hours TEXT DEFAULT 'Mon-Fri 08:00-17:00',
  parking TEXT,
  delivery_instructions TEXT,
  access_notes TEXT,
  site_rules TEXT,
  plan_image_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_projects_org ON projects(org_id);

-- ═══ SITE PLAN MARKERS ═══
CREATE TABLE IF NOT EXISTS plan_markers (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- fire_exit, assembly, etc.
  x REAL NOT NULL, -- % position
  y REAL NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_markers_project ON plan_markers(project_id);

-- ═══ DOCUMENTS (all types) ═══
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organisations(id),
  doc_type TEXT NOT NULL, -- rams, permit_hotwork, sitereport, incident, snag, rfi, etc.
  doc_number TEXT, -- RAMS-001, PTW-002, etc.
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected','closed')),
  revision TEXT DEFAULT '01',
  data JSON NOT NULL, -- all document-specific fields stored as JSON
  created_by TEXT REFERENCES users(id),
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_docs_project ON documents(project_id);
CREATE INDEX idx_docs_org ON documents(org_id);
CREATE INDEX idx_docs_type ON documents(doc_type);
CREATE INDEX idx_docs_status ON documents(status);
CREATE INDEX idx_docs_number ON documents(doc_number);

-- ═══ DOCUMENT SIGNATURES ═══
CREATE TABLE IF NOT EXISTS signatures (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  role TEXT,
  signed_at TEXT DEFAULT (datetime('now')),
  signature_url TEXT, -- drawn signature image
  ip_address TEXT
);
CREATE INDEX idx_sigs_doc ON signatures(document_id);

-- ═══ DOCUMENT-WORKER ASSIGNMENTS ═══
CREATE TABLE IF NOT EXISTS document_workers (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  read_at TEXT,
  signed_at TEXT,
  PRIMARY KEY (document_id, worker_id)
);

-- ═══ WORKERS ═══
CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  company TEXT,
  phone TEXT,
  email TEXT,
  cscs_number TEXT,
  cscs_type TEXT,
  ni_number TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  blood_type TEXT,
  allergies TEXT,
  medical_conditions TEXT,
  notes TEXT,
  photo_url TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_workers_org ON workers(org_id);

-- ═══ CERTIFICATES ═══
CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- CSCS Card, IPAF, PASMA, etc.
  number TEXT,
  issued_date TEXT,
  expiry_date TEXT,
  file_url TEXT, -- scanned cert image
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_certs_worker ON certificates(worker_id);
CREATE INDEX idx_certs_expiry ON certificates(expiry_date);

-- ═══ VEHICLES ═══
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  registration TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year TEXT,
  colour TEXT,
  type TEXT DEFAULT 'Van',
  vin TEXT,
  fuel_type TEXT DEFAULT 'Diesel',
  mot_expiry TEXT,
  mot_cert_number TEXT,
  insurance_expiry TEXT,
  insurance_provider TEXT,
  insurance_policy TEXT,
  tax_expiry TEXT,
  service_date TEXT,
  service_next TEXT,
  service_mileage TEXT,
  breakdown_cover TEXT,
  breakdown_expiry TEXT,
  assigned_driver_id TEXT REFERENCES workers(id),
  max_weight TEXT,
  tracker_fitted INTEGER DEFAULT 0,
  dashcam_fitted INTEGER DEFAULT 0,
  defects TEXT,
  notes TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_vehicles_org ON vehicles(org_id);

-- ═══ EQUIPMENT ═══
CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id),
  name TEXT NOT NULL,
  type TEXT,
  category TEXT,
  make TEXT,
  model TEXT,
  serial_number TEXT,
  asset_number TEXT,
  purchase_date TEXT,
  inspection_date TEXT,
  inspection_by TEXT,
  inspection_next TEXT,
  inspection_freq TEXT DEFAULT 'Monthly',
  inspection_cert_url TEXT,
  calibration_date TEXT,
  calibration_by TEXT,
  calibration_next TEXT,
  calibration_freq TEXT DEFAULT 'Annual',
  calibration_cert_url TEXT,
  pat_date TEXT,
  pat_next TEXT,
  status TEXT DEFAULT 'In Service' CHECK (status IN ('In Service','Defective','Out of Service','Calibration Due','Quarantined','Disposed')),
  location TEXT,
  assigned_to TEXT,
  swl TEXT, -- Safe Working Load
  loler_date TEXT,
  loler_next TEXT,
  loler_cert_url TEXT,
  defects TEXT,
  notes TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_equipment_org ON equipment(org_id);
CREATE INDEX idx_equipment_project ON equipment(project_id);

-- ═══ PHOTOS ═══
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organisations(id),
  description TEXT,
  category TEXT,
  file_url TEXT NOT NULL, -- R2 URL
  thumbnail_url TEXT, -- R2 thumbnail
  file_size INTEGER,
  latitude REAL,
  longitude REAL,
  accuracy REAL,
  taken_by TEXT REFERENCES users(id),
  taken_at TEXT DEFAULT (datetime('now')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_photos_project ON photos(project_id);

-- ═══ DOCUMENT-PHOTO LINKS ═══
CREATE TABLE IF NOT EXISTS document_photos (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, photo_id)
);

-- ═══ INDUCTIONS ═══
CREATE TABLE IF NOT EXISTS inductions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  inducted_by TEXT REFERENCES users(id),
  date TEXT DEFAULT (date('now')),
  items JSON NOT NULL, -- {"Site rules": true, "Fire evacuation": false, ...}
  completed INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_inductions_project ON inductions(project_id);
CREATE UNIQUE INDEX idx_inductions_pw ON inductions(project_id, worker_id);

-- ═══ REGISTERS ═══
CREATE TABLE IF NOT EXISTS register_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organisations(id),
  register_type TEXT NOT NULL, -- coshh, scaffold, lifting, fire, waste, visitor, drawing
  data JSON NOT NULL, -- all register-specific fields
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_registers_project ON register_entries(project_id);
CREATE INDEX idx_registers_type ON register_entries(register_type);

-- ═══ CHECKLISTS ═══
CREATE TABLE IF NOT EXISTS checklists (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organisations(id),
  template_name TEXT NOT NULL, -- "Pre-Start Daily", "Weekly Inspection", etc.
  date TEXT DEFAULT (date('now')),
  performed_by TEXT,
  sections JSON NOT NULL, -- [{cat:"...", items:[{text:"...",checked:bool,notes:""}]}]
  completed INTEGER DEFAULT 0,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_checklists_project ON checklists(project_id);

-- ═══ TOOLBOX TALK ATTENDANCE ═══
CREATE TABLE IF NOT EXISTS toolbox_attendance (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  talk_title TEXT NOT NULL,
  talk_date TEXT DEFAULT (date('now')),
  conducted_by TEXT REFERENCES users(id),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS toolbox_signees (
  attendance_id TEXT NOT NULL REFERENCES toolbox_attendance(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL REFERENCES workers(id),
  signed_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (attendance_id, worker_id)
);

-- ═══ FEATURE REQUESTS (from landing page) ═══
CREATE TABLE IF NOT EXISTS feature_requests (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new','planned','in_progress','done','rejected')),
  votes INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══ EARLY ACCESS SIGNUPS (from landing page) ═══
CREATE TABLE IF NOT EXISTS early_access (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'landing', -- landing, referral, etc.
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══ AUDIT LOG ═══
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL, -- create, update, delete, approve, reject, login, export
  entity_type TEXT, -- document, worker, project, etc.
  entity_id TEXT,
  details TEXT, -- JSON with changed fields
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_org ON audit_log(org_id);
CREATE INDEX idx_audit_date ON audit_log(created_at);

-- ═══ STORAGE LIMITS PER PLAN ═══
-- Enforced in Workers API, not in DB
-- free:     100MB  (104857600 bytes)
-- solo:     2GB    (2147483648 bytes)
-- team:     10GB   (10737418240 bytes)
-- business: 50GB   (53687091200 bytes)
