import { useCallback, type ReactNode } from 'react'
import type { AIStatus, QuickStartIntent, UserProfile } from '../../../../../shared/types'
import BodyDoublingMode from '../BodyDoublingMode'
import MemoryPanel from '../MemoryPanel'
import CourseList from '../CourseList'
import CourseCreator from '../CourseCreator'
import CourseView from '../CourseView'
import FlashcardDeck from '../FlashcardDeck'
import VoiceCall from '../VoiceCall'
import PomodoroTimer from '../PomodoroTimer'
import BrainGames from '../BrainGames'
import DopamineMenu from '../DopamineMenu'
import FocusMode from '../FocusMode'
import DailySummary from '../DailySummary'
import CareerMirror from '../CareerMirror'
import Settings from '../Settings'
import Tutorial from '../Tutorial'
import QuickStartGuide from '../QuickStartGuide'
import Achievements from '../Achievements'
import TaskPanel from '../TaskPanel'
import TeacherMode from '../TeacherMode'
import Chat from '../Chat'
import EnergyPrompt from '../EnergyPrompt'
import type { UseGameBridgeResult } from '../../hooks/useGameBridge'
import type { UsePanelRoutingResult } from '../../hooks/usePanelRouting'
import { useVoice } from '../../hooks/useVoice'

function PanelOverlay({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{
        padding: 'clamp(10px, 2vw, 20px)',
        background: 'rgba(5,3,3,0.7)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        className="relative overflow-hidden"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: wide ? 'min(calc(960px * var(--aura-ui-scale, 1)), 96vw)' : 'min(calc(700px * var(--aura-ui-scale, 1)), 96vw)',
          maxWidth: '96vw',
          height: wide ? 'min(calc(640px * var(--aura-ui-scale, 1)), 92vh)' : 'min(calc(520px * var(--aura-ui-scale, 1)), 92vh)',
          maxHeight: '92vh',
          borderRadius: 'calc(16px * var(--aura-ui-scale, 1))',
          background: 'rgba(15,10,10,0.95)',
          border: '1px solid rgba(139,58,58,0.15)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          animation: 'panelIn 0.35s cubic-bezier(.16,1,.3,1) forwards',
        }}
      >
        <div className="flex items-center justify-end px-4 py-2" style={{ borderBottom: '1px solid rgba(139,58,58,0.1)' }}>
          <button
            data-tutorial="panel-close"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all hover:bg-white/5"
            style={{ color: 'rgba(200,160,140,0.3)' }}
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto" style={{ height: 'calc(100% - 44px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function ChatOverlay({
  profile,
  aiStatus,
  voice,
  onClose,
  onOpenTasks,
  onOpenCourses,
  onOpenCourseCreator,
  onOpenCourse,
  onOpenFlashcards,
  onOpenTeacher,
}: {
  profile: UserProfile
  aiStatus: AIStatus | null
  voice: ReturnType<typeof useVoice>
  onClose: () => void
  onOpenTasks: () => void
  onOpenCourses: () => void
  onOpenCourseCreator: () => void
  onOpenCourse: (courseId: number) => void
  onOpenFlashcards: () => void
  onOpenTeacher: (courseId: number) => void
}) {
  return (
    <PanelOverlay onClose={onClose}>
      <Chat
        profile={profile}
        aiStatus={aiStatus}
        voiceHook={voice}
        onStartVoiceCall={() => {}}
        onStartPomodoro={() => {}}
        onOpenTasks={onOpenTasks}
        onOpenCourses={onOpenCourses}
        onOpenCourseCreator={onOpenCourseCreator}
        onOpenCourse={onOpenCourse}
        onOpenFlashcards={onOpenFlashcards}
        onOpenTeacher={onOpenTeacher}
      />
    </PanelOverlay>
  )
}

interface Props {
  profile: UserProfile
  aiStatus: AIStatus | null
  isWebRuntime: boolean
  showMenu: boolean
  setShowMenu: React.Dispatch<React.SetStateAction<boolean>>
  showEnergy: boolean
  routing: UsePanelRoutingResult
  gameBridge: UseGameBridgeResult
  voice: ReturnType<typeof useVoice>
  tutorialCourseGenerated: boolean
  markTutorialCourseGenerated: () => void
  resetTutorialCourseGenerated: () => void
  onQuickStartChoice: (intent: QuickStartIntent) => void
  onCompleteTutorial: () => void
  onEnergySubmit: (level: number) => Promise<void>
  onEnergySkip: () => void
  onOpenFlashcardsFromBot: () => void
}

export default function PanelManager({
  profile,
  aiStatus,
  isWebRuntime,
  showMenu,
  setShowMenu,
  showEnergy,
  routing,
  gameBridge,
  voice,
  tutorialCourseGenerated,
  markTutorialCourseGenerated,
  resetTutorialCourseGenerated,
  onQuickStartChoice,
  onCompleteTutorial,
  onEnergySubmit,
  onEnergySkip,
  onOpenFlashcardsFromBot,
}: Props) {
  const openLessonGameMix = useCallback((launch: Parameters<UseGameBridgeResult['openLessonGameMix']>[0]) => {
    gameBridge.openLessonGameMix(launch, routing.openGamesPanel)
  }, [gameBridge, routing.openGamesPanel])

  const closeGamesPanel = useCallback(() => {
    routing.closeGamesPanel()
    gameBridge.resetGameBridge()
  }, [gameBridge, routing.closeGamesPanel])

  const closeTutorialCourses = useCallback(() => {
    routing.closeCoursesPanel()
    resetTutorialCourseGenerated()
  }, [resetTutorialCourseGenerated, routing])

  return (
    <>
      {routing.showChat && (
        <ChatOverlay
          profile={profile}
          aiStatus={aiStatus}
          voice={voice}
          onClose={() => routing.setShowChat(false)}
          onOpenTasks={routing.openTasksPanel}
          onOpenCourses={routing.openCoursesList}
          onOpenCourseCreator={() => routing.openCourseCreator()}
          onOpenCourse={(courseId) => routing.openCourseView(courseId, 'currentLesson')}
          onOpenFlashcards={onOpenFlashcardsFromBot}
          onOpenTeacher={(courseId) => routing.openTeacher(courseId)}
        />
      )}

      {routing.showTasks && (
        <PanelOverlay onClose={routing.closeTasksPanel}>
          <TaskPanel />
        </PanelOverlay>
      )}

      {routing.showCourses && (
        <PanelOverlay onClose={routing.closeCoursesPanel}>
          {routing.courseView === 'view' && routing.selectedCourseId ? (
            <CourseView
              courseId={routing.selectedCourseId}
              entryMode={routing.courseEntryMode}
              onBack={routing.closeCoursesPanel}
              onOpenGames={openLessonGameMix}
              gameReinforcement={gameBridge.lessonPracticeReinforcement}
              courseReinforcementMap={gameBridge.courseReinforcementMap}
              onAcknowledgeGameReinforcement={gameBridge.acknowledgeLessonGameReinforcement}
              onStartSuggestedCourse={(topic) => routing.openCourseCreator(topic)}
            />
          ) : routing.courseView === 'create' ? (
            <CourseCreator
              initialTopic={routing.courseCreatorSeed}
              onBack={() => routing.openCoursesList()}
              onCourseCreated={() => routing.openCoursesList()}
              onCourseGenerated={markTutorialCourseGenerated}
            />
          ) : (
            <CourseList
              onSelectCourse={(courseId) => routing.openCourseView(courseId)}
              onCreateCourse={() => routing.openCourseCreator()}
              onOpenTeacher={(courseId) => routing.openTeacher(courseId)}
            />
          )}
        </PanelOverlay>
      )}

      {routing.showFlashcards && (
        <PanelOverlay onClose={routing.closeFlashcards}>
          <FlashcardDeck moduleId={0} cards={routing.flashcardCards} onBack={routing.closeFlashcards} />
        </PanelOverlay>
      )}

      {routing.showTeacher && (
        <TeacherMode
          onClose={routing.closeTeacher}
          initialCourseId={routing.teacherCourseId}
          onOpenGames={openLessonGameMix}
          gameReinforcement={gameBridge.lessonPracticeReinforcement}
          courseReinforcementMap={gameBridge.courseReinforcementMap}
          onAcknowledgeGameReinforcement={gameBridge.acknowledgeLessonGameReinforcement}
        />
      )}

      {routing.showGames && (
        <PanelOverlay onClose={closeGamesPanel}>
          <BrainGames
            initialGame={gameBridge.brainGameSeed}
            initialSeed={gameBridge.brainGameSeedContext}
            onGameComplete={gameBridge.handleBrainGameComplete}
          />
        </PanelOverlay>
      )}

      {routing.showAchievements && <Achievements onClose={() => routing.setShowAchievements(false)} />}

      {routing.showMemory && (
        <PanelOverlay onClose={() => routing.setShowMemory(false)}>
          <MemoryPanel />
        </PanelOverlay>
      )}

      {routing.showVoiceCall && <VoiceCall voiceHook={voice} onEnd={() => routing.setShowVoiceCall(false)} />}

      {routing.showPomodoro && <PomodoroTimer onClose={() => routing.setShowPomodoro(false)} speak={voice.speak} />}

      {routing.showDopamine && (
        <DopamineMenu profile={profile} onClose={() => routing.setShowDopamine(false)} onRewardPicked={() => {}} />
      )}

      {routing.showFocus && <FocusMode onClose={() => routing.setShowFocus(false)} speak={voice.speak} />}

      {routing.showSummary && <DailySummary onClose={() => routing.setShowSummary(false)} />}

      {routing.showMirror && <CareerMirror onClose={() => routing.setShowMirror(false)} />}

      {routing.showSettings && (
        <Settings profile={profile} isWebRuntime={isWebRuntime} onClose={() => routing.setShowSettings(false)} />
      )}

      {routing.showTutorial && (
        <Tutorial
          showMenu={showMenu}
          showCourses={routing.showCourses}
          showTasks={routing.showTasks}
          showFocus={routing.showFocus}
          showSettings={routing.showSettings}
          courseView={routing.courseView}
          courseGenerated={tutorialCourseGenerated}
          onEnsureCourseCreator={() => {
            setShowMenu(false)
            routing.setShowTasks(false)
            routing.setShowFocus(false)
            routing.setShowSettings(false)
            routing.openCourseCreator()
          }}
          onEnsureCourseList={() => {
            setShowMenu(false)
            routing.setShowTasks(false)
            routing.setShowFocus(false)
            routing.setShowSettings(false)
            routing.openCoursesList()
          }}
          onCloseCourses={closeTutorialCourses}
          onEnsureMenuOpen={() => {
            routing.setShowCourses(false)
            routing.setShowTasks(false)
            routing.setShowFocus(false)
            routing.setShowSettings(false)
            setShowMenu(true)
          }}
          onCloseMenu={() => setShowMenu(false)}
          onCloseTasks={() => routing.setShowTasks(false)}
          onCloseFocus={() => routing.setShowFocus(false)}
          onCloseSettings={() => routing.setShowSettings(false)}
          onComplete={onCompleteTutorial}
        />
      )}

      {routing.showQuickStart && (
        <QuickStartGuide
          profile={profile}
          onChoose={onQuickStartChoice}
          onClose={() => routing.setShowQuickStart(false)}
        />
      )}

      {showEnergy && (
        <EnergyPrompt
          name={profile.name}
          onSubmit={onEnergySubmit}
          onSkip={onEnergySkip}
        />
      )}

      {routing.showBodyDoubling && (
        <BodyDoublingMode
          userName={profile.name}
          language={profile.language}
          onExit={() => routing.setShowBodyDoubling(false)}
        />
      )}
    </>
  )
}