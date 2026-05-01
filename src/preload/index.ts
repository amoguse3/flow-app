import { contextBridge, ipcRenderer } from 'electron'
import type { AuraAPI, ChatTokenEvent, CourseGenerationEvent } from '../../shared/types'

const auraAPI: AuraAPI = {
  chat: {
    send: (message: string) => ipcRenderer.invoke('chat:send', message),
    onToken: (callback: (data: ChatTokenEvent) => void) => {
      const handler = (_event: any, data: ChatTokenEvent) => callback(data)
      ipcRenderer.on('chat:token', handler)
      return () => ipcRenderer.removeListener('chat:token', handler)
    },
    getHistory: () => ipcRenderer.invoke('chat:history'),
    clearHistory: () => ipcRenderer.invoke('chat:clear')
  },
  tasks: {
    list: () => ipcRenderer.invoke('tasks:list'),
    add: (text, priority, parentId) => ipcRenderer.invoke('tasks:add', text, priority, parentId),
    toggle: (id) => ipcRenderer.invoke('tasks:toggle', id),
    remove: (id) => ipcRenderer.invoke('tasks:remove', id)
  },
  ai: {
    status: () => ipcRenderer.invoke('ai:status')
  },
  claude: {
    setKey: (key: string) => ipcRenderer.invoke('claude:setKey', key),
    getKey: () => ipcRenderer.invoke('claude:getKey')
  },
  groq: {
    setKey: (key: string) => ipcRenderer.invoke('groq:setKey', key),
    getKey: () => ipcRenderer.invoke('groq:getKey')
  },
  motivation: {
    getState: () => ipcRenderer.invoke('motivation:getState'),
    addXP: (amount) => ipcRenderer.invoke('motivation:addXP', amount),
    awardLessonCompletion: (lessonId) => ipcRenderer.invoke('motivation:awardLessonCompletion', lessonId),
    updateStreak: () => ipcRenderer.invoke('motivation:updateStreak'),
    addMinutes: (minutes) => ipcRenderer.invoke('motivation:addMinutes', minutes),
    acknowledgeWelcomeBack: () => ipcRenderer.invoke('motivation:acknowledgeWelcomeBack')
  },
  energy: {
    log: (level) => ipcRenderer.invoke('energy:log', level),
    getToday: () => ipcRenderer.invoke('energy:getToday')
  },
  profile: {
    get: () => ipcRenderer.invoke('profile:get'),
    save: (profile) => ipcRenderer.invoke('profile:save', profile),
    resetAll: () => ipcRenderer.invoke('profile:resetAll')
  },
  limits: {
    getState: () => ipcRenderer.invoke('limits:getState')
  },
  educator: {
    getCourses: () => ipcRenderer.invoke('educator:getCourses'),
    getCourse: (id) => ipcRenderer.invoke('educator:getCourse', id),
    getCourseFeedback: (courseId) => ipcRenderer.invoke('educator:getCourseFeedback', courseId),
    getCourseFeedbackAnalytics: () => ipcRenderer.invoke('educator:getCourseFeedbackAnalytics'),
    startCourseIntake: (request) => ipcRenderer.invoke('educator:startCourseIntake', request),
    continueCourseIntake: (sessionId, request) => ipcRenderer.invoke('educator:continueCourseIntake', sessionId, request),
    generateCourse: (request) => ipcRenderer.invoke('educator:generateCourse', request),
    onCourseGenToken: (callback: (data: CourseGenerationEvent) => void) => {
      const handler = (_event: any, data: CourseGenerationEvent) => callback(data)
      ipcRenderer.on('educator:courseGenToken', handler)
      return () => ipcRenderer.removeListener('educator:courseGenToken', handler)
    },
    getDueFlashcards: () => ipcRenderer.invoke('educator:getDueFlashcards'),
    prepareLesson: (lessonId) => ipcRenderer.invoke('educator:prepareLesson', lessonId),
    resetLessonRecall: (lessonId) => ipcRenderer.invoke('educator:resetLessonRecall', lessonId),
    explainLesson: (lessonId) => ipcRenderer.invoke('educator:explainLesson', lessonId),
    onLessonToken: (callback: (data: ChatTokenEvent) => void) => {
      const handler = (_event: any, data: ChatTokenEvent) => callback(data)
      ipcRenderer.on('educator:lessonToken', handler)
      return () => ipcRenderer.removeListener('educator:lessonToken', handler)
    },
    clarifyLesson: (lessonId, question, understandingScore) => ipcRenderer.invoke('educator:clarifyLesson', lessonId, question, understandingScore),
    onClarifyToken: (callback: (data: ChatTokenEvent) => void) => {
      const handler = (_event: any, data: ChatTokenEvent) => callback(data)
      ipcRenderer.on('educator:clarifyToken', handler)
      return () => ipcRenderer.removeListener('educator:clarifyToken', handler)
    },
    getModules: (courseId) => ipcRenderer.invoke('educator:getModules', courseId),
    getLessons: (moduleId) => ipcRenderer.invoke('educator:getLessons', moduleId),
    completeLesson: (lessonId) => ipcRenderer.invoke('educator:completeLesson', lessonId),
    completeModule: (moduleId) => ipcRenderer.invoke('educator:completeModule', moduleId),
    deleteCourse: (courseId) => ipcRenderer.invoke('educator:deleteCourse', courseId),
    retryCourseGeneration: (courseId) => ipcRenderer.invoke('educator:retryCourseGeneration', courseId),
    submitCourseFeedback: (courseId, feedback, context) => ipcRenderer.invoke('educator:submitCourseFeedback', courseId, feedback, context),
    refineCourseRecommendation: (courseId, context) => ipcRenderer.invoke('educator:refineCourseRecommendation', courseId, context),
    generateLessonQuiz: (lessonId) => ipcRenderer.invoke('educator:generateLessonQuiz', lessonId),
    generateLessonPractice: (lessonId) => ipcRenderer.invoke('educator:generateLessonPractice', lessonId),
    generateTeacherCheckpoint: (lessonId, focus) => ipcRenderer.invoke('educator:generateTeacherCheckpoint', lessonId, focus),
    generateModuleCheckpoint: (moduleId) => ipcRenderer.invoke('educator:generateModuleCheckpoint', moduleId),
    saveTeacherCheckpointFlashcards: (lessonId, flashcards) => ipcRenderer.invoke('educator:saveTeacherCheckpointFlashcards', lessonId, flashcards),
    reviewFlashcard: (id, quality) => ipcRenderer.invoke('educator:reviewFlashcard', id, quality)
  },
  voice: {
    getSettings: () => ipcRenderer.invoke('voice:getSettings'),
    saveSettings: (settings) => ipcRenderer.invoke('voice:saveSettings', settings)
  },
  games: {
    startChallenge: (gameType, difficulty, seed) => ipcRenderer.invoke('games:startChallenge', gameType, difficulty, seed),
    submitResult: (result) => ipcRenderer.invoke('games:submitResult', result),
    getDailyScores: () => ipcRenderer.invoke('games:getDailyScores'),
    getLeaderboard: (days) => ipcRenderer.invoke('games:getLeaderboard', days),
    getPoints: () => ipcRenderer.invoke('games:getPoints'),
    redeemProDay: () => ipcRenderer.invoke('games:redeemProDay')
  },
  sync: {
    getState: () => ipcRenderer.invoke('sync:getState'),
    link: (code) => ipcRenderer.invoke('sync:link', code),
    unlink: () => ipcRenderer.invoke('sync:unlink'),
    syncNow: () => ipcRenderer.invoke('sync:syncNow')
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    close: () => ipcRenderer.send('window:close'),
    toggleVisibility: () => ipcRenderer.send('window:toggle')
  },
  memory: {
    list: (kind) => ipcRenderer.invoke('memory:list', kind),
    add: (content, kind, tag, importance) => ipcRenderer.invoke('memory:add', content, kind, tag, importance),
    remove: (id) => ipcRenderer.invoke('memory:delete', id),
    pickCallback: () => ipcRenderer.invoke('memory:pickCallback'),
    decay: () => ipcRenderer.invoke('memory:decay'),
    semantic: () => ipcRenderer.invoke('memory:semantic')
  },
  overlay: {
    setEnabled: (enabled: boolean) => ipcRenderer.invoke('overlay:setEnabled', enabled),
    setSize: (size: string) => ipcRenderer.invoke('overlay:setSize', size),
    onMessage: (callback: (msg: string) => void) => {
      const handler = (_event: any, msg: string) => callback(msg)
      ipcRenderer.on('overlay:chatMessage', handler)
      return () => ipcRenderer.removeListener('overlay:chatMessage', handler)
    },
  }
}

contextBridge.exposeInMainWorld('aura', auraAPI)
