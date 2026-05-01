import AppShell from './components/layout/AppShell'
import { useMotivation } from './contexts/MotivationContext'

export default function App() {
  const motivationState = useMotivation()
  return <AppShell motivationState={motivationState} />
}
