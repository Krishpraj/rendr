import { useCallback } from 'react'
import { api } from '@/lib/api'
import { useChat } from '@/contexts/ChatContext'
import { useProject } from '@/contexts/ProjectContext'
import type { EditRequest, PipelineStage } from '@/types'

interface SendOptions {
  model?: string
  provider?: string
  skipValidation?: boolean
  skipRefinement?: boolean
}

export function useEditStream() {
  const { addMessage, updateLastAssistant, setIsStreaming, setCurrentStage, setStreamCompletedStages } = useChat()
  const { updateProjectCode, currentProject } = useProject()

  const sendPrompt = useCallback(
    async (prompt: string, options?: SendOptions) => {
      addMessage('user', prompt)
      addMessage('assistant', 'Starting pipeline...')
      setIsStreaming(true)
      setCurrentStage('analyze_and_plan')
      setStreamCompletedStages([])

      const completedStages: PipelineStage[] = []

      try {
        const req: EditRequest = {
          code: currentProject?.code || '',
          prompt,
          stream: true,
          model: options?.model || undefined,
          provider: options?.provider || undefined,
          skip_validation: options?.skipValidation,
          skip_refinement: options?.skipRefinement
        }

        for await (const event of api.editStream(req)) {
          if (event.status === 'running') {
            setCurrentStage(event.stage)
            const stageLabels: Record<string, string> = {
              analyze_and_plan: 'Analyzing & planning...',
              generate: 'Generating code...',
              validate: 'Validating code...',
              review: 'Reviewing output...'
            }
            updateLastAssistant(stageLabels[event.stage] || `${event.stage}...`, {
              pipelineStages: [...completedStages]
            })
          }

          if (event.status === 'done' && event.stage !== 'complete') {
            completedStages.push(event.stage)
            setStreamCompletedStages([...completedStages])
          }

          if (event.stage === 'complete' && event.result) {
            const { code, title, parameters, analysis, plan } = event.result
            const summary = [
              analysis ? `**Analysis:** ${analysis.slice(0, 200)}...` : '',
              plan ? `\n\n**Plan:** ${plan.slice(0, 200)}...` : '',
              `\n\nGenerated OpenSCAD code for "${title}".`
            ]
              .filter(Boolean)
              .join('')

            updateLastAssistant(summary, {
              code,
              parameters,
              pipelineStages: completedStages
            })

            updateProjectCode(code, parameters)
          }
        }
      } catch (err) {
        updateLastAssistant(`Error: ${err instanceof Error ? err.message : String(err)}`, {
          pipelineStages: completedStages
        })
      } finally {
        setIsStreaming(false)
        setCurrentStage(null)
      }
    },
    [
      addMessage,
      updateLastAssistant,
      setIsStreaming,
      setCurrentStage,
      setStreamCompletedStages,
      currentProject,
      updateProjectCode
    ]
  )

  return { sendPrompt }
}
