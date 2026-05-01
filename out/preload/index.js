"use strict";
const electron = require("electron");
const auraAPI = {
  chat: {
    send: (message) => electron.ipcRenderer.invoke("chat:send", message),
    onToken: (callback) => {
      const handler = (_event, data) => callback(data);
      electron.ipcRenderer.on("chat:token", handler);
      return () => electron.ipcRenderer.removeListener("chat:token", handler);
    },
    getHistory: () => electron.ipcRenderer.invoke("chat:history"),
    clearHistory: () => electron.ipcRenderer.invoke("chat:clear")
  },
  tasks: {
    list: () => electron.ipcRenderer.invoke("tasks:list"),
    add: (text, priority, parentId) => electron.ipcRenderer.invoke("tasks:add", text, priority, parentId),
    toggle: (id) => electron.ipcRenderer.invoke("tasks:toggle", id),
    remove: (id) => electron.ipcRenderer.invoke("tasks:remove", id)
  },
  ai: {
    status: () => electron.ipcRenderer.invoke("ai:status")
  },
  claude: {
    setKey: (key) => electron.ipcRenderer.invoke("claude:setKey", key),
    getKey: () => electron.ipcRenderer.invoke("claude:getKey")
  },
  groq: {
    setKey: (key) => electron.ipcRenderer.invoke("groq:setKey", key),
    getKey: () => electron.ipcRenderer.invoke("groq:getKey")
  },
  motivation: {
    getState: () => electron.ipcRenderer.invoke("motivation:getState"),
    addXP: (amount) => electron.ipcRenderer.invoke("motivation:addXP", amount),
    awardLessonCompletion: (lessonId) => electron.ipcRenderer.invoke("motivation:awardLessonCompletion", lessonId),
    updateStreak: () => electron.ipcRenderer.invoke("motivation:updateStreak"),
    addMinutes: (minutes) => electron.ipcRenderer.invoke("motivation:addMinutes", minutes),
    acknowledgeWelcomeBack: () => electron.ipcRenderer.invoke("motivation:acknowledgeWelcomeBack")
  },
  energy: {
    log: (level) => electron.ipcRenderer.invoke("energy:log", level),
    getToday: () => electron.ipcRenderer.invoke("energy:getToday")
  },
  profile: {
    get: () => electron.ipcRenderer.invoke("profile:get"),
    save: (profile) => electron.ipcRenderer.invoke("profile:save", profile),
    resetAll: () => electron.ipcRenderer.invoke("profile:resetAll")
  },
  limits: {
    getState: () => electron.ipcRenderer.invoke("limits:getState")
  },
  educator: {
    getCourses: () => electron.ipcRenderer.invoke("educator:getCourses"),
    getCourse: (id) => electron.ipcRenderer.invoke("educator:getCourse", id),
    getCourseFeedback: (courseId) => electron.ipcRenderer.invoke("educator:getCourseFeedback", courseId),
    getCourseFeedbackAnalytics: () => electron.ipcRenderer.invoke("educator:getCourseFeedbackAnalytics"),
    startCourseIntake: (request) => electron.ipcRenderer.invoke("educator:startCourseIntake", request),
    continueCourseIntake: (sessionId, request) => electron.ipcRenderer.invoke("educator:continueCourseIntake", sessionId, request),
    generateCourse: (request) => electron.ipcRenderer.invoke("educator:generateCourse", request),
    onCourseGenToken: (callback) => {
      const handler = (_event, data) => callback(data);
      electron.ipcRenderer.on("educator:courseGenToken", handler);
      return () => electron.ipcRenderer.removeListener("educator:courseGenToken", handler);
    },
    getDueFlashcards: () => electron.ipcRenderer.invoke("educator:getDueFlashcards"),
    prepareLesson: (lessonId) => electron.ipcRenderer.invoke("educator:prepareLesson", lessonId),
    resetLessonRecall: (lessonId) => electron.ipcRenderer.invoke("educator:resetLessonRecall", lessonId),
    explainLesson: (lessonId) => electron.ipcRenderer.invoke("educator:explainLesson", lessonId),
    onLessonToken: (callback) => {
      const handler = (_event, data) => callback(data);
      electron.ipcRenderer.on("educator:lessonToken", handler);
      return () => electron.ipcRenderer.removeListener("educator:lessonToken", handler);
    },
    clarifyLesson: (lessonId, question, understandingScore) => electron.ipcRenderer.invoke("educator:clarifyLesson", lessonId, question, understandingScore),
    onClarifyToken: (callback) => {
      const handler = (_event, data) => callback(data);
      electron.ipcRenderer.on("educator:clarifyToken", handler);
      return () => electron.ipcRenderer.removeListener("educator:clarifyToken", handler);
    },
    getModules: (courseId) => electron.ipcRenderer.invoke("educator:getModules", courseId),
    getLessons: (moduleId) => electron.ipcRenderer.invoke("educator:getLessons", moduleId),
    completeLesson: (lessonId) => electron.ipcRenderer.invoke("educator:completeLesson", lessonId),
    completeModule: (moduleId) => electron.ipcRenderer.invoke("educator:completeModule", moduleId),
    deleteCourse: (courseId) => electron.ipcRenderer.invoke("educator:deleteCourse", courseId),
    retryCourseGeneration: (courseId) => electron.ipcRenderer.invoke("educator:retryCourseGeneration", courseId),
    submitCourseFeedback: (courseId, feedback, context) => electron.ipcRenderer.invoke("educator:submitCourseFeedback", courseId, feedback, context),
    refineCourseRecommendation: (courseId, context) => electron.ipcRenderer.invoke("educator:refineCourseRecommendation", courseId, context),
    generateLessonQuiz: (lessonId) => electron.ipcRenderer.invoke("educator:generateLessonQuiz", lessonId),
    generateLessonPractice: (lessonId) => electron.ipcRenderer.invoke("educator:generateLessonPractice", lessonId),
    generateTeacherCheckpoint: (lessonId, focus) => electron.ipcRenderer.invoke("educator:generateTeacherCheckpoint", lessonId, focus),
    generateModuleCheckpoint: (moduleId) => electron.ipcRenderer.invoke("educator:generateModuleCheckpoint", moduleId),
    saveTeacherCheckpointFlashcards: (lessonId, flashcards) => electron.ipcRenderer.invoke("educator:saveTeacherCheckpointFlashcards", lessonId, flashcards),
    reviewFlashcard: (id, quality) => electron.ipcRenderer.invoke("educator:reviewFlashcard", id, quality)
  },
  voice: {
    getSettings: () => electron.ipcRenderer.invoke("voice:getSettings"),
    saveSettings: (settings) => electron.ipcRenderer.invoke("voice:saveSettings", settings)
  },
  games: {
    startChallenge: (gameType, difficulty, seed) => electron.ipcRenderer.invoke("games:startChallenge", gameType, difficulty, seed),
    submitResult: (result) => electron.ipcRenderer.invoke("games:submitResult", result),
    getDailyScores: () => electron.ipcRenderer.invoke("games:getDailyScores"),
    getLeaderboard: (days) => electron.ipcRenderer.invoke("games:getLeaderboard", days),
    getPoints: () => electron.ipcRenderer.invoke("games:getPoints"),
    redeemProDay: () => electron.ipcRenderer.invoke("games:redeemProDay")
  },
  sync: {
    getState: () => electron.ipcRenderer.invoke("sync:getState"),
    link: (code) => electron.ipcRenderer.invoke("sync:link", code),
    unlink: () => electron.ipcRenderer.invoke("sync:unlink"),
    syncNow: () => electron.ipcRenderer.invoke("sync:syncNow")
  },
  window: {
    minimize: () => electron.ipcRenderer.send("window:minimize"),
    close: () => electron.ipcRenderer.send("window:close"),
    toggleVisibility: () => electron.ipcRenderer.send("window:toggle")
  },
  memory: {
    list: (kind) => electron.ipcRenderer.invoke("memory:list", kind),
    add: (content, kind, tag, importance) => electron.ipcRenderer.invoke("memory:add", content, kind, tag, importance),
    remove: (id) => electron.ipcRenderer.invoke("memory:delete", id),
    pickCallback: () => electron.ipcRenderer.invoke("memory:pickCallback"),
    decay: () => electron.ipcRenderer.invoke("memory:decay"),
    semantic: () => electron.ipcRenderer.invoke("memory:semantic")
  },
  overlay: {
    setEnabled: (enabled) => electron.ipcRenderer.invoke("overlay:setEnabled", enabled),
    setSize: (size) => electron.ipcRenderer.invoke("overlay:setSize", size),
    onMessage: (callback) => {
      const handler = (_event, msg) => callback(msg);
      electron.ipcRenderer.on("overlay:chatMessage", handler);
      return () => electron.ipcRenderer.removeListener("overlay:chatMessage", handler);
    }
  }
};
electron.contextBridge.exposeInMainWorld("aura", auraAPI);
