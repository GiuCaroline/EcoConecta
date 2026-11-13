CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  password_hash TEXT,
  role TEXT,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  vehicle TEXT DEFAULT '',
  plate TEXT DEFAULT '',
  online BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS points (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES users(id),
  name TEXT,
  address TEXT,
  phone TEXT,
  hours TEXT,
  description TEXT,
  materials JSONB,
  active BOOLEAN DEFAULT true,
  icon TEXT DEFAULT 'leaf-outline',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY,
  resident_id UUID REFERENCES users(id),
  point_id UUID REFERENCES points(id),
  driver_id UUID REFERENCES users(id),
  materials JSONB,
  quantity NUMERIC,
  date TEXT,
  period TEXT,
  address TEXT,
  notes TEXT DEFAULT '',
  status INTEGER DEFAULT 0,
  cancelled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id UUID REFERENCES users(id),
  point_id UUID REFERENCES points(id),
  PRIMARY KEY (user_id, point_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title TEXT,
  body TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
