import React, { useState, useEffect, useRef } from 'react';
import { LiquidOrb } from './components/LiquidOrb';
import { RightPane } from './components/RightPane';
import { SettingsModal } from './components/SettingsModal';
import { VersusModal } from './components/VersusModal';
import { AudioEngine } from './utils/audio';
import './App.css';
import type {
  OrbState,
  TalkResponse,
  LLMConnection,
  ConnectionTestResult,
  VisualPayload,
  LayaDecisionResult,
  LayaFramedQuestion,
  Stage2Telemetry,
  VoiceProviderConfig,
  ParsedDocument,
  ClassificationRule,
  ClassificationSettings,
  RuleSuggestionResponse
} from './types';
import {
  Mic,
  MicOff,
  Sliders,
  Send,
  Sparkles,
  Zap,
  XSquare,
  PanelRight,
  Swords
} from 'lucide-react';

const BACKEND_URL = 'http://127.0.0.1:8001';

export const App: React.FC = () => {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [audioBands, setAudioBands] = useState({ low: 0, mid: 0, high: 0, all: 0 });
  const [transcript, setTranscript] = useState<string>('');
  const [thinkingFiller, setThinkingFiller] = useState<string>('');
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [textInput, setTextInput] = useState<string>('');
  const [isRightPaneOpen, setIsRightPaneOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isVersusOpen, setIsVersusOpen] = useState<boolean>(false);

  // Active Decision and Visual States
  const [currentPayload, setCurrentPayload] = useState<VisualPayload | null>(null);
  const [currentLayaResult, setCurrentLayaResult] = useState<LayaDecisionResult | null>(null);
  const [currentFramedQuestion, setCurrentFramedQuestion] = useState<LayaFramedQuestion | null>(null);
  const [stage2Telemetry, setStage2Telemetry] = useState<Stage2Telemetry | null>(null);
  const [totalLatency, setTotalLatency] = useState<number | undefined>(undefined);

  // Pluggable Connections & Voice
  const [connections, setConnections] = useState<LLMConnection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string>('gemini-default');
  const [voiceProviders, setVoiceProviders] = useState<VoiceProviderConfig[]>([]);
  const [activeVoiceId, setActiveVoiceId] = useState<string>('edge-neural');
  const [classificationSettings, setClassificationSettings] = useState<ClassificationSettings | null>(null);

  const audioEngine = useRef(new AudioEngine()).current;
  const recognitionRef = useRef<any>(null);
  const latestTranscriptRef = useRef<string>('');
  const levelLoopRef = useRef<number | null>(null);

  // Fetch initial connection configs, voice providers, and classification rules
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/connections`)
      .then((r) => r.json())
      .then((data) => {
        if (data.connections) setConnections(data.connections);
        if (data.active_id) setActiveConnectionId(data.active_id);
      })
      .catch((e) => console.log('Backend connections not reachable yet:', e));

    fetch(`${BACKEND_URL}/api/voice/providers`)
      .then((r) => r.json())
      .then((data) => {
        if (data.providers) setVoiceProviders(data.providers);
        if (data.active_id) setActiveVoiceId(data.active_id);
      })
      .catch((e) => console.log('Backend voice providers not reachable yet:', e));

    fetch(`${BACKEND_URL}/api/classification/rules`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.rules) setClassificationSettings(data);
      })
      .catch((e) => console.log('Backend classification rules not reachable yet:', e));
  }, []);

  // Audio band polling when mic is active or audio is playing
  useEffect(() => {
    if (isMicActive || orbState === 'speaking') {
      const poll = () => {
        const bands = audioEngine.getAudioBands();
        setAudioBands(bands);
        levelLoopRef.current = requestAnimationFrame(poll);
      };
      poll();
    } else {
      setAudioBands({ low: 0, mid: 0, high: 0, all: 0 });
      if (levelLoopRef.current) cancelAnimationFrame(levelLoopRef.current);
    }
    return () => {
      if (levelLoopRef.current) cancelAnimationFrame(levelLoopRef.current);
    };
  }, [isMicActive, orbState]);

  // Speech Recognition Setup (Web Speech API)
  const toggleMicrophone = async () => {
    if (isMicActive) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    // Interrupt any ongoing speech (Barge-in)
    audioEngine.cancelSpeech();

    // Reset transcript reference buffer to prevent stale closure reads
    latestTranscriptRef.current = '';
    setTranscript('Listening...');
    setIsMicActive(true);
    setOrbState('listening');

    // Initialize audio level visualizer non-blockingly so speech recognition starts immediately
    audioEngine.initMic().catch((e) => console.warn('Mic visualizer init:', e));

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }

      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsMicActive(true);
        setOrbState('listening');
      };

      rec.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript;
        }
        const trimmed = fullTranscript.trim();
        latestTranscriptRef.current = trimmed;
        setTranscript(trimmed);
      };

      rec.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'no-speech' && !latestTranscriptRef.current) {
          setOrbState('unsure');
          setTimeout(() => setOrbState('idle'), 2200);
        }
      };

      rec.onend = () => {
        audioEngine.stopMic();
        setIsMicActive(false);
        const queryToProcess = latestTranscriptRef.current.trim();
        if (queryToProcess && queryToProcess !== 'Listening...') {
          executeDecisionPipeline(queryToProcess);
        } else {
          setOrbState('idle');
        }
      };

      recognitionRef.current = rec;
      try {
        rec.start();
      } catch (err) {
        console.warn('Error starting speech recognition:', err);
        setIsMicActive(false);
        setOrbState('idle');
      }
    } else {
      console.warn('SpeechRecognition API not available in this browser.');
      setIsMicActive(false);
      setOrbState('idle');
      setTranscript('Speech recognition is not supported in this browser. Please use text input.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    audioEngine.stopMic();
    setIsMicActive(false);
  };

  // Immediate Barge-in Cancellation
  const handleBargeIn = () => {
    latestTranscriptRef.current = '';
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }
    audioEngine.cancelSpeech();
    audioEngine.stopMic();
    setIsMicActive(false);
    setOrbState('idle');
    setAudioBands({ low: 0, mid: 0, high: 0, all: 0 });
    setTranscript('Interrupted.');
  };

  // Pipeline Execution (Voice or Text, with optional Document Grounding)
  const executeDecisionPipeline = async (
    queryText: string,
    documentData?: ParsedDocument | null
  ) => {
    if (!queryText.trim()) return;

    // Immediately stop mic to prevent any acoustic feedback or speaker echo
    audioEngine.stopMic();
    setIsMicActive(false);

    // Instant state transition to "thinking"
    setOrbState('thinking');
    setThinkingFiller(
      documentData
        ? `Grounded in ${documentData.filename}...`
        : 'Analyzing the decision space...'
    );
    setTranscript(`"${queryText}"`);

    try {
      const payloadBody: any = {
        text: queryText,
        connection_id: activeConnectionId,
        session_id: 'active-session',
      };

      if (documentData) {
        payloadBody.document_name = documentData.filename;
        payloadBody.document_text = documentData.extracted_text;
        payloadBody.document_snippets = documentData.summary_snippets;
      }

      const res = await fetch(`${BACKEND_URL}/api/talk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: TalkResponse = await res.json();

      // Update state with result
      setThinkingFiller('');
      setTotalLatency(data.total_latency_ms);
      setCurrentFramedQuestion(data.framed_question || null);
      setCurrentLayaResult(data.laya_result || null);
      setCurrentPayload(data.visual_payload || null);
      setStage2Telemetry(data.stage2_telemetry || null);

      if (data.visual_payload) {
        setIsRightPaneOpen(true);
      }

      // Transition to speaking state and neural voice output
      setOrbState('speaking');
      setTranscript(data.spoken_answer);

      let playedNeural = false;
      try {
        const audioRes = await fetch(`${BACKEND_URL}/api/voice/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: data.spoken_answer,
            provider_id: activeVoiceId,
          }),
        });
        if (audioRes.ok) {
          const blob = await audioRes.blob();
          const audioUrl = URL.createObjectURL(blob);
          playedNeural = await audioEngine.playNeuralAudioStream(
            audioUrl,
            () => setOrbState('speaking'),
            () => {
              setOrbState('idle');
              setAudioBands({ low: 0, mid: 0, high: 0, all: 0 });
              URL.revokeObjectURL(audioUrl);
            },
            (lvl) => {
              setAudioBands({
                low: lvl * 0.7,
                mid: lvl * 1.1,
                high: lvl * 0.8,
                all: lvl,
              });
            }
          );
        }
      } catch (voiceErr) {
        console.warn('Voice API stream unavailable, falling back to local TTS:', voiceErr);
      }

      if (!playedNeural) {
        audioEngine.speakWithOrbReactivity(
          data.spoken_answer,
          () => setOrbState('speaking'),
          () => {
            setOrbState('idle');
            setAudioBands({ low: 0, mid: 0, high: 0, all: 0 });
          },
          (lvl) => {
            setAudioBands({
              low: lvl * 0.7,
              mid: lvl * 1.1,
              high: lvl * 0.8,
              all: lvl,
            });
          }
        );
      }
    } catch (err: any) {
      console.error('Pipeline error:', err);
      setOrbState('error');
      setTranscript('Encountered an issue processing that query.');
      setTimeout(() => setOrbState('idle'), 3000);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const q = textInput;
    setTextInput('');
    executeDecisionPipeline(q);
  };

  const testConnectionHandler = async (conn: LLMConnection): Promise<ConnectionTestResult> => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/connections/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection: conn }),
      });
      return await res.json();
    } catch (e: any) {
      return {
        success: false,
        latency_ms: 0,
        message: 'Could not connect to backend server',
        model: conn.model,
        tool_calling_verified: false,
      };
    }
  };

  const setDefaultConnectionHandler = async (connId: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/connections/default/${connId}`, { method: 'POST' });
      setActiveConnectionId(connId);
      setConnections((prev) =>
        prev.map((c) => ({
          ...c,
          is_default: c.id === connId,
        }))
      );
    } catch (e) {
      console.error('Failed to set default connection:', e);
    }
  };

  const saveConnectionHandler = async (conn: LLMConnection) => {
    try {
      await fetch(`${BACKEND_URL}/api/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conn),
      });
      setConnections((prev) => [...prev, conn]);
    } catch (e) {
      console.error('Failed to save connection:', e);
    }
  };

  const setDefaultVoiceHandler = async (providerId: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/voice/default/${providerId}`, { method: 'POST' });
      setActiveVoiceId(providerId);
    } catch (e) {
      console.error('Failed to set default voice provider:', e);
    }
  };

  const auditionVoiceHandler = async (providerId: string, voiceId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/voice/audition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: providerId, voice_id: voiceId }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        await audioEngine.playNeuralAudioStream(url, undefined, () => URL.revokeObjectURL(url));
      }
    } catch (e) {
      console.error('Voice audition failed:', e);
    }
  };

  const saveRuleHandler = async (rule: ClassificationRule) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/classification/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
      const data = await res.json();
      if (data.settings) setClassificationSettings(data.settings);
    } catch (e) {
      console.error('Failed to save classification rule:', e);
    }
  };

  const deleteRuleHandler = async (ruleId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/classification/rules/${ruleId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setClassificationSettings((prev) =>
          prev ? { ...prev, rules: prev.rules.filter((r) => r.id !== ruleId) } : null
        );
      }
    } catch (e) {
      console.error('Failed to delete classification rule:', e);
    }
  };

  const updateSettingsHandler = async (settings: ClassificationSettings) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/classification/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.settings) setClassificationSettings(data.settings);
    } catch (e) {
      console.error('Failed to update classification settings:', e);
    }
  };

  const suggestRuleHandler = async (query: string): Promise<RuleSuggestionResponse> => {
    const res = await fetch(`${BACKEND_URL}/api/classification/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error('Suggestion generation failed');
    return await res.json();
  };

  return (
    <div className={`app-root ${isRightPaneOpen ? 'with-pane' : ''}`}>
      {/* Top Ambient Bar */}
      <header className="ambient-header">
        <div className="logo-group">
          <div className="logo-pulse-dot" />
          <h1 className="logo-text">TALK</h1>
          <span className="logo-sub">DECISION OS</span>
        </div>

        <div className="header-status">
          <span className={`status-pill status-${orbState}`}>
            {orbState.toUpperCase()}
          </span>
          {activeConnectionId && (
            <span className="active-llm-badge">
              <Sparkles size={12} style={{ marginRight: 5 }} />
              {connections.find((c) => c.id === activeConnectionId)?.name || 'Gemini Cloud'}
            </span>
          )}
        </div>

        <div className="header-controls">
          <button
            id="open-versus-btn"
            className="icon-button"
            onClick={() => setIsVersusOpen(true)}
            title="Versus Duel Builder (Compare any 2 options)"
          >
            <Swords size={18} />
          </button>

          {currentPayload && (
            <button
              id="toggle-pane-btn"
              className={`icon-button ${isRightPaneOpen ? 'active' : ''}`}
              onClick={() => setIsRightPaneOpen(!isRightPaneOpen)}
              title="Toggle Decision Visuals"
            >
              <PanelRight size={18} />
            </button>
          )}

          <button
            id="open-settings-btn"
            className="icon-button"
            onClick={() => setIsSettingsOpen(true)}
            title="Configure LLM & Voice Settings"
          >
            <Sliders size={18} />
          </button>
        </div>
      </header>

      {/* Main Experience Viewport */}
      <main className={`orb-stage orb-stage-${orbState}`}>
        <div className="orb-centerpiece">
          <LiquidOrb
            state={orbState}
            audioBands={audioBands}
            onOrbClick={() => {
              if (orbState === 'speaking') {
                handleBargeIn();
              } else {
                toggleMicrophone();
              }
            }}
          />

          {/* Thinking Filler Mask */}
          {thinkingFiller && (
            <div className="thinking-indicator">
              <Zap size={14} className="spinning" />
              <span>{thinkingFiller}</span>
            </div>
          )}

          {/* Holographic Oracle Plinth (HUD) */}
          <div className="oracle-plinth">
            <div className="plinth-waveform" aria-hidden="true">
              <span className="wave-bar" style={{ height: `${Math.max(6, Math.min(26, (audioBands.low + audioBands.all) * 24))}px` }} />
              <span className="wave-bar" style={{ height: `${Math.max(8, Math.min(32, (audioBands.mid + audioBands.all) * 30))}px` }} />
              <span className="wave-bar" style={{ height: `${Math.max(6, Math.min(22, (audioBands.high + audioBands.all) * 20))}px` }} />
            </div>

            <div className="transcript-hud">
              {transcript ? (
                <p className="transcript-text">{transcript}</p>
              ) : (
                <p className="transcript-placeholder">
                  Inscribe a dilemma below or speak to consult the calibrated core.
                </p>
              )}
            </div>

            <div className="plinth-waveform" aria-hidden="true">
              <span className="wave-bar" style={{ height: `${Math.max(6, Math.min(22, (audioBands.high + audioBands.all) * 20))}px` }} />
              <span className="wave-bar" style={{ height: `${Math.max(8, Math.min(32, (audioBands.mid + audioBands.all) * 30))}px` }} />
              <span className="wave-bar" style={{ height: `${Math.max(6, Math.min(26, (audioBands.low + audioBands.all) * 24))}px` }} />
            </div>
          </div>

          {/* Concentric Gyroscope Voice Node & Barge-in Controls */}
          <div className="floating-voice-controls">
            <div className="gyro-voice-deck">
              <div className="gyro-outer-ring" />
              <div className="gyro-mid-ring" />
              <button
                id="mic-toggle-btn"
                className={`mic-orb-btn ${isMicActive ? 'listening' : ''}`}
                onClick={toggleMicrophone}
                title={isMicActive ? 'Mute Microphone' : 'Start Continuous Voice'}
              >
                {isMicActive ? <MicOff size={22} /> : <Mic size={22} />}
              </button>
            </div>

            {orbState === 'speaking' && (
              <button
                id="barge-in-btn"
                className="barge-in-btn"
                onClick={handleBargeIn}
                title="Interrupt / Barge-in"
              >
                <XSquare size={16} />
                <span>Interrupt</span>
              </button>
            )}
          </div>

          {/* Dilemma Prism Tablets */}
          <div className="pilot-prompts-bar">
            <span className="pilot-label">INSTANT DILEMMAS:</span>
            <button
              id="chip-versus-builder"
              className="prompt-chip prompt-chip-versus prompt-chip-gold"
              onClick={() => setIsVersusOpen(true)}
              title="Open custom 2-option duel builder"
            >
              <span className="chip-badge">DUEL</span>
              <span>⚔️ Duel Builder</span>
            </button>
            <button
              className="prompt-chip"
              onClick={() => executeDecisionPipeline('Pizza or Sushi tonight?')}
            >
              <span className="chip-badge">DAILY</span>
              <span>🍕 Pizza vs Sushi</span>
            </button>
            <button
              className="prompt-chip"
              onClick={() => executeDecisionPipeline('Is pineapple on pizza acceptable or a crime?')}
            >
              <span className="chip-badge">DEBATE</span>
              <span>⚔️ Pineapple on Pizza?</span>
            </button>
            <button
              className="prompt-chip"
              onClick={() => executeDecisionPipeline('MacBook Pro M4 vs ThinkPad X1 Carbon for dev?')}
            >
              <span className="chip-badge">TECH</span>
              <span>💻 MacBook vs ThinkPad</span>
            </button>
            <button
              className="prompt-chip"
              onClick={() => executeDecisionPipeline('Hit the gym right now or take a rest day?')}
            >
              <span className="chip-badge">FITNESS</span>
              <span>🏃 Gym vs Rest Day</span>
            </button>
            <button
              className="prompt-chip"
              onClick={() => executeDecisionPipeline('Stay at corporate job or join an early-stage startup?')}
            >
              <span className="chip-badge">CAREER</span>
              <span>🚀 Corporate vs Startup</span>
            </button>
            <button
              className="prompt-chip prompt-chip-research"
              onClick={() => executeDecisionPipeline('Who will win the finals tonight?')}
              title="Triggers Cloud Research Escalation"
            >
              <span className="chip-badge">RESEARCH</span>
              <span>🌐 Finals (Web)</span>
            </button>
          </div>
        </div>

        {/* Text Input Fallback */}
        <div className="text-fallback-bar">
          <form className="fallback-form" onSubmit={handleTextSubmit}>
            <input
              id="text-decision-input"
              type="text"
              placeholder="Inscribe any dilemma or choice (e.g. 'Pizza or Sushi?', 'MacBook vs ThinkPad?')..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
            />
            <span className="kbd-cue">↵ Consult</span>
            <button id="submit-text-btn" type="submit" className="submit-btn" disabled={!textInput.trim()}>
              <Send size={15} />
            </button>
          </form>
        </div>
      </main>

      {/* Right Drawer: Structured Decision Visuals */}
      <RightPane
        isOpen={isRightPaneOpen}
        onClose={() => setIsRightPaneOpen(false)}
        payload={currentPayload}
        layaResult={currentLayaResult}
        framedQuestion={currentFramedQuestion}
        telemetry={stage2Telemetry}
        totalLatencyMs={totalLatency}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        connections={connections}
        activeId={activeConnectionId}
        onSelectDefault={setDefaultConnectionHandler}
        onTestConnection={testConnectionHandler}
        onSaveConnection={saveConnectionHandler}
        voiceProviders={voiceProviders}
        activeVoiceId={activeVoiceId}
        onSelectVoiceProvider={setDefaultVoiceHandler}
        onAuditionVoice={auditionVoiceHandler}
        classificationSettings={classificationSettings}
        onSaveRule={saveRuleHandler}
        onDeleteRule={deleteRuleHandler}
        onUpdateSettings={updateSettingsHandler}
        onSuggestRule={suggestRuleHandler}
      />

      {/* Versus Duel Builder Modal */}
      <VersusModal
        isOpen={isVersusOpen}
        onClose={() => setIsVersusOpen(false)}
        onSubmitDuel={(query, doc) => executeDecisionPipeline(query, doc)}
      />
    </div>
  );
};

export default App;

