import { ipcMain } from 'electron'
import { createHmac, randomBytes } from 'crypto'
import { getDB, saveDB } from './db'
import type { GameType, GameDifficulty, GameChallenge, GameChallengeSeed, GameResult, GameAction } from '../../shared/types'

// Secret key for HMAC — generated once per app install, stored in memory
// Even if someone inspects the renderer, they can't forge scores without this
const SECRET_KEY = randomBytes(32).toString('hex')

// Active challenges (in-memory, can't be tampered via DevTools)
const activeChallenges = new Map<string, {
  challenge: GameChallenge
  expectedAnswers: any[]
  issuedAt: number
}>()

// --- Challenge Generators (all logic in main process) ---

// Difficulty multipliers: harder problems, less time, more rounds
const DIFFICULTY_CONFIG: Record<GameDifficulty, { timeMultiplier: number; rangeMultiplier: number; countMultiplier: number; pointsMultiplier: number }> = {
  normal: { timeMultiplier: 1, rangeMultiplier: 1, countMultiplier: 1, pointsMultiplier: 1 },
  x2: { timeMultiplier: 0.75, rangeMultiplier: 2, countMultiplier: 1.5, pointsMultiplier: 2 },
  x3: { timeMultiplier: 0.6, rangeMultiplier: 3, countMultiplier: 2, pointsMultiplier: 3 },
  x5: { timeMultiplier: 0.45, rangeMultiplier: 5, countMultiplier: 2.5, pointsMultiplier: 5 }
}

function normalizeSeedText(value: unknown, maxLength = 24): string | null {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (normalized.length < 3 || normalized.length > maxLength) {
    return null
  }

  return normalized.toUpperCase()
}

function buildSeedWordPool(seed?: GameChallengeSeed | null): string[] {
  if (!seed) return []

  const tokens = [
    ...(Array.isArray(seed.words) ? seed.words : []),
    ...(Array.isArray(seed.phrases) ? seed.phrases.flatMap((phrase) => String(phrase || '').split(/\s+/)) : []),
  ]

  const unique: string[] = []
  for (const token of tokens) {
    const normalized = normalizeSeedText(token, 16)
    if (!normalized) continue
    if (unique.includes(normalized)) continue
    unique.push(normalized)
    if (unique.length >= 14) break
  }

  return unique
}

function generateMathSpeed(diff: GameDifficulty = 'normal'): { data: any; answers: any[] } {
  const cfg = DIFFICULTY_CONFIG[diff]
  const problems: Array<{ a: number; b: number; op: string; answer: number }> = []
  const ops = diff === 'normal' ? ['+', '-', '×'] : ['+', '-', '×', '÷']
  const count = Math.floor(20 * cfg.countMultiplier)
  const range = Math.floor(50 * cfg.rangeMultiplier)

  for (let i = 0; i < count; i++) {
    const op = ops[Math.floor(Math.random() * ops.length)]
    let a: number, b: number, answer: number
    if (op === '+') {
      a = Math.floor(Math.random() * range) + 1
      b = Math.floor(Math.random() * range) + 1
      answer = a + b
    } else if (op === '-') {
      a = Math.floor(Math.random() * range) + 20
      b = Math.floor(Math.random() * a) + 1
      answer = a - b
    } else if (op === '÷') {
      b = Math.floor(Math.random() * 12) + 2
      answer = Math.floor(Math.random() * 12) + 1
      a = b * answer
    } else {
      a = Math.floor(Math.random() * Math.min(12 * cfg.rangeMultiplier, 30)) + 2
      b = Math.floor(Math.random() * Math.min(12 * cfg.rangeMultiplier, 30)) + 2
      answer = a * b
    }
    problems.push({ a, b, op, answer })
  }
  return {
    data: { problems: problems.map(p => ({ a: p.a, b: p.b, op: p.op })), timeLimit: Math.floor(60000 * cfg.timeMultiplier), difficulty: diff },
    answers: problems.map(p => p.answer)
  }
}

function generateMemoryTiles(diff: GameDifficulty = 'normal'): { data: any; answers: any[] } {
  const cfg = DIFFICULTY_CONFIG[diff]
  const gridSize = diff === 'x5' ? 6 : diff === 'x3' ? 5 : 4
  const roundCount = Math.floor(10 * cfg.countMultiplier)
  const rounds: Array<{ tiles: number[]; showTime: number }> = []
  for (let r = 0; r < roundCount; r++) {
    const count = Math.min(3 + Math.floor(r / 2) + (diff === 'normal' ? 0 : 2), gridSize * gridSize - 2)
    const tiles: number[] = []
    while (tiles.length < count) {
      const t = Math.floor(Math.random() * (gridSize * gridSize))
      if (!tiles.includes(t)) tiles.push(t)
    }
    rounds.push({ tiles: tiles.sort((a, b) => a - b), showTime: Math.max(Math.floor((1500 - r * 100) * cfg.timeMultiplier), 300) })
  }
  return {
    data: { gridSize, rounds: rounds.map(r => ({ count: r.tiles.length, showTime: r.showTime })), timeLimit: Math.floor(120000 * cfg.timeMultiplier), difficulty: diff },
    answers: rounds.map(r => r.tiles)
  }
}

function generatePatternMatch(diff: GameDifficulty = 'normal'): { data: any; answers: any[] } {
  const cfg = DIFFICULTY_CONFIG[diff]
  const count = Math.floor(15 * cfg.countMultiplier)
  const rounds: Array<{ sequence: number[]; answer: number }> = []
  for (let i = 0; i < count; i++) {
    const start = Math.floor(Math.random() * (10 * cfg.rangeMultiplier))
    const step = Math.floor(Math.random() * (5 * cfg.rangeMultiplier)) + 1
    const seqLen = diff === 'normal' ? 4 : diff === 'x2' ? 3 : 3 // Fewer clues on harder
    const sequence = Array.from({ length: seqLen }, (_, j) => start + step * j)
    const answer = start + step * seqLen
    rounds.push({ sequence, answer })
  }
  return {
    data: { rounds: rounds.map(r => ({ sequence: r.sequence })), timeLimit: Math.floor(90000 * cfg.timeMultiplier), difficulty: diff },
    answers: rounds.map(r => r.answer)
  }
}

function generateReactionTime(diff: GameDifficulty = 'normal'): { data: any; answers: any[] } {
  const cfg = DIFFICULTY_CONFIG[diff]
  const count = Math.floor(10 * cfg.countMultiplier)
  const delays: number[] = []
  for (let i = 0; i < count; i++) {
    delays.push(500 + Math.floor(Math.random() * (3000 / cfg.rangeMultiplier)))
  }
  return {
    data: { rounds: count, timeLimit: Math.floor(60000 * cfg.timeMultiplier), difficulty: diff },
    answers: delays
  }
}

function generateWordScramble(diff: GameDifficulty = 'normal', seed?: GameChallengeSeed | null): { data: any; answers: any[] } {
  const defaultWords = [
    'PROGRAM', 'LOGIC', 'MEMORY', 'BRAIN', 'INTELLIGENCE',
    'ALGORITHM', 'FUNCTION', 'VARIABLE', 'SCIENCE', 'THINKING',
    'SOLVING', 'ATTENTION', 'FOCUS', 'EDUCATION', 'LEARNING'
  ]
  const cfg = DIFFICULTY_CONFIG[diff]
  const count = Math.floor(10 * cfg.countMultiplier)
  const seededWords = buildSeedWordPool(seed)
  const wordPool = seededWords.length >= 4
    ? Array.from(new Set([...seededWords, ...defaultWords]))
    : defaultWords
  const selected = wordPool.sort(() => Math.random() - 0.5).slice(0, count)
  const scrambled = selected.map(w => {
    const arr = w.split('')
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    // Make sure it's actually scrambled
    if (arr.join('') === w) { [arr[0], arr[1]] = [arr[1], arr[0]] }
    return arr.join('')
  })
  return {
    data: { words: scrambled, timeLimit: Math.floor(120000 * cfg.timeMultiplier), difficulty: diff, seeded: seededWords.length > 0 },
    answers: selected
  }
}

function generateColorStroop(diff: GameDifficulty = 'normal'): { data: any; answers: any[] } {
  const colors = ['red', 'blue', 'green', 'yellow', 'orange']
  const hexColors: Record<string, string> = {
    red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
    yellow: '#eab308', orange: '#f97316'
  }
  const cfg = DIFFICULTY_CONFIG[diff]
  const count = Math.floor(20 * cfg.countMultiplier)
  const rounds: Array<{ text: string; displayColor: string; correctColor: string }> = []
  for (let i = 0; i < count; i++) {
    const textIdx = Math.floor(Math.random() * colors.length)
    let colorIdx = Math.floor(Math.random() * colors.length)
    // Higher difficulty = more mismatches (harder stroop effect)
    const mismatchChance = diff === 'normal' ? 0.6 : diff === 'x2' ? 0.75 : 0.85
    if (Math.random() < mismatchChance) {
      while (colorIdx === textIdx) colorIdx = Math.floor(Math.random() * colors.length)
    }
    rounds.push({
      text: colors[textIdx],
      displayColor: hexColors[colors[colorIdx]],
      correctColor: colors[colorIdx]
    })
  }
  return {
    data: { rounds: rounds.map(r => ({ text: r.text, displayColor: r.displayColor, options: colors })), timeLimit: Math.floor(45000 * cfg.timeMultiplier), difficulty: diff },
    answers: rounds.map(r => r.correctColor)
  }
}

const GENERATORS: Record<GameType, (diff: GameDifficulty, seed?: GameChallengeSeed | null) => { data: any; answers: any[] }> = {
  math_speed: generateMathSpeed,
  memory_tiles: generateMemoryTiles,
  pattern_match: generatePatternMatch,
  reaction_time: generateReactionTime,
  word_scramble: generateWordScramble,
  color_stroop: generateColorStroop
}

// Max scores per game type (for anti-cheat validation)
const MAX_SCORES: Record<GameType, number> = {
  math_speed: 2000,      // 20 problems × 100 points max
  memory_tiles: 1000,    // 10 rounds × 100 points
  pattern_match: 1500,   // 15 rounds × 100 points
  reaction_time: 1000,   // 10 rounds, scored by speed
  word_scramble: 1000,   // 10 words × 100 points
  color_stroop: 2000     // 20 rounds × 100 points
}

// Minimum humanly possible time per game (ms) — anti-bot
const MIN_TIMES: Record<GameType, number> = {
  math_speed: 8000,     // 8 seconds minimum for 20 math problems
  memory_tiles: 10000,
  pattern_match: 8000,
  reaction_time: 3000,  // 10 × 150ms minimum human reaction
  word_scramble: 10000,
  color_stroop: 5000
}

function signChallenge(id: string, gameType: string, timestamp: number): string {
  return createHmac('sha256', SECRET_KEY)
    .update(`${id}:${gameType}:${timestamp}`)
    .digest('hex')
}

function verifyChallenge(id: string, gameType: string, timestamp: number, hash: string): boolean {
  const expected = signChallenge(id, gameType, timestamp)
  return expected === hash
}

// --- Score Verification ---

function verifyScore(
  gameType: GameType,
  actions: GameAction[],
  expectedAnswers: any[],
  claimedScore: number,
  timeMs: number,
  issuedAt: number,
  completedAt: number
): { verified: boolean; actualScore: number } {
  // 1. Time check — can't be faster than humanly possible
  const elapsed = completedAt - issuedAt
  if (elapsed < MIN_TIMES[gameType]) {
    return { verified: false, actualScore: 0 }
  }

  // 2. Time check — can't exceed the allowed time by much (5s grace)
  const challenge = activeChallenges.get(actions[0]?.value?.challengeId || '')
  const maxTime = challenge?.challenge.maxTimeMs || 120000
  if (elapsed > maxTime + 5000) {
    return { verified: false, actualScore: 0 }
  }

  // 3. Score ceiling check
  if (claimedScore > MAX_SCORES[gameType]) {
    return { verified: false, actualScore: 0 }
  }

  // 4. Replay verification — recalculate score from actions
  let actualScore = 0

  switch (gameType) {
    case 'math_speed': {
      const answerActions = actions.filter(a => a.type === 'answer')
      answerActions.forEach((action, i) => {
        if (i < expectedAnswers.length && Number(action.value) === expectedAnswers[i]) {
          // Bonus for speed: up to 100 points per problem
          const timeBetween = i > 0 ? action.timestamp - answerActions[i - 1].timestamp : action.timestamp - issuedAt
          const speedBonus = Math.max(0, Math.floor(100 * (1 - timeBetween / 10000)))
          actualScore += Math.max(50, speedBonus) // minimum 50 for correct
        }
      })
      break
    }
    case 'memory_tiles': {
      const roundActions = actions.filter(a => a.type === 'round_complete')
      roundActions.forEach((action, i) => {
        if (i < expectedAnswers.length) {
          const userTiles = (action.value as number[]).sort((a: number, b: number) => a - b)
          const expected = expectedAnswers[i]
          const correct = JSON.stringify(userTiles) === JSON.stringify(expected)
          if (correct) actualScore += 100
        }
      })
      break
    }
    case 'pattern_match': {
      const answers = actions.filter(a => a.type === 'answer')
      answers.forEach((action, i) => {
        if (i < expectedAnswers.length && Number(action.value) === expectedAnswers[i]) {
          actualScore += 100
        }
      })
      break
    }
    case 'reaction_time': {
      const clicks = actions.filter(a => a.type === 'reaction')
      clicks.forEach((action) => {
        const reactionMs = Number(action.value)
        // Score: faster = more points, max 100 per round
        if (reactionMs >= 100 && reactionMs <= 2000) { // 100ms min (human limit)
          actualScore += Math.max(0, Math.floor(100 * (1 - reactionMs / 1000)))
        }
        // If reaction < 100ms, likely bot — give 0
      })
      break
    }
    case 'word_scramble': {
      const answers = actions.filter(a => a.type === 'answer')
      answers.forEach((action, i) => {
        if (i < expectedAnswers.length &&
          String(action.value).toUpperCase() === expectedAnswers[i]) {
          actualScore += 100
        }
      })
      break
    }
    case 'color_stroop': {
      const answers = actions.filter(a => a.type === 'answer')
      answers.forEach((action, i) => {
        if (i < expectedAnswers.length && action.value === expectedAnswers[i]) {
          const timeBetween = i > 0 ? action.timestamp - answers[i - 1].timestamp : action.timestamp - issuedAt
          const speedBonus = Math.max(0, Math.floor(100 * (1 - timeBetween / 5000)))
          actualScore += Math.max(50, speedBonus)
        }
      })
      break
    }
  }

  // 5. Claimed score must match actual (within 5% tolerance for timing rounding)
  const tolerance = Math.max(actualScore * 0.05, 10)
  const verified = Math.abs(claimedScore - actualScore) <= tolerance

  return { verified, actualScore }
}

// --- Points Calculation ---

function calculatePoints(gameType: GameType, score: number, maxScore: number, difficulty: GameDifficulty = 'normal'): number {
  const ratio = score / maxScore
  const multiplier = DIFFICULTY_CONFIG[difficulty].pointsMultiplier
  // Base: 10 points per game, bonus for high scores, multiplied by difficulty
  let points = Math.floor(10 * ratio * multiplier)
  if (ratio >= 0.9) points += Math.floor(5 * multiplier)  // Excellence bonus
  if (ratio >= 0.7) points += Math.floor(3 * multiplier)  // Good bonus
  return points
}

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

export function registerGamesIpc() {
  // Start a new challenge — all game data generated server-side
  ipcMain.handle('games:startChallenge', async (_event, gameType: GameType, difficulty: GameDifficulty = 'normal', seed?: GameChallengeSeed | null) => {
    if (!GENERATORS[gameType]) throw new Error('Invalid game type')

    const id = randomBytes(16).toString('hex')
    const now = Date.now()
    const { data, answers } = GENERATORS[gameType](difficulty, seed)
    const hash = signChallenge(id, gameType, now)

    const challenge: GameChallenge = {
      id: `${id}:${hash}`,
      gameType,
      difficulty,
      data,
      startedAt: now,
      maxTimeMs: data.timeLimit || 120000
    }

    // Store challenge + answers in main process memory (not accessible from renderer)
    activeChallenges.set(challenge.id, {
      challenge,
      expectedAnswers: answers,
      issuedAt: now
    })

    // Auto-expire challenges after maxTime + 30s
    setTimeout(() => {
      activeChallenges.delete(challenge.id)
    }, challenge.maxTimeMs + 30000)

    return challenge
  })

  // Submit game result — verify and score
  ipcMain.handle('games:submitResult', async (_event, result: GameResult) => {
    const stored = activeChallenges.get(result.challengeId)
    if (!stored) {
      return { verified: false, score: 0, points: 0 }
    }

    const { challenge, expectedAnswers, issuedAt } = stored

    // Verify the challenge ID signature
    const [id, hash] = challenge.id.split(':').length >= 2
      ? [challenge.id.substring(0, 32), challenge.id.substring(33)]
      : ['', '']
    if (!verifyChallenge(id, challenge.gameType, issuedAt, hash)) {
      return { verified: false, score: 0, points: 0 }
    }

    // Verify score
    const { verified, actualScore } = verifyScore(
      challenge.gameType,
      result.actions,
      expectedAnswers,
      result.claimedScore,
      result.completedAt - issuedAt,
      issuedAt,
      result.completedAt
    )

    // Remove used challenge
    activeChallenges.delete(result.challengeId)

    const finalScore = verified ? actualScore : 0
    const maxScore = MAX_SCORES[challenge.gameType]
    const points = verified ? calculatePoints(challenge.gameType, finalScore, maxScore, challenge.difficulty) : 0

    if (verified && finalScore > 0) {
      const today = new Date().toISOString().split('T')[0]
      const challengeHash = signChallenge(String(finalScore), challenge.gameType, result.completedAt)

      // Save verified score
      getDB().run(
        'INSERT INTO game_scores (game_type, score, max_score, time_ms, date, verified, challenge_hash) VALUES (?, ?, ?, ?, ?, 1, ?)',
        [challenge.gameType, finalScore, maxScore, result.completedAt - issuedAt, today, challengeHash]
      )

      // Save points
      if (points > 0) {
        getDB().run(
          'INSERT INTO game_points (amount, reason, date) VALUES (?, ?, ?)',
          [points, `${challenge.gameType}_score`, today]
        )
      }

      saveDB()
    }

    return { verified, score: finalScore, points }
  })

  // Get today's scores
  ipcMain.handle('games:getDailyScores', async () => {
    const today = new Date().toISOString().split('T')[0]
    return queryAll(
      'SELECT * FROM game_scores WHERE date = ? AND verified = 1 ORDER BY score DESC',
      [today]
    )
  })

  // Get leaderboard (best score per game per day)
  ipcMain.handle('games:getLeaderboard', async (_event, days = 7) => {
    const results: any[] = []
    for (let d = 0; d < days; d++) {
      const date = new Date(Date.now() - d * 86400000).toISOString().split('T')[0]
      const scores = queryAll(
        `SELECT game_type, MAX(score) as best_score, SUM(score) as total
         FROM game_scores WHERE date = ? AND verified = 1
         GROUP BY game_type`,
        [date]
      )
      const totalPoints = queryOne(
        'SELECT COALESCE(SUM(amount), 0) as total FROM game_points WHERE date = ?',
        [date]
      )
      results.push({
        date,
        entries: scores.map((s: any) => ({
          gameType: s.game_type,
          bestScore: s.best_score,
          totalPoints: s.total
        })),
        totalDailyPoints: totalPoints?.total || 0
      })
    }
    return results
  })

  // Get points balance
  ipcMain.handle('games:getPoints', async () => {
    const total = queryOne('SELECT COALESCE(SUM(amount), 0) as total FROM game_points')
    const today = new Date().toISOString().split('T')[0]
    const todayEarned = queryOne(
      'SELECT COALESCE(SUM(amount), 0) as total FROM game_points WHERE date = ? AND amount > 0',
      [today]
    )
    const redeemed = queryOne(
      "SELECT COALESCE(COUNT(*), 0) as cnt FROM game_points WHERE reason = 'pro_day_redeem'"
    )
    return {
      total: total?.total || 0,
      todayEarned: todayEarned?.total || 0,
      proDaysRedeemed: redeemed?.cnt || 0
    }
  })

  // Redeem points for 1 pro day (costs 100 points)
  ipcMain.handle('games:redeemProDay', async () => {
    const total = queryOne('SELECT COALESCE(SUM(amount), 0) as total FROM game_points')
    const balance = total?.total || 0

    if (balance < 100) {
      return { success: false, remaining: balance }
    }

    const today = new Date().toISOString().split('T')[0]
    getDB().run(
      'INSERT INTO game_points (amount, reason, date) VALUES (?, ?, ?)',
      [-100, 'pro_day_redeem', today]
    )
    saveDB()

    return { success: true, remaining: balance - 100 }
  })
}
