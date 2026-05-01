import type { Database } from 'sql.js'

type Migration = {
  version: number
  up: (db: Database) => void
}

function queryAll(db: Database, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql)
  if (params.length) stmt.bind(params)
  const results: any[] = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  return results
}

function queryOne(db: Database, sql: string, params: any[] = []): any | null {
  const stmt = db.prepare(sql)
  if (params.length) stmt.bind(params)
  const result = stmt.step() ? stmt.getAsObject() : null
  stmt.free()
  return result
}

function getTableSql(db: Database, tableName: string): string {
  const row = queryOne(db, "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", [tableName]) as { sql?: string } | null
  return String(row?.sql || '')
}

function getTableColumns(db: Database, tableName: string): string[] {
  return queryAll(db, `PRAGMA table_info(${tableName})`).map((row) => String(row.name || ''))
}

function ensureTableColumn(db: Database, tableName: string, columnName: string, columnSql: string): void {
  const columns = new Set(getTableColumns(db, tableName))
  if (columns.has(columnName)) return
  db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`)
}

function ensureSchemaMeta(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)
}

function getCurrentSchemaVersion(db: Database): number {
  ensureSchemaMeta(db)

  const row = queryOne(db, 'SELECT MAX(version) as version FROM schema_meta') as { version?: number } | null
  const schemaMetaVersion = Number(row?.version || 0)
  if (schemaMetaVersion > 0) return schemaMetaVersion

  const userVersionRow = queryOne(db, 'PRAGMA user_version') as { user_version?: number } | null
  return Math.max(0, Number(userVersionRow?.user_version || 0))
}

function recordMigration(db: Database, version: number): void {
  db.run('INSERT OR IGNORE INTO schema_meta (version) VALUES (?)', [version])
  db.run(`PRAGMA user_version = ${version}`)
}

function applyV1Schema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS course_generation_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      intake_session_id INTEGER REFERENCES course_intake_sessions(id) ON DELETE SET NULL,
      topic TEXT NOT NULL,
      familiarity TEXT,
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'running', 'completed', 'failed')),
      phase TEXT NOT NULL DEFAULT 'queued' CHECK(phase IN ('queued', 'roadmap', 'modules', 'finalizing', 'completed', 'failed')),
      progress INTEGER DEFAULT 0,
      summary TEXT,
      error TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS course_intake_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      requested_familiarity TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'collecting', 'ready', 'submitted', 'cancelled')),
      seed_request TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS course_intake_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES course_intake_sessions(id) ON DELETE CASCADE,
      question_key TEXT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS course_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
      overall_rating INTEGER NOT NULL CHECK(overall_rating BETWEEN 1 AND 10),
      clarity_rating INTEGER NOT NULL CHECK(clarity_rating BETWEEN 1 AND 10),
      retention_rating INTEGER NOT NULL CHECK(retention_rating BETWEEN 1 AND 10),
      difficulty_rating INTEGER NOT NULL CHECK(difficulty_rating BETWEEN 1 AND 10),
      continue_interest_rating INTEGER NOT NULL CHECK(continue_interest_rating BETWEEN 1 AND 10),
      notes TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  ensureTableColumn(db, 'course_generation_jobs', 'intake_session_id', 'intake_session_id INTEGER REFERENCES course_intake_sessions(id) ON DELETE SET NULL')
  ensureTableColumn(db, 'course_generation_jobs', 'summary', 'summary TEXT')
  ensureTableColumn(db, 'course_generation_jobs', 'error', 'error TEXT')
  ensureTableColumn(db, 'course_generation_jobs', 'created_at', 'created_at DATETIME')
  ensureTableColumn(db, 'course_generation_jobs', 'updated_at', 'updated_at DATETIME')
  ensureTableColumn(db, 'course_intake_sessions', 'seed_request', 'seed_request TEXT')
  ensureTableColumn(db, 'course_intake_sessions', 'created_at', 'created_at DATETIME')
  ensureTableColumn(db, 'course_intake_sessions', 'updated_at', 'updated_at DATETIME')
  ensureTableColumn(db, 'course_intake_answers', 'question_key', 'question_key TEXT')
  ensureTableColumn(db, 'course_intake_answers', 'created_at', 'created_at DATETIME')
  ensureTableColumn(db, 'course_feedback', 'notes', 'notes TEXT')
  ensureTableColumn(db, 'course_feedback', 'created_at', 'created_at DATETIME')
  ensureTableColumn(db, 'course_feedback', 'updated_at', 'updated_at DATETIME')

  db.run("UPDATE course_generation_jobs SET created_at = COALESCE(created_at, datetime('now', 'localtime')), updated_at = COALESCE(updated_at, datetime('now', 'localtime'))")
  db.run("UPDATE course_intake_sessions SET created_at = COALESCE(created_at, datetime('now', 'localtime')), updated_at = COALESCE(updated_at, datetime('now', 'localtime'))")
  db.run("UPDATE course_intake_answers SET created_at = COALESCE(created_at, datetime('now', 'localtime'))")
  db.run("UPDATE course_feedback SET created_at = COALESCE(created_at, datetime('now', 'localtime')), updated_at = COALESCE(updated_at, datetime('now', 'localtime'))")
}

function addRecommendationJson(db: Database): void {
  ensureTableColumn(db, 'course_feedback', 'recommendation_json', 'recommendation_json TEXT')
}

function upgradeCoursesSchema(db: Database): void {
  const coursesSql = getTableSql(db, 'courses')
  const columns = new Set(getTableColumns(db, 'courses'))
  const needsMigration = !coursesSql.includes("'generating'")
    || !coursesSql.includes("'failed'")
    || !columns.has('generation_summary')
    || !columns.has('generation_progress')
    || !columns.has('generation_phase')
    || !columns.has('generation_error')

  if (!needsMigration) return

  db.run('PRAGMA foreign_keys = OFF')
  db.run(`
    CREATE TABLE courses_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      topic TEXT,
      total_modules INTEGER DEFAULT 0,
      completed_modules INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('generating', 'active', 'completed', 'paused', 'failed')),
      generation_summary TEXT,
      generation_progress INTEGER DEFAULT 0,
      generation_phase TEXT,
      generation_error TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)
  db.run(`
    INSERT INTO courses_new (
      id,
      title,
      description,
      topic,
      total_modules,
      completed_modules,
      status,
      generation_summary,
      generation_progress,
      generation_phase,
      generation_error,
      created_at
    )
    SELECT
      id,
      title,
      description,
      topic,
      total_modules,
      completed_modules,
      CASE
        WHEN status IN ('generating', 'active', 'completed', 'paused', 'failed') THEN status
        ELSE 'active'
      END,
      NULL,
      0,
      NULL,
      NULL,
      created_at
    FROM courses
  `)
  db.run('DROP TABLE courses')
  db.run('ALTER TABLE courses_new RENAME TO courses')
  db.run('PRAGMA foreign_keys = ON')
}

const MIGRATIONS: Migration[] = [
  { version: 1, up: applyV1Schema },
  { version: 2, up: addRecommendationJson },
  { version: 3, up: upgradeCoursesSchema },
]

export function runMigrations(db: Database): void {
  ensureSchemaMeta(db)
  const currentVersion = getCurrentSchemaVersion(db)
  const pending = MIGRATIONS.filter((migration) => migration.version > currentVersion)

  if (pending.length === 0) {
    if (currentVersion > 0) {
      recordMigration(db, currentVersion)
    }
    return
  }

  db.run('BEGIN')
  try {
    for (const migration of pending) {
      migration.up(db)
      recordMigration(db, migration.version)
    }
    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }
}