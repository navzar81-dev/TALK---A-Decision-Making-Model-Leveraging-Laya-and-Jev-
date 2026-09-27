import React, { useState } from 'react';
import type {
  LLMConnection,
  ConnectionTestResult,
  VoiceProviderConfig,
  ClassificationRule,
  ClassificationSettings,
  RuleSuggestionResponse
} from '../types';
import {
  X,
  Check,
  AlertTriangle,
  ShieldCheck,
  Plus,
  RefreshCw,
  Cpu,
  Volume2,
  Play,
  Scale,
  Sparkles,
  Trash2,
  Edit3,
  Sliders,
  Globe,
  CheckCircle2
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  connections: LLMConnection[];
  activeId: string;
  onSelectDefault: (id: string) => void;
  onTestConnection: (conn: LLMConnection) => Promise<ConnectionTestResult>;
  onSaveConnection: (conn: LLMConnection) => Promise<void>;
  voiceProviders?: VoiceProviderConfig[];
  activeVoiceId?: string;
  onSelectVoiceProvider?: (id: string) => void;
  onAuditionVoice?: (providerId: string, voiceId: string) => Promise<void>;
  // Classification & Arbitration Rules Props
  classificationSettings?: ClassificationSettings | null;
  onSaveRule?: (rule: ClassificationRule) => Promise<void>;
  onDeleteRule?: (ruleId: string) => Promise<void>;
  onUpdateSettings?: (settings: ClassificationSettings) => Promise<void>;
  onSuggestRule?: (query: string) => Promise<RuleSuggestionResponse>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  connections,
  activeId,
  onSelectDefault,
  onTestConnection,
  onSaveConnection,
  voiceProviders = [],
  activeVoiceId,
  onSelectVoiceProvider,
  onAuditionVoice,
  classificationSettings,
  onSaveRule,
  onDeleteRule,
  onUpdateSettings,
  onSuggestRule,
}) => {
  const [activeTab, setActiveTab] = useState<'llm' | 'voice' | 'rules'>('llm');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ConnectionTestResult>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [auditioningVoice, setAuditioningVoice] = useState<string | null>(null);

  // Classification Tab States
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [suggestQuery, setSuggestQuery] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState<RuleSuggestionResponse | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // Form State for creating/editing rules
  const [ruleFormData, setRuleFormData] = useState<Partial<ClassificationRule>>({
    name: '',
    priority: 1,
    domain_keywords: [],
    decision_type: 'choice',
    criteria: [],
    steering_prompt: '',
    requires_research: false,
    is_active: true,
  });
  const [keywordsInput, setKeywordsInput] = useState('');
  const [criteriaInput, setCriteriaInput] = useState('');

  const [newConn, setNewConn] = useState<Partial<LLMConnection>>({
    name: 'Local Ollama Custom',
    provider: 'ollama',
    base_url: 'http://localhost:11434/v1',
    model: 'llama3.2:latest',
    tool_calling_supported: true,
    streaming_supported: true,
  });

  if (!isOpen) return null;

  const handleAudition = async (providerId: string, voiceId: string) => {
    if (!onAuditionVoice) return;
    setAuditioningVoice(voiceId);
    try {
      await onAuditionVoice(providerId, voiceId);
    } finally {
      setAuditioningVoice(null);
    }
  };

  const handleTest = async (conn: LLMConnection) => {
    setTestingId(conn.id);
    try {
      const res = await onTestConnection(conn);
      setTestResults((prev) => ({ ...prev, [conn.id]: res }));
    } finally {
      setTestingId(null);
    }
  };

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConn.name || !newConn.base_url || !newConn.model) return;
    const created: LLMConnection = {
      id: `conn-${Date.now()}`,
      name: newConn.name,
      provider: newConn.provider as any,
      base_url: newConn.base_url,
      api_key: newConn.api_key || null,
      model: newConn.model,
      is_default: false,
      tool_calling_supported: !!newConn.tool_calling_supported,
      streaming_supported: !!newConn.streaming_supported,
    };
    await onSaveConnection(created);
    setShowAddForm(false);
  };

  // Rule Handlers
  const handleOpenNewRuleForm = () => {
    setEditingRuleId(null);
    setRuleFormData({
      name: '',
      priority: (classificationSettings?.rules.length || 0) + 1,
      decision_type: 'choice',
      steering_prompt: '',
      requires_research: false,
      is_active: true,
    });
    setKeywordsInput('');
    setCriteriaInput('');
    setShowRuleForm(true);
  };

  const handleEditRule = (rule: ClassificationRule) => {
    setEditingRuleId(rule.id);
    setRuleFormData({ ...rule });
    setKeywordsInput(rule.domain_keywords.join(', '));
    setCriteriaInput(rule.criteria.join(', '));
    setShowRuleForm(true);
  };

  const handleSaveRuleForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveRule || !ruleFormData.name) return;

    const keywords = keywordsInput
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);

    const criteriaList = criteriaInput
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    const rule: ClassificationRule = {
      id: editingRuleId || `rule-custom-${Date.now()}`,
      name: ruleFormData.name,
      priority: Number(ruleFormData.priority) || 1,
      domain_keywords: keywords,
      decision_type: (ruleFormData.decision_type as any) || 'choice',
      criteria: criteriaList,
      steering_prompt: ruleFormData.steering_prompt || 'Evaluate objectively based on calibrated expected value.',
      requires_research: !!ruleFormData.requires_research,
      is_active: ruleFormData.is_active ?? true,
    };

    await onSaveRule(rule);
    setShowRuleForm(false);
    setEditingRuleId(null);
  };

  const handleDeleteRuleClick = async (ruleId: string) => {
    if (!onDeleteRule) return;
    await onDeleteRule(ruleId);
  };

  const handleToggleRuleActive = async (rule: ClassificationRule) => {
    if (!onSaveRule) return;
    await onSaveRule({ ...rule, is_active: !rule.is_active });
  };

  const handleGenerateSuggestion = async () => {
    if (!suggestQuery.trim() || !onSuggestRule) return;
    setIsSuggesting(true);
    setSuggestError(null);
    try {
      const suggestion = await onSuggestRule(suggestQuery.trim());
      setActiveSuggestion(suggestion);
    } catch (err: any) {
      setSuggestError('Failed to generate suggestion. Please try again.');
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleAdoptSuggestion = async () => {
    if (!activeSuggestion || !onSaveRule) return;
    const rule: ClassificationRule = {
      id: `rule-adopted-${Date.now()}`,
      name: activeSuggestion.name,
      priority: activeSuggestion.priority || 1,
      domain_keywords: activeSuggestion.domain_keywords,
      decision_type: activeSuggestion.decision_type,
      criteria: activeSuggestion.criteria,
      steering_prompt: activeSuggestion.steering_prompt,
      requires_research: activeSuggestion.requires_research,
      is_active: true,
    };
    await onSaveRule(rule);
    setActiveSuggestion(null);
    setSuggestQuery('');
  };

  const handleUpdateRisk = async (risk: 'conservative' | 'balanced' | 'aggressive') => {
    if (!onUpdateSettings || !classificationSettings) return;
    await onUpdateSettings({ ...classificationSettings, risk_tolerance: risk });
  };

  const handleUpdateHedging = async (threshold: number) => {
    if (!onUpdateSettings || !classificationSettings) return;
    await onUpdateSettings({ ...classificationSettings, hedging_threshold: threshold });
  };

  // Sort rules by priority (ascending: 1 is top priority)
  const sortedRules = classificationSettings?.rules
    ? [...classificationSettings.rules].sort((a, b) => a.priority - b.priority)
    : [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            {activeTab === 'llm' ? (
              <Cpu className="modal-icon" size={20} />
            ) : activeTab === 'voice' ? (
              <Volume2 className="modal-icon" size={20} />
            ) : (
              <Scale className="modal-icon" size={20} />
            )}
            <div>
              <h2 className="modal-title">System Settings</h2>
              <p className="modal-subtitle">
                {activeTab === 'llm'
                  ? 'Configure Stage 2 Decision Intelligence'
                  : activeTab === 'voice'
                  ? 'Configure Neural Voice & Low-Latency Streaming'
                  : 'Configure Decision Classification, Priority Ranking & Steering Rubrics'}
              </p>
            </div>
          </div>
          <button id="close-settings-modal-btn" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="settings-tabs-bar">
          <button
            className={`settings-tab-btn ${activeTab === 'llm' ? 'active-tab' : ''}`}
            onClick={() => setActiveTab('llm')}
          >
            <Cpu size={14} style={{ marginRight: 6 }} />
            LLM Providers (Stage 2)
          </button>
          <button
            className={`settings-tab-btn ${activeTab === 'voice' ? 'active-tab' : ''}`}
            onClick={() => setActiveTab('voice')}
          >
            <Volume2 size={14} style={{ marginRight: 6 }} />
            Neural Voice Engine
          </button>
          <button
            className={`settings-tab-btn ${activeTab === 'rules' ? 'active-tab' : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            <Scale size={14} style={{ marginRight: 6 }} />
            Arbitration Rules & Rubrics
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'voice' ? (
            <div className="voice-settings-view">
              <p className="section-note">
                Select your live speech voice provider and persona. Audio generates via low-latency streaming.
              </p>
              <div className="connection-list">
                {voiceProviders.map((vp) => {
                  const isActive = vp.id === activeVoiceId;
                  return (
                    <div key={vp.id} className={`connection-card ${isActive ? 'active-connection' : ''}`}>
                      <div className="conn-main-info">
                        <div className="conn-header-line">
                          <span className="conn-name">{vp.name}</span>
                          {isActive && <span className="active-tag">ACTIVE ENGINE</span>}
                        </div>
                        <div className="conn-meta-line">
                          <span className="meta-pill">{vp.provider.toUpperCase()}</span>
                          <span className="meta-pill model-pill">Default Voice: {vp.voice_id}</span>
                          <span className="meta-url">Speed: {vp.speed}x</span>
                        </div>

                        {/* Personas Catalog */}
                        <div className="personas-list">
                          <span className="personas-title">AVAILABLE PERSONAS:</span>
                          <div className="personas-chips">
                            {vp.personas && vp.personas.length > 0 ? (
                              vp.personas.map((persona) => (
                                <div key={persona.id} className="persona-chip">
                                  <div className="persona-info">
                                    <span className="persona-name">{persona.name}</span>
                                    <span className="persona-meta">
                                      {persona.accent} • {persona.gender}
                                    </span>
                                  </div>
                                  <button
                                    className="audition-btn"
                                    onClick={() => handleAudition(vp.id, persona.id)}
                                    disabled={auditioningVoice === persona.id}
                                    title="Listen to 3-second sample"
                                  >
                                    {auditioningVoice === persona.id ? (
                                      <RefreshCw size={12} className="spin" />
                                    ) : (
                                      <Play size={12} />
                                    )}
                                    <span>Sample</span>
                                  </button>
                                </div>
                              ))
                            ) : (
                              <span className="no-personas">Default persona active</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="conn-actions">
                        {!isActive && onSelectVoiceProvider && (
                          <button
                            className="select-default-btn"
                            onClick={() => onSelectVoiceProvider(vp.id)}
                          >
                            Set Default
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeTab === 'llm' ? (
            <>
              <div className="connection-list">
                {connections.map((conn) => {
                  const isActive = conn.id === activeId;
                  const test = testResults[conn.id];
                  const isTesting = testingId === conn.id;

                  return (
                    <div key={conn.id} className={`connection-card ${isActive ? 'active-connection' : ''}`}>
                      <div className="conn-main-info">
                        <div className="conn-header-line">
                          <span className="conn-name">{conn.name}</span>
                          {isActive && <span className="active-tag">ACTIVE DEFAULT</span>}
                        </div>
                        <div className="conn-meta-line">
                          <span className="meta-pill">{conn.provider.toUpperCase()}</span>
                          <span className="meta-pill model-pill">{conn.model}</span>
                          <span className="meta-url">{conn.base_url}</span>
                        </div>

                        {/* Capability Flags and Warning */}
                        <div className="capability-flags">
                          {conn.tool_calling_supported ? (
                            <span className="cap-badge verified" title="Confirmed tool-calling support">
                              <ShieldCheck size={12} />
                              Tool-Calling Enabled
                            </span>
                          ) : (
                            <span
                              className="cap-badge warning"
                              title="Warning: Tool-calling unconfirmed. Laya question-framing may degrade."
                            >
                              <AlertTriangle size={12} />
                              Tool-Calling Lacking
                            </span>
                          )}
                          {conn.streaming_supported && (
                            <span className="cap-badge info">Streaming Enabled</span>
                          )}
                        </div>

                        {/* Test result status message */}
                        {test && (
                          <div className={`test-feedback ${test.success ? 'feedback-ok' : 'feedback-err'}`}>
                            {test.success ? <Check size={13} /> : <AlertTriangle size={13} />}
                            <span>
                              {test.message} ({test.latency_ms}ms)
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="conn-actions">
                        <button
                          className="test-btn"
                          onClick={() => handleTest(conn)}
                          disabled={isTesting}
                        >
                          {isTesting ? <RefreshCw size={13} className="spin" /> : 'Test Ping'}
                        </button>
                        {!isActive && (
                          <button
                            className="select-default-btn"
                            onClick={() => onSelectDefault(conn.id)}
                          >
                            Set Default
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!showAddForm ? (
                <button
                  id="open-add-connection-btn"
                  className="add-connection-trigger"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus size={16} /> Add Custom LLM Endpoint
                </button>
              ) : (
                <form className="add-connection-form" onSubmit={handleCreateConnection}>
                  <h3 className="form-title">Register New LLM Endpoint</h3>
                  <div className="form-grid">
                    <div className="form-field">
                      <label>Connection Name</label>
                      <input
                        type="text"
                        value={newConn.name}
                        onChange={(e) => setNewConn({ ...newConn, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>Provider Type</label>
                      <select
                        value={newConn.provider}
                        onChange={(e) => setNewConn({ ...newConn, provider: e.target.value as any })}
                      >
                        <option value="gemini">Gemini API</option>
                        <option value="ollama">Ollama (Localhost)</option>
                        <option value="lmstudio">LM Studio (Localhost)</option>
                        <option value="openai">OpenAI</option>
                        <option value="custom">Custom (vLLM / Compatible)</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Base URL</label>
                      <input
                        type="text"
                        value={newConn.base_url}
                        onChange={(e) => setNewConn({ ...newConn, base_url: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>Model Identifier</label>
                      <input
                        type="text"
                        value={newConn.model}
                        onChange={(e) => setNewConn({ ...newConn, model: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>API Key (Optional for local)</label>
                      <input
                        type="password"
                        value={newConn.api_key || ''}
                        onChange={(e) => setNewConn({ ...newConn, api_key: e.target.value })}
                        placeholder="sk-..."
                      />
                    </div>
                  </div>
                  <div className="form-buttons">
                    <button type="button" className="btn-cancel" onClick={() => setShowAddForm(false)}>
                      Cancel
                    </button>
                    <button id="save-new-connection-btn" type="submit" className="btn-save">
                      Save Connection
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            /* ARBITRATION RULES & RUBRICS TAB */
            <div className="rules-settings-view">
              {/* Header Explanation */}
              <div className="rules-overview-banner">
                <div className="overview-title-row">
                  <span className="overview-badge">DYNAMIC DECISION ENGINE</span>
                  <span className="overview-note">
                    Rules determine Laya's mathematical framing, evaluation dimensions, and explicit decision basis.
                  </span>
                </div>
                <p className="overview-desc">
                  When you pose a dilemma, Laya evaluates active rules in <strong>Priority Rank</strong> order (Rank 1 executes first; ties broken by keyword match count). You can customize existing sample rules or generate new rubrics instantly.
                </p>
              </div>

              {/* Global Heuristic Tuning */}
              <div className="global-heuristics-card">
                <div className="heuristics-row">
                  <div className="heuristic-item">
                    <label className="heuristic-label">
                      <Sliders size={13} style={{ marginRight: 5 }} />
                      Risk Tolerance Philosophy:
                    </label>
                    <div className="segmented-control">
                      {(['conservative', 'balanced', 'aggressive'] as const).map((r) => (
                        <button
                          key={r}
                          className={`segmented-btn ${classificationSettings?.risk_tolerance === r ? 'active' : ''}`}
                          onClick={() => handleUpdateRisk(r)}
                        >
                          {r.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="heuristic-item">
                    <label className="heuristic-label">
                      Hedging Confidence Cutoff:
                      <span className="cutoff-val">
                        {Math.round((classificationSettings?.hedging_threshold || 0.78) * 100)}%
                      </span>
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="95"
                      value={Math.round((classificationSettings?.hedging_threshold || 0.78) * 100)}
                      onChange={(e) => handleUpdateHedging(Number(e.target.value) / 100)}
                      className="cutoff-slider"
                    />
                  </div>
                </div>
              </div>

              {/* AI & Local Fast Rule Suggester */}
              <div className="rule-suggester-box">
                <div className="suggester-header">
                  <div className="suggester-title-group">
                    <Sparkles size={16} className="sparkle-icon" />
                    <span className="suggester-title">AI / Local Rubric Suggester</span>
                  </div>
                  <span className="engine-speed-badge">
                    ⚡ Fast Local (&lt;5ms) • Cloud LLM Enabled
                  </span>
                </div>
                <p className="suggester-desc">
                  Enter your question or dilemma topic. The engine analyzes semantic phrasing, criteria dimensions, and priority ranking without modifying code.
                </p>

                <div className="suggester-input-row">
                  <input
                    type="text"
                    className="suggester-input"
                    placeholder="e.g. Should I buy a house or invest in ETFs? / Next.js vs Vite React for production?"
                    value={suggestQuery}
                    onChange={(e) => setSuggestQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateSuggestion()}
                  />
                  <button
                    className="suggester-btn"
                    onClick={handleGenerateSuggestion}
                    disabled={isSuggesting || !suggestQuery.trim()}
                  >
                    {isSuggesting ? (
                      <RefreshCw size={14} className="spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    <span>Suggest Rubric</span>
                  </button>
                </div>

                {suggestError && <div className="suggest-error">{suggestError}</div>}

                {/* Proposed Suggestion Card */}
                {activeSuggestion && (
                  <div className="suggestion-result-card">
                    <div className="suggestion-card-header">
                      <div>
                        <span className="suggest-badge">PROPOSED BASIS</span>
                        <h4 className="suggest-rule-name">{activeSuggestion.name}</h4>
                      </div>
                      <div className="suggest-meta-group">
                        <span className="suggest-rank-pill">Priority #{activeSuggestion.priority}</span>
                        <span className="suggest-type-pill">{activeSuggestion.decision_type.toUpperCase()}</span>
                        {activeSuggestion.requires_research && (
                          <span className="suggest-research-pill">
                            <Globe size={11} style={{ marginRight: 3 }} /> Web Research
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="suggestion-body">
                      <div className="suggest-field">
                        <span className="suggest-field-label">Trigger Keywords:</span>
                        <div className="suggest-tags">
                          {activeSuggestion.domain_keywords.map((kw, i) => (
                            <span key={i} className="suggest-keyword-tag">{kw}</span>
                          ))}
                        </div>
                      </div>

                      <div className="suggest-field">
                        <span className="suggest-field-label">Evaluation Criteria:</span>
                        <div className="suggest-tags">
                          {activeSuggestion.criteria.map((cr, i) => (
                            <span key={i} className="suggest-criteria-tag">{cr}</span>
                          ))}
                        </div>
                      </div>

                      <div className="suggest-field">
                        <span className="suggest-field-label">Steering Philosophy:</span>
                        <p className="suggest-prompt-text">"{activeSuggestion.steering_prompt}"</p>
                      </div>

                      <div className="suggest-field reason-field">
                        <span className="suggest-field-label">Basis Synthesis:</span>
                        <span className="suggest-reasoning-text">{activeSuggestion.reasoning}</span>
                      </div>
                    </div>

                    <div className="suggestion-actions">
                      <button className="btn-cancel" onClick={() => setActiveSuggestion(null)}>
                        Dismiss
                      </button>
                      <button className="btn-adopt" onClick={handleAdoptSuggestion}>
                        <Check size={14} style={{ marginRight: 5 }} />
                        Adopt as Active Rule
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Rule Management Header */}
              <div className="rules-list-header">
                <div>
                  <h3 className="section-subheading">Configured Arbitration Rules ({sortedRules.length})</h3>
                  <span className="subheading-hint">
                    Pre-loaded rules serve as editable samples. Priority 1 is highest priority.
                  </span>
                </div>
                {!showRuleForm && (
                  <button className="create-rule-btn" onClick={handleOpenNewRuleForm}>
                    <Plus size={14} style={{ marginRight: 4 }} />
                    Create Custom Rule
                  </button>
                )}
              </div>

              {/* Create / Edit Rule Form */}
              {showRuleForm && (
                <form className="rule-editor-form" onSubmit={handleSaveRuleForm}>
                  <div className="form-header-row">
                    <h4 className="editor-form-title">
                      {editingRuleId ? 'Edit Arbitration Rule' : 'Create Custom Arbitration Rule'}
                    </h4>
                    <button type="button" className="editor-close-btn" onClick={() => setShowRuleForm(false)}>
                      <X size={15} />
                    </button>
                  </div>

                  <div className="form-grid">
                    <div className="form-field">
                      <label>Rule Basis Name</label>
                      <input
                        type="text"
                        value={ruleFormData.name}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, name: e.target.value })}
                        placeholder="e.g. Enterprise Cloud Infrastructure"
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label title="Lower number = evaluated first. Priority 1 overrides Priority 2.">
                        Priority Rank (1 = Highest)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={ruleFormData.priority}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, priority: parseInt(e.target.value) || 1 })}
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>Decision Type</label>
                      <select
                        value={ruleFormData.decision_type}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, decision_type: e.target.value as any })}
                      >
                        <option value="choice">Pairwise / Multi-Choice</option>
                        <option value="multi_criteria">Multi-Criteria Score Matrix</option>
                        <option value="noul">Binary Yes / No / Commit</option>
                        <option value="score">Calibrated Scalar Rubric</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Trigger Keywords (comma separated)</label>
                      <input
                        type="text"
                        value={keywordsInput}
                        onChange={(e) => setKeywordsInput(e.target.value)}
                        placeholder="e.g. aws, gcp, azure, serverless, docker"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Evaluation Criteria Dimensions (comma separated)</label>
                    <input
                      type="text"
                      value={criteriaInput}
                      onChange={(e) => setCriteriaInput(e.target.value)}
                      placeholder="e.g. Developer Ergonomics, Operational Overhead, Long-term Cost"
                    />
                  </div>

                  <div className="form-field">
                    <label>Steering Bias & Decision Philosophy</label>
                    <textarea
                      rows={2}
                      value={ruleFormData.steering_prompt}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, steering_prompt: e.target.value })}
                      placeholder="e.g. Favor low operational toil and established developer velocity unless cost diverges by 3x."
                      required
                    />
                  </div>

                  <div className="checkbox-row">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={ruleFormData.requires_research}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, requires_research: e.target.checked })}
                      />
                      <span>Hand off to Cloud LLM for web search & real-time context gathering</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={ruleFormData.is_active}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, is_active: e.target.checked })}
                      />
                      <span>Active Rule</span>
                    </label>
                  </div>

                  <div className="form-buttons">
                    <button type="button" className="btn-cancel" onClick={() => setShowRuleForm(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-save">
                      {editingRuleId ? 'Update Rule' : 'Save Rule'}
                    </button>
                  </div>
                </form>
              )}

              {/* Active Rules List */}
              <div className="rules-cards-list">
                {sortedRules.map((rule) => {
                  const isSample = rule.id.includes('sample');
                  return (
                    <div
                      key={rule.id}
                      className={`rule-card ${!rule.is_active ? 'rule-disabled' : ''}`}
                    >
                      <div className="rule-card-header">
                        <div className="rule-title-group">
                          <div className="rule-rank-badge" title="Priority rank order">
                            #{rule.priority}
                          </div>
                          <div>
                            <div className="rule-name-line">
                              <span className="rule-name">{rule.name}</span>
                              {isSample && <span className="sample-badge">SAMPLE</span>}
                              {!rule.is_active && <span className="disabled-badge">INACTIVE</span>}
                            </div>
                            <span className="rule-type-tag">{rule.decision_type.toUpperCase()}</span>
                          </div>
                        </div>

                        <div className="rule-card-actions">
                          {rule.requires_research && (
                            <span className="research-flag-pill" title="Forces LLM context gathering and search handoff">
                              <Globe size={11} style={{ marginRight: 3 }} /> Web Research
                            </span>
                          )}
                          <button
                            className="rule-action-btn edit-btn"
                            onClick={() => handleEditRule(rule)}
                            title="Edit rule"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            className={`rule-action-btn toggle-btn ${rule.is_active ? 'active' : ''}`}
                            onClick={() => handleToggleRuleActive(rule)}
                            title={rule.is_active ? 'Deactivate rule' : 'Activate rule'}
                          >
                            <CheckCircle2 size={13} />
                          </button>
                          <button
                            className="rule-action-btn delete-btn"
                            onClick={() => handleDeleteRuleClick(rule.id)}
                            title="Delete rule"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Rule Details */}
                      <div className="rule-card-details">
                        <div className="rule-meta-section">
                          <span className="meta-label">Keywords:</span>
                          <div className="rule-chips">
                            {rule.domain_keywords.map((kw, i) => (
                              <span key={i} className="keyword-chip">{kw}</span>
                            ))}
                          </div>
                        </div>

                        {rule.criteria && rule.criteria.length > 0 && (
                          <div className="rule-meta-section">
                            <span className="meta-label">Criteria Dimensions:</span>
                            <div className="rule-chips">
                              {rule.criteria.map((cr, i) => (
                                <span key={i} className="criteria-chip">{cr}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="rule-prompt-quote">
                          <span className="quote-label">Steering Philosophy:</span>
                          <p className="quote-text">"{rule.steering_prompt}"</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
