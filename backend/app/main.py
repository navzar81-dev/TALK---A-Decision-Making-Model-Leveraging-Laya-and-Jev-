from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from .models import (
    TalkRequest, TalkResponse, LLMConnection, ConnectionTestRequest, ConnectionTestResponse,
    LayaFramedQuestion, LayaDecisionResult, VoiceSpeakRequest, VoiceAuditionRequest
)
from .laya_service import LayaService
from .llm_manager import LLMManager
from .voice_service import VoiceService
from .orchestrator import TalkOrchestrator
from .document_parser import parse_uploaded_document

app = FastAPI(title="Talk AI Decision Assistant Backend", version="1.0.0")

# Enable CORS for local dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

laya_svc = LayaService()
llm_mgr = LLMManager()
voice_svc = VoiceService()
orchestrator = TalkOrchestrator(laya_svc, llm_mgr)

@app.get("/api/health")
async def health_check():
    active_conn = llm_mgr.get_active()
    active_voice = voice_svc.get_active()
    return {
        "status": "healthy",
        "service": "talk-backend",
        "active_llm": active_conn.name,
        "active_voice": active_voice.name,
        "laya_host": laya_svc.base_url
    }

@app.post("/api/talk", response_model=TalkResponse)
async def process_turn(req: TalkRequest):
    try:
        response = await orchestrator.process_turn(req)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/documents/parse")
async def parse_document_endpoint(
    file: UploadFile = File(...),
    option_a: Optional[str] = Form(None),
    option_b: Optional[str] = Form(None)
):
    try:
        content = await file.read()
        res = parse_uploaded_document(
            filename=file.filename or "uploaded_document",
            file_bytes=content,
            option_a=option_a,
            option_b=option_b
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse document: {str(e)}")

# Stage 2 Direct Inspection Endpoints
@app.post("/api/decision/frame", response_model=LayaFramedQuestion)
async def frame_decision_endpoint(req: TalkRequest):
    try:
        active_conn = llm_mgr.connections.get(req.connection_id) if req.connection_id else llm_mgr.get_active()
        return await llm_mgr.frame_decision_with_llm(
            query_text=req.text,
            conn=active_conn,
            pilot_domain=req.pilot_domain,
            criteria_pref=req.criteria_preference
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/decision/laya", response_model=LayaDecisionResult)
async def laya_decision_endpoint(framed: LayaFramedQuestion):
    try:
        return await laya_svc.execute_decision(framed)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# LLM Connections Endpoints
@app.get("/api/connections")
async def get_connections():
    return {
        "connections": llm_mgr.list_connections(),
        "active_id": llm_mgr.active_id
    }

@app.post("/api/connections/test", response_model=ConnectionTestResponse)
async def test_connection(req: ConnectionTestRequest):
    return await llm_mgr.test_connection(req.connection)

@app.post("/api/connections/default/{conn_id}")
async def set_default_connection(conn_id: str):
    success = llm_mgr.set_default(conn_id)
    if not success:
        raise HTTPException(status_code=404, detail="Connection not found")
    return {"success": True, "active_id": conn_id}

@app.post("/api/connections")
async def save_connection(conn: LLMConnection):
    llm_mgr.upsert_connection(conn)
    return {"success": True, "connection": conn}

# Voice Providers and Neural Audio Streaming Endpoints
@app.get("/api/voice/providers")
async def get_voice_providers():
    return {
        "providers": voice_svc.list_providers(),
        "active_id": voice_svc.active_provider_id
    }

@app.post("/api/voice/default/{provider_id}")
async def set_default_voice_provider(provider_id: str):
    success = voice_svc.set_default_provider(provider_id)
    if not success:
        raise HTTPException(status_code=404, detail="Voice provider not found")
    return {"success": True, "active_id": provider_id}

@app.post("/api/voice/speak")
async def stream_speech(req: VoiceSpeakRequest):
    try:
        audio_stream = voice_svc.synthesize_stream(
            text=req.text,
            provider_id=req.provider_id,
            voice_id=req.voice_id
        )
        return StreamingResponse(audio_stream, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS synthesis error: {e}")

@app.post("/api/voice/audition")
async def audition_voice(req: VoiceAuditionRequest):
    try:
        audio_bytes = await voice_svc.generate_audition_audio(
            provider_id=req.provider_id,
            voice_id=req.voice_id
        )
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice audition failed: {e}")
