CREATE TABLE devices (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  token_hash bytea NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE pairing_codes (
  code_hash bytea PRIMARY KEY,
  telegram_user_id bigint NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pairing_codes_expiry_idx ON pairing_codes (expires_at);

CREATE TABLE catalog (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  accounts jsonb NOT NULL,
  categories jsonb NOT NULL,
  currencies jsonb NOT NULL,
  updated_by uuid NOT NULL REFERENCES devices(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE telegram_updates (
  update_id bigint PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bot_sessions (
  telegram_user_id bigint PRIMARY KEY,
  chat_id bigint NOT NULL,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pending_entries (
  id uuid PRIMARY KEY,
  telegram_user_id bigint NOT NULL,
  kind text NOT NULL CHECK (kind IN ('expense', 'income')),
  account_id text NOT NULL,
  category_id text NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0 AND amount <= 1000000000000),
  entry_date date NOT NULL,
  note text NOT NULL CHECK (length(note) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz
);
CREATE INDEX pending_entries_unacked_idx ON pending_entries (created_at, id)
  WHERE acknowledged_at IS NULL;
