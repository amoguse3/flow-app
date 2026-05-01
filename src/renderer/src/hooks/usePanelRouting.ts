import { useCallback, useMemo, useState } from 'react'
import type { Flashcard } from '../../../../shared/types'
import type { MenuAction } from '../components/FloatingMenu'

export type CoursePanelView = 'list' | 'create' | 'view'
export type CourseEntryMode = 'tree' | 'currentLesson'

interface UsePanelRoutingOptions {
  onRoute?: () => void
}

interface MenuRoutingOptions {
  beforeOpenGames?: () => void
}

export interface UsePanelRoutingResult {
  showVoiceCall: boolean
  setShowVoiceCall: React.Dispatch<React.SetStateAction<boolean>>
  showPomodoro: boolean
  setShowPomodoro: React.Dispatch<React.SetStateAction<boolean>>
  showDopamine: boolean
  setShowDopamine: React.Dispatch<React.SetStateAction<boolean>>
  showFocus: boolean
  setShowFocus: React.Dispatch<React.SetStateAction<boolean>>
  showSummary: boolean
  setShowSummary: React.Dispatch<React.SetStateAction<boolean>>
  showMirror: boolean
  setShowMirror: React.Dispatch<React.SetStateAction<boolean>>
  showSettings: boolean
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>
  showTutorial: boolean
  setShowTutorial: React.Dispatch<React.SetStateAction<boolean>>
  showQuickStart: boolean
  setShowQuickStart: React.Dispatch<React.SetStateAction<boolean>>
  showChat: boolean
  setShowChat: React.Dispatch<React.SetStateAction<boolean>>
  showGames: boolean
  setShowGames: React.Dispatch<React.SetStateAction<boolean>>
  showCourses: boolean
  setShowCourses: React.Dispatch<React.SetStateAction<boolean>>
  showTasks: boolean
  setShowTasks: React.Dispatch<React.SetStateAction<boolean>>
  showTeacher: boolean
  setShowTeacher: React.Dispatch<React.SetStateAction<boolean>>
  showAchievements: boolean
  setShowAchievements: React.Dispatch<React.SetStateAction<boolean>>
  showBodyDoubling: boolean
  setShowBodyDoubling: React.Dispatch<React.SetStateAction<boolean>>
  showMemory: boolean
  setShowMemory: React.Dispatch<React.SetStateAction<boolean>>
  showFlashcards: boolean
  flashcardCards: Flashcard[]
  selectedCourseId: number | null
  teacherCourseId: number | undefined
  courseView: CoursePanelView
  courseEntryMode: CourseEntryMode
  courseCreatorSeed: string
  hasBlockingOverlay: boolean
  handleMenuSelect: (action: MenuAction, options?: MenuRoutingOptions) => void
  openTasksPanel: () => void
  closeTasksPanel: () => void
  openGamesPanel: () => void
  closeGamesPanel: () => void
  openCoursesList: () => void
  openCourseCreator: (topic?: string) => void
  openCourseView: (courseId: number, entryMode?: CourseEntryMode) => void
  closeCoursesPanel: () => void
  openTeacher: (courseId?: number) => void
  closeTeacher: () => void
  openFlashcards: (cards: Flashcard[]) => void
  closeFlashcards: () => void
  clearCourseSelection: () => void
}

export function usePanelRouting(options: UsePanelRoutingOptions = {}): UsePanelRoutingResult {
  const [showVoiceCall, setShowVoiceCall] = useState(false)
  const [showPomodoro, setShowPomodoro] = useState(false)
  const [showDopamine, setShowDopamine] = useState(false)
  const [showFocus, setShowFocus] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [showMirror, setShowMirror] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [showQuickStart, setShowQuickStart] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showGames, setShowGames] = useState(false)
  const [showCourses, setShowCourses] = useState(false)
  const [showTasks, setShowTasks] = useState(false)
  const [showTeacher, setShowTeacher] = useState(false)
  const [showAchievements, setShowAchievements] = useState(false)
  const [showBodyDoubling, setShowBodyDoubling] = useState(false)
  const [showMemory, setShowMemory] = useState(false)
  const [showFlashcards, setShowFlashcards] = useState(false)
  const [flashcardCards, setFlashcardCards] = useState<Flashcard[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [teacherCourseId, setTeacherCourseId] = useState<number | undefined>(undefined)
  const [courseView, setCourseView] = useState<CoursePanelView>('list')
  const [courseEntryMode, setCourseEntryMode] = useState<CourseEntryMode>('tree')
  const [courseCreatorSeed, setCourseCreatorSeed] = useState('')

  const finalizeRoute = useCallback(() => {
    options.onRoute?.()
  }, [options])

  const clearCourseSelection = useCallback(() => {
    setSelectedCourseId(null)
    setCourseEntryMode('tree')
    setCourseCreatorSeed('')
  }, [])

  const openTasksPanel = useCallback(() => {
    setShowChat(false)
    setShowTasks(true)
    finalizeRoute()
  }, [finalizeRoute])

  const closeTasksPanel = useCallback(() => {
    setShowTasks(false)
  }, [])

  const openGamesPanel = useCallback(() => {
    setShowGames(true)
    finalizeRoute()
  }, [finalizeRoute])

  const closeGamesPanel = useCallback(() => {
    setShowGames(false)
  }, [])

  const openCoursesList = useCallback(() => {
    setShowChat(false)
    clearCourseSelection()
    setCourseView('list')
    setShowCourses(true)
    finalizeRoute()
  }, [clearCourseSelection, finalizeRoute])

  const openCourseCreator = useCallback((topic = '') => {
    setShowChat(false)
    setSelectedCourseId(null)
    setCourseEntryMode('tree')
    setCourseCreatorSeed(topic)
    setCourseView('create')
    setShowCourses(true)
    finalizeRoute()
  }, [finalizeRoute])

  const openCourseView = useCallback((courseId: number, entryMode: CourseEntryMode = 'tree') => {
    setShowChat(false)
    setSelectedCourseId(courseId)
    setCourseEntryMode(entryMode)
    setCourseView('view')
    setShowCourses(true)
    finalizeRoute()
  }, [finalizeRoute])

  const closeCoursesPanel = useCallback(() => {
    setShowCourses(false)
    setCourseView('list')
    clearCourseSelection()
  }, [clearCourseSelection])

  const openTeacher = useCallback((courseId?: number) => {
    setShowChat(false)
    setTeacherCourseId(courseId)
    setShowTeacher(true)
    setShowCourses(false)
    finalizeRoute()
  }, [finalizeRoute])

  const closeTeacher = useCallback(() => {
    setShowTeacher(false)
    setTeacherCourseId(undefined)
  }, [])

  const openFlashcards = useCallback((cards: Flashcard[]) => {
    setShowChat(false)
    setFlashcardCards(cards)
    setShowFlashcards(true)
    finalizeRoute()
  }, [finalizeRoute])

  const closeFlashcards = useCallback(() => {
    setShowFlashcards(false)
    setFlashcardCards([])
  }, [])

  const handleMenuSelect = useCallback((action: MenuAction, routingOptions?: MenuRoutingOptions) => {
    switch (action) {
      case 'chat':
        setShowChat(true)
        break
      case 'tasks':
        setShowTasks(true)
        break
      case 'games':
        routingOptions?.beforeOpenGames?.()
        setShowGames(true)
        break
      case 'courses':
        setShowCourses(true)
        break
      case 'focus':
        setShowFocus(true)
        break
      case 'teacher':
        setTeacherCourseId(undefined)
        setShowTeacher(true)
        break
      case 'achievements':
        setShowAchievements(true)
        break
      case 'companion':
        setShowBodyDoubling(true)
        break
      case 'memory':
        setShowMemory(true)
        break
      case 'settings':
        setShowSettings(true)
        break
    }
  }, [])

  const hasBlockingOverlay = useMemo(() => (
    showQuickStart
    || showTutorial
    || showTasks
    || showCourses
    || showFocus
    || showTeacher
    || showChat
    || showFlashcards
    || showMemory
    || showAchievements
    || showBodyDoubling
    || showSettings
    || showVoiceCall
    || showPomodoro
    || showDopamine
    || showSummary
    || showMirror
    || showGames
  ), [
    showAchievements,
    showBodyDoubling,
    showChat,
    showCourses,
    showDopamine,
    showFlashcards,
    showFocus,
    showGames,
    showMemory,
    showMirror,
    showPomodoro,
    showQuickStart,
    showSettings,
    showSummary,
    showTasks,
    showTeacher,
    showTutorial,
    showVoiceCall,
  ])

  return {
    showVoiceCall,
    setShowVoiceCall,
    showPomodoro,
    setShowPomodoro,
    showDopamine,
    setShowDopamine,
    showFocus,
    setShowFocus,
    showSummary,
    setShowSummary,
    showMirror,
    setShowMirror,
    showSettings,
    setShowSettings,
    showTutorial,
    setShowTutorial,
    showQuickStart,
    setShowQuickStart,
    showChat,
    setShowChat,
    showGames,
    setShowGames,
    showCourses,
    setShowCourses,
    showTasks,
    setShowTasks,
    showTeacher,
    setShowTeacher,
    showAchievements,
    setShowAchievements,
    showBodyDoubling,
    setShowBodyDoubling,
    showMemory,
    setShowMemory,
    showFlashcards,
    flashcardCards,
    selectedCourseId,
    teacherCourseId,
    courseView,
    courseEntryMode,
    courseCreatorSeed,
    hasBlockingOverlay,
    handleMenuSelect,
    openTasksPanel,
    closeTasksPanel,
    openGamesPanel,
    closeGamesPanel,
    openCoursesList,
    openCourseCreator,
    openCourseView,
    closeCoursesPanel,
    openTeacher,
    closeTeacher,
    openFlashcards,
    closeFlashcards,
    clearCourseSelection,
  }
}