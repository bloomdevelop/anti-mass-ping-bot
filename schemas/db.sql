CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  serverId TEXT,
  pingCount INTEGER DEFAULT 0,
  warnCount INTEGER DEFAULT 0
)
