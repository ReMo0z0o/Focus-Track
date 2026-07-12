import { createFileRoute } from '@tanstack/react-router'
import { StatsView } from '@/components/StatsView'

export const Route = createFileRoute('/_authenticated/stats')({
  component: StatsPage,
})

function StatsPage() {
  return <StatsView />
}
