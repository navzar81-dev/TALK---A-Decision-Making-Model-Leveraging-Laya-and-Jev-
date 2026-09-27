from typing import List, Dict, Optional, Any, Literal
from pydantic import BaseModel, Field

class LLMConnection(BaseModel):
    id: str
    name: str
    provider: Literal["gemini", "openai", "ollama", "lmstudio", "custom"]
    base_url: str
    api_key: Optional[str] = None
    model: str
    is_default: bool = False
    tool_calling_supported: bool = True
    streaming_supported: bool = True

class ConnectionTestRequest(BaseModel):
    connection: LLMConnection

class ConnectionTestResponse(BaseModel):
    success: bool
    latency_ms: float
    message: str
    model: str
    tool_calling_verified: bool

class LayaFramedQuestion(BaseModel):
    question_type: Literal["choice", "score", "noul", "multi_criteria"]
    state: str = Field(description="Background context and synthesized state for the decision")
    question: str = Field(description="The core question to be answered")
    options: Optional[List[str]] = Field(default=None, description="Explicit candidate choices for 'choice' type (<= 20)")
    rubric: Optional[str] = Field(default=None, description="Ordinal grading rubric or criteria for 'score' type")
    condition: Optional[str] = Field(default=None, description="Binary criteria for 'noul' probability")
    criteria: Optional[List[str]] = Field(default=None, description="Multiple criteria for multi_criteria decision type")
    shortlist_applied: bool = Field(default=False, description="True if high-cardinality candidate shortlisting was applied")
    initial_options_count: Optional[int] = Field(default=None, description="Total candidates prior to shortlisting")

class LayaDecisionResult(BaseModel):
    decision: str
    confidence: float = Field(ge=0.0, le=1.0, description="Statistically calibrated confidence score")
    distribution: Dict[str, float] = Field(default_factory=dict, description="Normalized probability distribution over options")
    hedged: bool = Field(description="True if confidence < 0.85, requiring cautious/hedged phrasing")
    latency_ms: float
    question_type: str
    verdict_flavor: Optional[str] = Field(default=None, description="Fun/calibrated verdict flavor e.g. Absolute No-Brainer, Decisive Edge")
    reasoning_pillars: Optional[List[str]] = Field(default=None, description="xyz reasoning points behind the decision")
    multi_criteria_scores: Optional[Dict[str, Dict[str, float]]] = Field(default=None, description="Breakdown per criterion")
    shortlist: Optional[List[str]] = Field(default=None, description="Candidates shortlisted from high-cardinality set")
    routing: Optional[Dict[str, Any]] = Field(default=None, description="Laya route metadata and language detection")

class VisualItem(BaseModel):
    label: str
    value: Optional[str] = None
    confidence: Optional[float] = None
    is_winner: bool = False
    pros: Optional[List[str]] = None
    cons: Optional[List[str]] = None
    notes: Optional[str] = None
    criteria_scores: Optional[Dict[str, float]] = None

class Citation(BaseModel):
    title: str
    source: str
    snippet: Optional[str] = None
    url: Optional[str] = None

class VisualPayload(BaseModel):
    type: Literal["choice_matrix", "confidence_meter", "score_rubric", "binary_evaluation", "multi_criteria_matrix"]
    title: str
    subtitle: Optional[str] = None
    decision_badge: str
    confidence: float
    summary: str
    verdict_flavor: Optional[str] = None
    basis_name: Optional[str] = Field(default=None, description="Active user-configured rule/basis that steered this decision")
    reasoning_pillars: List[str] = Field(default_factory=list)
    items: List[VisualItem] = Field(default_factory=list)
    citations: List[Citation] = Field(default_factory=list)

class QueryTriage(BaseModel):
    intent: Literal["decision", "informational", "conversational"]
    reasoning: str
    suggested_filler: str = Field(description="Immediate acoustic filler to mask latency")
    is_self_contained: bool = True
    detected_options: Optional[List[str]] = None

class Stage2Telemetry(BaseModel):
    llm_provider: str
    framing_latency_ms: float
    laya_latency_ms: float
    synthesis_latency_ms: float
    shortlist_applied: bool = False
    initial_options_count: Optional[int] = None
    criteria_evaluated: Optional[List[str]] = None
    decision_engine_mode: str = "laya_fast_path"
    decision_path: Literal["laya_fast_path", "cloud_llm_escalated", "conversational"] = "laya_fast_path"
    routing: Optional[Dict[str, Any]] = None

class TalkRequest(BaseModel):
    text: str
    session_id: Optional[str] = "default-session"
    connection_id: Optional[str] = None
    pilot_domain: Optional[str] = "training_ops"
    document_name: Optional[str] = None
    document_text: Optional[str] = None
    document_snippets: Optional[List[str]] = None
    criteria_preference: Optional[List[str]] = None

class TalkResponse(BaseModel):
    session_id: str
    triage: QueryTriage
    spoken_answer: str
    framed_question: Optional[LayaFramedQuestion] = None
    laya_result: Optional[LayaDecisionResult] = None
    visual_payload: Optional[VisualPayload] = None
    thinking_filler: str
    total_latency_ms: float
    stage2_telemetry: Optional[Stage2Telemetry] = None

class VoicePersona(BaseModel):
    id: str
    name: str
    accent: str
    gender: str
    description: str

class VoiceProviderConfig(BaseModel):
    id: str
    name: str
    provider: Literal["gemini", "neural_stream", "elevenlabs", "openai"]
    voice_id: str
    speed: float = 1.0
    api_key: Optional[str] = None
    is_default: bool = False
    personas: List[VoicePersona] = Field(default_factory=list)

class VoiceSpeakRequest(BaseModel):
    text: str
    provider_id: Optional[str] = None
    voice_id: Optional[str] = None
    speed: Optional[float] = 1.0

class VoiceAuditionRequest(BaseModel):
    provider_id: str
    voice_id: str

class ClassificationRule(BaseModel):
    id: str
    name: str
    priority: int = Field(default=1, description="Priority rank: 1 is highest priority. Ties broken by keyword specificity.")
    domain_keywords: List[str] = Field(default_factory=list, description="Keywords that trigger this rule")
    decision_type: Literal["choice", "multi_criteria", "noul", "score"] = "choice"
    criteria: List[str] = Field(default_factory=list, description="Explicit evaluation dimensions / rubric criteria")
    steering_prompt: str = Field(description="Custom bias, heuristic guidance, or decision philosophy")
    requires_research: bool = Field(default=False, description="If True, mandates LLM web search handoff for context gathering")
    is_active: bool = True

class ClassificationSettings(BaseModel):
    risk_tolerance: Literal["conservative", "balanced", "aggressive"] = "balanced"
    hedging_threshold: float = Field(default=0.78, ge=0.5, le=0.95, description="Confidence threshold below which Laya hedges or marks close call")
    rules: List[ClassificationRule] = Field(default_factory=list)

class RuleSuggestionRequest(BaseModel):
    query: str

class RuleSuggestionResponse(BaseModel):
    name: str
    domain_keywords: List[str]
    decision_type: Literal["choice", "multi_criteria", "noul", "score"]
    criteria: List[str]
    steering_prompt: str
    priority: int = 1
    requires_research: bool = False
    reasoning: str

