import ChartPanel from '../../components/ChartPanel'
import GlassCard from '../../components/GlassCard'

export default function Dashboard(){
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="font-medium mb-2">Training</div>
          <ChartPanel kind="exercise" />
        </div>
        <div>
          <div className="font-medium mb-2">Body</div>
          <ChartPanel kind="measurement" />
        </div>
      </div>
    </div>
  )
}
