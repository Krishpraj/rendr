// Mirror of rendr-api Pydantic models

export interface ParameterRange {
  min: number | null
  max: number | null
  step: number | null
}

export interface ParameterOption {
  value: string | number
  label: string | null
}

export interface Parameter {
  name: string
  display_name: string
  type: string
  value: string | number | boolean | unknown[]
  default_value: string | number | boolean | unknown[]
  description: string | null
  group: string
  range: ParameterRange | null
  options: ParameterOption[]
}

export interface PartLabel {
  index: number
  name: string | null
  color: string | null
  bbox: Record<string, unknown> | null
}

export interface CanvasState {
  camera_position: [number, number, number] | null
  camera_target: [number, number, number] | null
  model_bbox_min: [number, number, number] | null
  model_bbox_max: [number, number, number] | null
  model_dimensions: [number, number, number] | null
  model_center: [number, number, number] | null
  zoom_distance: number | null
}

export interface EditRequest {
  code: string
  prompt: string
  provider?: string | null
  model?: string | null
  part_labels?: PartLabel[]
  canvas_state?: CanvasState | null
  skip_validation?: boolean
  skip_refinement?: boolean
  stream?: boolean
  messages?: Record<string, string>[]
  fast?: boolean
}

export interface ParamUpdate {
  name: string
  value: string
}

export interface ParameterUpdateRequest {
  code: string
  updates: ParamUpdate[]
}

export interface RenderRequest {
  code: string
  width?: number
  height?: number
  camera?: string | null
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface EditResponse {
  code: string
  title: string
  parameters: Parameter[]
  analysis: string
  plan: string
  validation: ValidationResult | null
  refinements_applied: number
  model_used: string
  provider_used: string
}

export interface ParameterUpdateResponse {
  code: string
  parameters: Parameter[]
}

export interface HealthResponse {
  status: string
  provider: string
  model: string
  openscad_available: boolean
}

export interface RenderResponse {
  image: string // base64-encoded PNG
  width: number
  height: number
}

// Stream events from /edit endpoint (NDJSON)
export type PipelineStage = 'analyze_and_plan' | 'generate' | 'validate' | 'review' | 'complete'

export interface StreamEvent {
  stage: PipelineStage
  status: 'running' | 'done'
  // Additional fields depending on stage
  analysis?: string
  plan?: string
  round?: number
  validation?: ValidationResult
  approved?: boolean
  result?: EditResponse
}

// Local types
export interface Project {
  id: string
  name: string
  code: string
  parameters: Parameter[]
  previewImage: string | null
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  code?: string
  parameters?: Parameter[]
  timestamp: string
  pipelineStages?: PipelineStage[]
}
