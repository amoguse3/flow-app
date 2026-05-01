import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import initSqlJs, { type Database } from 'sql.js'
import type { CourseFamiliarity, CourseGenerationJobStatus, CourseGenerationPhase, CourseStatus } from '../../shared/types'
import { runMigrations } from './db-migrations'

let db: Database

const getDbPath = () => join(app.getPath('userData'), 'aura.db')

export async function initDB(): Promise<Database> {
  const SQL = await initSqlJs()
  const dbPath = getDbPath()

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  db.run('PRAGMA journal_mode = WAL')
  db.run('PRAGMA foreign_keys = ON')

  db.run(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      mood TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS user_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'mid' CHECK(priority IN ('low', 'mid', 'high')),
      parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      completed_at DATETIME
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS energy_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 10),
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // --- Educator Engine tables ---
  db.run(`
    CREATE TABLE IF NOT EXISTS courses (
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
      recommendation_json TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      order_num INTEGER NOT NULL,
      pass_threshold REAL DEFAULT 0.8,
      unlocked INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      order_num INTEGER NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS lesson_ai_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      focus_key TEXT NOT NULL DEFAULT '',
      payload TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      UNIQUE(lesson_id, kind, focus_key)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS flashcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      next_review DATETIME DEFAULT (datetime('now', 'localtime')),
      interval_days REAL DEFAULT 1,
      ease_factor REAL DEFAULT 2.5,
      repetitions INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // --- Memory (3-tier: working | episodic | semantic) ---
  db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'episodic' CHECK(kind IN ('working','episodic','semantic')),
      tag TEXT,
      importance INTEGER DEFAULT 3,
      last_recalled DATETIME,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // --- Brain Games ---
  db.run(`
    CREATE TABLE IF NOT EXISTS game_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_type TEXT NOT NULL,
      score INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      time_ms INTEGER NOT NULL,
      date TEXT NOT NULL,
      verified INTEGER DEFAULT 0,
      challenge_hash TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS game_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  runMigrations(db)

  saveDB()
  return db
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function saveDBImmediate() {
  if (!db) return
  const data = db.export()
  writeFileSync(getDbPath(), Buffer.from(data))
}

export function saveDB() {
  if (!db) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveDBImmediate, 300)
}

export function saveDBSync() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  saveDBImmediate()
}

export function getDB(): Database {
  if (!db) throw new Error('Database not initialized. Call initDB() first.')
  return db
}

// --- Messages ---

export function addMessage(role: 'user' | 'assistant', content: string, mood?: string) {
  getDB().run('INSERT INTO messages (role, content, mood) VALUES (?, ?, ?)', [role, content, mood || null])
  saveDB()
}

export function getMessages(limit = 50): Array<{
  id: number; role: string; content: string; mood: string | null; created_at: string
}> {
  const stmt = getDB().prepare('SELECT * FROM messages ORDER BY id DESC LIMIT ?')
  stmt.bind([limit])
  const results: any[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    results.push(row)
  }
  stmt.free()
  return results
}

export function clearMessages() {
  getDB().run('DELETE FROM messages')
  saveDB()
}

// --- User State (JSON key-value) ---

export function getState(key: string): any {
  const stmt = getDB().prepare('SELECT value FROM user_state WHERE key = ?')
  stmt.bind([key])
  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return JSON.parse(row.value as string)
  }
  stmt.free()
  return null
}

export function setState(key: string, value: any) {
  getDB().run('INSERT OR REPLACE INTO user_state (key, value) VALUES (?, ?)', [key, JSON.stringify(value)])
  saveDB()
}

export function deleteState(key: string) {
  getDB().run('DELETE FROM user_state WHERE key = ?', [key])
  saveDB()
}

export function resetUserData(): void {
  const db = getDB()

  db.run('BEGIN TRANSACTION')
  try {
    db.run('DELETE FROM messages')
    db.run('DELETE FROM tasks')
    db.run('DELETE FROM energy_log')
    db.run('DELETE FROM course_feedback')
    db.run('DELETE FROM lesson_ai_cache')
    db.run('DELETE FROM flashcards')
    db.run('DELETE FROM lessons')
    db.run('DELETE FROM modules')
    db.run('DELETE FROM courses')
    db.run('DELETE FROM memories')
    db.run('DELETE FROM game_scores')
    db.run('DELETE FROM game_points')

    for (const key of ['profile', 'motivation', 'tierUsage', 'tokenStats', 'chatTokenUsage', 'syncState']) {
      db.run('DELETE FROM user_state WHERE key = ?', [key])
    }

    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }

  saveDB()
}

// --- Tasks ---

export function getTasks(): Array<{
  id: number; text: string; done: number; priority: string;
  parent_id: number | null; created_at: string; completed_at: string | null
}> {
  const stmt = getDB().prepare('SELECT * FROM tasks ORDER BY created_at DESC')
  const results: any[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results
}

export function addTask(text: string, priority = 'mid', parentId: number | null = null) {
  getDB().run('INSERT INTO tasks (text, priority, parent_id) VALUES (?, ?, ?)', [text, priority, parentId])
  saveDB()
  const stmt = getDB().prepare('SELECT * FROM tasks ORDER BY id DESC LIMIT 1')
  stmt.step()
  const task = stmt.getAsObject()
  stmt.free()
  return task
}

export function toggleTask(id: number) {
  getDB().run(`
    UPDATE tasks SET
      done = CASE WHEN done = 0 THEN 1 ELSE 0 END,
      completed_at = CASE WHEN done = 0 THEN datetime('now', 'localtime') ELSE NULL END
    WHERE id = ?
  `, [id])
  saveDB()
}

export function removeTask(id: number) {
  getDB().run('DELETE FROM tasks WHERE id = ?', [id])
  saveDB()
}

// --- Energy ---

export function logEnergy(level: number) {
  const today = new Date().toISOString().split('T')[0]
  // Delete existing entry for today first, then insert
  getDB().run('DELETE FROM energy_log WHERE date = ?', [today])
  getDB().run('INSERT INTO energy_log (level, date) VALUES (?, ?)', [level, today])
  saveDB()
}

export function getTodayEnergy(): number | null {
  const today = new Date().toISOString().split('T')[0]
  const stmt = getDB().prepare('SELECT level FROM energy_log WHERE date = ? ORDER BY id DESC LIMIT 1')
  stmt.bind([today])
  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return row.level as number
  }
  stmt.free()
  return null
}

// =============================================================
// EDUCATOR ENGINE
// =============================================================

function queryAll(sql: string, params: any[] = []): any[] {
  const stmt = getDB().prepare(sql)
  if (params.length) stmt.bind(params)
  const results: any[] = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  return results
}

function queryOne(sql: string, params: any[] = []): any | null {
  const stmt = getDB().prepare(sql)
  if (params.length) stmt.bind(params)
  const result = stmt.step() ? stmt.getAsObject() : null
  stmt.free()
  return result
}

function getTableSql(tableName: string): string {
  const row = queryOne("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", [tableName]) as { sql?: string } | null
  return String(row?.sql || '')
}

function getTableColumns(tableName: string): string[] {
  return queryAll(`PRAGMA table_info(${tableName})`).map((row) => String(row.name || ''))
}

export function ensureEducatorSchema(): void {
  runMigrations(getDB())
}

function getCourseBaseQuery() {
  return `
    SELECT
      c.*,
      j.id AS generation_job_id,
      j.status AS generation_status,
      j.phase AS generation_phase,
      j.progress AS generation_progress,
      j.summary AS generation_summary,
      j.error AS generation_error,
      j.updated_at AS generation_updated_at
    FROM courses c
    LEFT JOIN course_generation_jobs j
      ON j.id = (
        SELECT id
        FROM course_generation_jobs
        WHERE course_id = c.id
        ORDER BY id DESC
        LIMIT 1
      )
  `
}

// --- Courses ---

export function getCourses(): any[] {
  return queryAll(`${getCourseBaseQuery()} ORDER BY c.created_at DESC, c.id DESC`)
}

export function getCourse(id: number): any | null {
  return queryOne(`${getCourseBaseQuery()} WHERE c.id = ?`, [id])
}

export function createCourse(
  title: string,
  description: string,
  topic: string,
  totalModules: number,
  options: Partial<{
    status: CourseStatus
    generation_summary: string | null
    generation_progress: number
    generation_phase: CourseGenerationPhase | null
    generation_error: string | null
  }> = {},
): any {
  getDB().run(
    'INSERT INTO courses (title, description, topic, total_modules, status, generation_summary, generation_progress, generation_phase, generation_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      title,
      description,
      topic,
      totalModules,
      options.status || 'active',
      options.generation_summary ?? null,
      options.generation_progress ?? 0,
      options.generation_phase ?? null,
      options.generation_error ?? null,
    ]
  )
  saveDB()
  return getCourse(Number(queryOne('SELECT last_insert_rowid() AS id')?.id || 0))
}

export function updateCourse(
  courseId: number,
  updates: Partial<{
    title: string
    description: string
    topic: string
    total_modules: number
    completed_modules: number
    status: CourseStatus
    generation_summary: string | null
    generation_progress: number
    generation_phase: CourseGenerationPhase | null
    generation_error: string | null
  }>,
): any {
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined)
  if (entries.length === 0) return getCourse(courseId)

  const sql = entries.map(([column]) => `${column} = ?`).join(', ')
  getDB().run(`UPDATE courses SET ${sql} WHERE id = ?`, [...entries.map(([, value]) => value), courseId])
  saveDB()
  return getCourse(courseId)
}

export function createCourseGenerationJob(
  courseId: number,
  topic: string,
  familiarity: CourseFamiliarity | null,
  options: Partial<{
    intakeSessionId: number | null
    status: CourseGenerationJobStatus
    phase: CourseGenerationPhase
    progress: number
    summary: string | null
    error: string | null
  }> = {},
): any {
  getDB().run(
    "INSERT INTO course_generation_jobs (course_id, intake_session_id, topic, familiarity, status, phase, progress, summary, error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))",
    [
      courseId,
      options.intakeSessionId ?? null,
      topic,
      familiarity ?? null,
      options.status || 'queued',
      options.phase || 'queued',
      options.progress ?? 0,
      options.summary ?? null,
      options.error ?? null,
    ],
  )
  saveDB()
  return queryOne('SELECT * FROM course_generation_jobs ORDER BY id DESC LIMIT 1')
}

export function getLatestCourseGenerationJobForCourse(courseId: number): any | null {
  return queryOne('SELECT * FROM course_generation_jobs WHERE course_id = ? ORDER BY id DESC LIMIT 1', [courseId])
}

export function getInterruptedCourseGenerationJobs(): any[] {
  return queryAll(`
    SELECT
      j.*,
      c.status AS course_status,
      c.generation_summary AS course_generation_summary,
      c.generation_progress AS course_generation_progress
    FROM course_generation_jobs j
    JOIN courses c ON c.id = j.course_id
    JOIN (
      SELECT course_id, MAX(id) AS latest_id
      FROM course_generation_jobs
      GROUP BY course_id
    ) latest ON latest.latest_id = j.id
    WHERE c.status = 'generating'
       OR j.status IN ('queued', 'running')
  `)
}

export function updateCourseGenerationJob(
  jobId: number,
  updates: Partial<{
    status: CourseGenerationJobStatus
    phase: CourseGenerationPhase
    progress: number
    summary: string | null
    error: string | null
  }>,
): any {
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined)
  if (entries.length === 0) {
    return queryOne('SELECT * FROM course_generation_jobs WHERE id = ?', [jobId])
  }

  const sql = entries.map(([column]) => `${column} = ?`).join(', ')
  getDB().run(
    `UPDATE course_generation_jobs SET ${sql}, updated_at = datetime('now', 'localtime') WHERE id = ?`,
    [...entries.map(([, value]) => value), jobId],
  )
  saveDB()
  return queryOne('SELECT * FROM course_generation_jobs WHERE id = ?', [jobId])
}

export function createCourseIntakeSession(
  topic: string,
  requestedFamiliarity: CourseFamiliarity | null,
  seedRequest: unknown,
  status: 'draft' | 'collecting' | 'ready' | 'submitted' | 'cancelled' = 'collecting',
): any {
  getDB().run(
    "INSERT INTO course_intake_sessions (topic, requested_familiarity, status, seed_request, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))",
    [topic, requestedFamiliarity ?? null, status, JSON.stringify(seedRequest ?? null)],
  )
  saveDB()
  return queryOne('SELECT * FROM course_intake_sessions ORDER BY id DESC LIMIT 1')
}

export function updateCourseIntakeSession(
  sessionId: number,
  updates: Partial<{
    status: 'draft' | 'collecting' | 'ready' | 'submitted' | 'cancelled'
    seed_request: string | null
  }>,
): any {
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined)
  if (entries.length === 0) {
    return queryOne('SELECT * FROM course_intake_sessions WHERE id = ?', [sessionId])
  }

  const sql = entries.map(([column]) => `${column} = ?`).join(', ')
  getDB().run(
    `UPDATE course_intake_sessions SET ${sql}, updated_at = datetime('now', 'localtime') WHERE id = ?`,
    [...entries.map(([, value]) => value), sessionId],
  )
  saveDB()
  return queryOne('SELECT * FROM course_intake_sessions WHERE id = ?', [sessionId])
}

export function clearCourseIntakeAnswers(sessionId: number): void {
  getDB().run('DELETE FROM course_intake_answers WHERE session_id = ?', [sessionId])
  saveDB()
}

export function getCourseIntakeAnswers(sessionId: number): any[] {
  return queryAll('SELECT * FROM course_intake_answers WHERE session_id = ? ORDER BY id', [sessionId])
}

export function addCourseIntakeAnswer(sessionId: number, questionKey: string | null, question: string, answer: string): any {
  getDB().run(
    "INSERT INTO course_intake_answers (session_id, question_key, question, answer, created_at) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))",
    [sessionId, questionKey ?? null, question, answer],
  )
  saveDB()
  return queryOne('SELECT * FROM course_intake_answers ORDER BY id DESC LIMIT 1')
}

export function resetCourseForGenerationRetry(
  courseId: number,
  updates: Partial<{
    title: string
    description: string
    status: CourseStatus
    generation_summary: string | null
    generation_progress: number
    generation_phase: CourseGenerationPhase | null
    generation_error: string | null
  }> = {},
): any {
  getDB().run('DELETE FROM modules WHERE course_id = ?', [courseId])
  const nextCourse = updateCourse(courseId, {
    total_modules: 0,
    completed_modules: 0,
    status: updates.status ?? 'generating',
    generation_summary: updates.generation_summary ?? null,
    generation_progress: updates.generation_progress ?? 0,
    generation_phase: updates.generation_phase ?? 'queued',
    generation_error: updates.generation_error ?? null,
    title: updates.title,
    description: updates.description,
  })
  saveDB()
  return nextCourse
}

export function getCourseFeedback(courseId: number): any | null {
  return queryOne('SELECT * FROM course_feedback WHERE course_id = ?', [courseId])
}

export function listCourseFeedback(): any[] {
  return queryAll(`
    SELECT
      f.*,
      c.title AS course_title,
      c.topic AS course_topic,
      c.status AS course_status,
      c.created_at AS course_created_at
    FROM course_feedback f
    JOIN courses c ON c.id = f.course_id
    ORDER BY datetime(f.updated_at) DESC, f.id DESC
  `)
}

export function upsertCourseFeedback(
  courseId: number,
  feedback: {
    overall_rating: number
    clarity_rating: number
    retention_rating: number
    difficulty_rating: number
    continue_interest_rating: number
    notes?: string | null
    recommendation?: unknown
  },
): any {
  const existing = getCourseFeedback(courseId)
  const serializedRecommendation = feedback.recommendation === undefined
    ? existing?.recommendation_json ?? null
    : JSON.stringify(feedback.recommendation ?? null)

  if (existing) {
    getDB().run(
      `UPDATE course_feedback
       SET overall_rating = ?,
           clarity_rating = ?,
           retention_rating = ?,
           difficulty_rating = ?,
           continue_interest_rating = ?,
           notes = ?,
           recommendation_json = ?,
           updated_at = datetime('now', 'localtime')
       WHERE course_id = ?`,
      [
        feedback.overall_rating,
        feedback.clarity_rating,
        feedback.retention_rating,
        feedback.difficulty_rating,
        feedback.continue_interest_rating,
        feedback.notes ?? null,
        serializedRecommendation,
        courseId,
      ],
    )
  } else {
    getDB().run(
      `INSERT INTO course_feedback (
        course_id,
        overall_rating,
        clarity_rating,
        retention_rating,
        difficulty_rating,
        continue_interest_rating,
        notes,
        recommendation_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`,
      [
        courseId,
        feedback.overall_rating,
        feedback.clarity_rating,
        feedback.retention_rating,
        feedback.difficulty_rating,
        feedback.continue_interest_rating,
        feedback.notes ?? null,
        serializedRecommendation,
      ],
    )
  }

  saveDB()
  return getCourseFeedback(courseId)
}

export function updateCourseFeedbackRecommendation(courseId: number, recommendation: unknown): any {
  getDB().run(
    `UPDATE course_feedback
     SET recommendation_json = ?,
         updated_at = datetime('now', 'localtime')
     WHERE course_id = ?`,
    [JSON.stringify(recommendation ?? null), courseId],
  )
  saveDB()
  return getCourseFeedback(courseId)
}

export function updateCourseProgress(courseId: number) {
  const completed = queryOne(
    'SELECT COUNT(*) as cnt FROM modules WHERE course_id = ? AND completed = 1',
    [courseId]
  )
  const total = queryOne(
    'SELECT COUNT(*) as cnt FROM modules WHERE course_id = ?',
    [courseId]
  )
  const allDone = completed?.cnt === total?.cnt && total?.cnt > 0
  getDB().run(
    'UPDATE courses SET completed_modules = ?, status = ?, generation_error = NULL WHERE id = ?',
    [completed?.cnt || 0, allDone ? 'completed' : 'active', courseId]
  )
  saveDB()
}

export function deleteCourse(courseId: number) {
  getDB().run('DELETE FROM courses WHERE id = ?', [courseId])
  saveDB()
}

// --- Modules ---

export function getModule(id: number): any | null {
  return queryOne('SELECT * FROM modules WHERE id = ?', [id])
}

export function getModules(courseId: number): any[] {
  return queryAll('SELECT * FROM modules WHERE course_id = ? ORDER BY order_num', [courseId])
}

export function createModule(courseId: number, title: string, orderNum: number): any {
  const unlocked = orderNum === 1 ? 1 : 0
  getDB().run(
    'INSERT INTO modules (course_id, title, order_num, unlocked) VALUES (?, ?, ?, ?)',
    [courseId, title, orderNum, unlocked]
  )
  saveDB()
  return queryOne('SELECT * FROM modules ORDER BY id DESC LIMIT 1')
}

export function completeModule(moduleId: number) {
  getDB().run('UPDATE modules SET completed = 1 WHERE id = ?', [moduleId])
  // Unlock next module
  const mod = queryOne('SELECT * FROM modules WHERE id = ?', [moduleId])
  if (mod) {
    getDB().run(
      'UPDATE modules SET unlocked = 1 WHERE course_id = ? AND order_num = ?',
      [mod.course_id, mod.order_num + 1]
    )
    updateCourseProgress(mod.course_id)
  }
  saveDB()
}

// --- Lessons ---

export function getLessons(moduleId: number): any[] {
  return queryAll('SELECT * FROM lessons WHERE module_id = ? ORDER BY order_num', [moduleId])
}

export function getLesson(lessonId: number): any {
  return queryOne('SELECT * FROM lessons WHERE id = ?', [lessonId])
}

export function getCompletedLessonsCount(): number {
  const row = queryOne('SELECT COUNT(*) as cnt FROM lessons WHERE completed = 1') as { cnt?: number | string } | null
  return Number(row?.cnt || 0)
}

export function createLesson(moduleId: number, title: string, content: string, orderNum: number): any {
  getDB().run(
    'INSERT INTO lessons (module_id, title, content, order_num) VALUES (?, ?, ?, ?)',
    [moduleId, title, content, orderNum]
  )
  saveDB()
  return queryOne('SELECT * FROM lessons ORDER BY id DESC LIMIT 1')
}

export function updateLessonContent(lessonId: number, content: string): any {
  getDB().run('UPDATE lessons SET content = ? WHERE id = ?', [content, lessonId])
  saveDB()
  return getLesson(lessonId)
}

export function completeLesson(lessonId: number) {
  getDB().run('UPDATE lessons SET completed = 1 WHERE id = ?', [lessonId])
  saveDB()
}

export function getLessonAICache(lessonId: number, kind: string, focusKey = ''): any | null {
  const row = queryOne(
    'SELECT payload FROM lesson_ai_cache WHERE lesson_id = ? AND kind = ? AND focus_key = ? LIMIT 1',
    [lessonId, kind, focusKey],
  ) as { payload?: string } | null

  if (!row?.payload) return null

  try {
    return JSON.parse(row.payload)
  } catch {
    return null
  }
}

export function setLessonAICache(lessonId: number, kind: string, payload: unknown, focusKey = ''): void {
  getDB().run(
    'INSERT OR REPLACE INTO lesson_ai_cache (lesson_id, kind, focus_key, payload) VALUES (?, ?, ?, ?)',
    [lessonId, kind, focusKey, JSON.stringify(payload)],
  )
  saveDB()
}

export function clearLessonAICache(lessonId: number, kind?: string): void {
  if (kind) {
    getDB().run('DELETE FROM lesson_ai_cache WHERE lesson_id = ? AND kind = ?', [lessonId, kind])
  } else {
    getDB().run('DELETE FROM lesson_ai_cache WHERE lesson_id = ?', [lessonId])
  }
  saveDB()
}

// --- Flashcards (SM-2 Spaced Repetition) ---

export function getFlashcards(moduleId: number): any[] {
  return queryAll('SELECT * FROM flashcards WHERE module_id = ? ORDER BY next_review', [moduleId])
}

export function getDueFlashcards(moduleId: number): any[] {
  return queryAll(
    "SELECT * FROM flashcards WHERE module_id = ? AND next_review <= datetime('now', 'localtime') ORDER BY next_review",
    [moduleId]
  )
}

export function getAllDueFlashcards(): any[] {
  return queryAll(
    "SELECT f.*, m.title as module_title, c.title as course_title FROM flashcards f JOIN modules m ON f.module_id = m.id JOIN courses c ON m.course_id = c.id WHERE f.next_review <= datetime('now', 'localtime') ORDER BY f.next_review LIMIT 30"
  )
}

export function createFlashcard(moduleId: number, front: string, back: string): any {
  getDB().run(
    'INSERT INTO flashcards (module_id, front, back) VALUES (?, ?, ?)',
    [moduleId, front, back]
  )
  saveDB()
  return queryOne('SELECT * FROM flashcards ORDER BY id DESC LIMIT 1')
}

// =============================================================
// MEMORY (3-tier)
// =============================================================

export type MemoryKind = 'working' | 'episodic' | 'semantic'

export interface MemoryRow {
  id: number
  content: string
  kind: MemoryKind
  tag: string | null
  importance: number
  last_recalled: string | null
  created_at: string
}

export function listMemories(kind?: MemoryKind): MemoryRow[] {
  if (kind) {
    return queryAll('SELECT * FROM memories WHERE kind = ? ORDER BY importance DESC, created_at DESC', [kind]) as MemoryRow[]
  }
  return queryAll('SELECT * FROM memories ORDER BY importance DESC, created_at DESC') as MemoryRow[]
}

export function addMemory(content: string, kind: MemoryKind = 'episodic', tag: string | null = null, importance = 3): MemoryRow {
  const trimmed = (content || '').trim()
  if (!trimmed) throw new Error('Empty memory')
  const imp = Math.max(1, Math.min(5, importance | 0))
  getDB().run(
    'INSERT INTO memories (content, kind, tag, importance) VALUES (?, ?, ?, ?)',
    [trimmed.slice(0, 500), kind, tag, imp]
  )
  saveDB()
  return queryOne('SELECT * FROM memories ORDER BY id DESC LIMIT 1') as MemoryRow
}

export function deleteMemory(id: number): void {
  getDB().run('DELETE FROM memories WHERE id = ?', [id])
  saveDB()
}

export function markMemoryRecalled(id: number): void {
  getDB().run(
    "UPDATE memories SET last_recalled = datetime('now', 'localtime') WHERE id = ?",
    [id]
  )
  saveDB()
}

/**
 * Garbage-collect working memory: anything older than 6 hours migrates
 * down to episodic (if it has importance >= 3) or is deleted.
 */
export function decayMemories(): void {
  // Promote important working memories → episodic
  getDB().run(`
    UPDATE memories
       SET kind = 'episodic'
     WHERE kind = 'working'
       AND importance >= 3
       AND datetime(created_at) < datetime('now', 'localtime', '-6 hours')
  `)
  // Drop stale low-importance working memories
  getDB().run(`
    DELETE FROM memories
     WHERE kind = 'working'
       AND importance < 3
       AND datetime(created_at) < datetime('now', 'localtime', '-6 hours')
  `)
  saveDB()
}

/**
 * Pick one callback-worthy memory (episodic, old, high importance, not recently
 * recalled). Returns null if none available.
 */
export function pickCallbackMemory(): MemoryRow | null {
  // Prefer memories that are ≥ 2 days old and haven't been recalled in 24h
  const row = queryOne(`
    SELECT * FROM memories
     WHERE kind = 'episodic'
       AND datetime(created_at) < datetime('now', 'localtime', '-2 days')
       AND (last_recalled IS NULL OR datetime(last_recalled) < datetime('now', 'localtime', '-1 day'))
     ORDER BY importance DESC, RANDOM()
     LIMIT 1
  `) as MemoryRow | null
  return row
}

export function getSemanticFacts(): MemoryRow[] {
  return queryAll('SELECT * FROM memories WHERE kind = ? ORDER BY importance DESC, created_at ASC', ['semantic']) as MemoryRow[]
}

// =============================================================
// Below: flashcard SM-2 review (unchanged)
// =============================================================

export function reviewFlashcard(id: number, quality: number) {
  // SM-2 algorithm: quality 0-5 (0-2 = fail, 3-5 = pass)
  const card = queryOne('SELECT * FROM flashcards WHERE id = ?', [id])
  if (!card) return

  let { ease_factor, interval_days, repetitions } = card
  ease_factor = ease_factor as number
  interval_days = interval_days as number
  repetitions = repetitions as number

  if (quality >= 3) {
    // Correct
    if (repetitions === 0) {
      interval_days = 1
    } else if (repetitions === 1) {
      interval_days = 3
    } else {
      interval_days = Math.round(interval_days * ease_factor)
    }
    repetitions += 1
  } else {
    // Incorrect — reset
    repetitions = 0
    interval_days = 1
  }

  // Update ease factor (SM-2 formula)
  ease_factor = Math.max(1.3,
    ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  )

  getDB().run(
    "UPDATE flashcards SET ease_factor = ?, interval_days = ?, repetitions = ?, next_review = datetime('now', 'localtime', '+' || ? || ' days') WHERE id = ?",
    [ease_factor, interval_days, repetitions, interval_days, id]
  )
  saveDB()
}


