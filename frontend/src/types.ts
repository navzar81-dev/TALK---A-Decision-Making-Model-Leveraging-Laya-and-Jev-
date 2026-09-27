export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'unsure' | 'error';

export interface VisualItem {
  label: string;
  value?: string;
  confidence?: number;
  is_winner?: boolean;
  pros?: string[];
  cons?: string[];
  notes?: string;
  criteria_scores?: Record<string, number>;
}

export interface Citation {
  title: string;
  source: string;
  snippet?: string;
  url?: string;
}

export interface VisualPayload {
  type: 'choice_matrix' | 'confidence_meter' | 'score_rubric' | 'binary_evaluation' | 'multi_criteria_matrix';
  title: string;
  subtitle?: string;
  decision_badge: string;
  confidence: number;
  summary: string;
  verdict_flavor?: string;
  reasoning_pillars?: string[];
  basis_name?: string;
  items: VisualItem[];
  citations: Citation[];
}

export interface LayaFramedQuestion {
  question_type: 'choice' | 'score' | 'noul' | 'multi_criteria';
  state: string;
  question: string;
  options?: string[];
  rubric?: string;
  condition?: string;
  criteria?: string[];
  shortlist_applied?: boolean;
  initial_options_count?: number;
}

export interface LayaDecisionResult {
  decision: string;
  confidence: number;
  distribution: Record<string, number>;
  hedged: boolean;
  latency_ms: number;
  question_type: string;
  verdict_flavor?: string;
  reasoning_pillars?: string[];
  multi_criteria_scores?: Record<string, Record<string, number>>;
  shortlist?: string[];
}

export interface QueryTriage {
  intent: 'decision' | 'informational' | 'conversational';
  reasoning: string;
  suggested_filler: string;
  is_self_contained?: boolean;
  detected_options?: string[];
}

export interface Stage2Telemetry {
  llm_provider: string;
  framing_latency_ms: number;
  laya_latency_ms: number;
  synthesis_latency_ms: number;
  shortlist_applied: boolean;
  initial_options_count?: number;
  criteria_evaluated?: string[];
  decision_engine_mode: string;
  decision_path?: 'laya_fast_path' | 'cloud_llm_escalated' | 'conversational';
}

export interface TalkResponse {
  session_id: string;
  triage: QueryTriage;
  spoken_answer: string;
  framed_question?: LayaFramedQuestion;
  laya_result?: LayaDecisionResult;
  visual_payload?: VisualPayload;
  thinking_filler: string;
  total_latency_ms: number;
  stage2_telemetry?: Stage2Telemetry;
}

export interface LLMConnection {
  id: string;
  name: string;
  provider: 'gemini' | 'openai' | 'ollama' | 'lmstudio' | 'custom';
  base_url: string;
  api_key?: string | null;
  model: string;
  is_default: boolean;
  tool_calling_supported: boolean;
  streaming_supported: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  latency_ms: number;
  message: string;
  model: string;
  tool_calling_verified: boolean;
}

export interface VoicePersona {
  id: string;
  name: string;
  accent: string;
  gender: string;
  description: string;
}

export interface VoiceProviderConfig {
  id: string;
  name: string;
  provider: 'gemini' | 'neural_stream' | 'elevenlabs' | 'openai';
  voice_id: string;
  speed: number;
  api_key?: string;
  is_default: boolean;
  personas: VoicePersona[];
}

export interface ParsedDocument {
  filename: string;
  file_type: string;
  char_count: number;
  word_count: number;
  extracted_text: string;
  summary_snippets: string[];
}

export interface ClassificationRule {
  id: string;
  name: string;
  priority: number;
  domain_keywords: string[];
  decision_type: 'choice' | 'multi_criteria' | 'noul' | 'score';
  criteria: string[];
  steering_prompt: string;
  requires_research: boolean;
  is_active: boolean;
}

export interface ClassificationSettings {
  risk_tolerance: 'conservative' | 'balanced' | 'aggressive';
  hedging_threshold: number;
  rules: ClassificationRule[];
}

export interface RuleSuggestionRequest {
  query: string;
}

export interface RuleSuggestionResponse {
  name: string;
  domain_keywords: string[];
  decision_type: 'choice' | 'multi_criteria' | 'noul' | 'score';
  criteria: string[];
  steering_prompt: string;
  priority: number;
  requires_research: boolean;
  reasoning: string;
}

