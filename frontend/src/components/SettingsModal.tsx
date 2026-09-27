import React, { useState } from 'react';
import type { LLMConnection, ConnectionTestResult, VoiceProviderConfig } from '../types';
import {
  X,
  Check,
  AlertTriangle,
  ShieldCheck,
  Plus,
  RefreshCw,
  Cpu,
  Volume2,
  Play
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
}) => {
  const [activeTab, setActiveTab] = useState<'llm' | 'voice'>('llm');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ConnectionTestResult>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [auditioningVoice, setAuditioningVoice] = useState<string | null>(null);
  
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            {activeTab === 'llm' ? (
              <Cpu className="modal-icon" size={20} />
            ) : (
              <Volume2 className="modal-icon" size={20} />
            )}
            <div>
              <h2 className="modal-title">System Settings</h2>
              <p className="modal-subtitle">Configure Stage 2 Decision Intelligence and Neural Voice</p>
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
                            {vp.personas.map((persona) => {
                              const isAuditioning = auditioningVoice === persona.id;
                              return (
                                <div key={persona.id} className="persona-chip">
                                  <div className="persona-info">
                                    <strong>{persona.name}</strong>
                                    <span>{persona.description}</span>
                                  </div>
                                  <button
                                    className="audition-btn"
                                    onClick={() => handleAudition(vp.id, persona.id)}
                                    title="Listen to voice audition"
                                  >
                                    <Play size={10} className={isAuditioning ? 'spinning' : ''} />
                                    <span>Audition</span>
                                  </button>
                                </div>
                              );
                            })}
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
          ) : (
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

                    {/* Capability Flags and Warning per PRD §3.6 */}
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
                      id={`test-conn-${conn.id}`}
                      className="test-btn"
                      onClick={() => handleTest(conn)}
                      disabled={isTesting}
                    >
                      <RefreshCw size={13} className={isTesting ? 'spinning' : ''} />
                      {isTesting ? 'Pinging...' : 'Test'}
                    </button>
                    {!isActive && (
                      <button
                        id={`select-conn-${conn.id}`}
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

          {/* Add Connection Toggle */}
          {!showAddForm ? (
            <button
              id="show-add-connection-btn"
              className="add-conn-toggle-btn"
              onClick={() => setShowAddForm(true)}
            >
              <Plus size={16} />
              Add Local or Hosted Connection
            </button>
          ) : (
            <form className="add-connection-form" onSubmit={handleCreateConnection}>
              <h3 className="form-heading">Register New Endpoint</h3>
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
          )}
        </div>
      </div>
    </div>
  );
};
