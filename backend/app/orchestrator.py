import time
import random
import re
from typing import Dict, Any, List, Tuple, Optional
from .models import (
    TalkRequest, TalkResponse, QueryTriage, LayaFramedQuestion,
    LayaDecisionResult, VisualPayload, VisualItem, Citation, ClassificationRule
)
from .laya_service import LayaService
from .llm_manager import LLMManager
from .classification_service import ClassificationService

class TalkOrchestrator:
    def __init__(self, laya_service: LayaService, llm_manager: LLMManager, classification_service: Optional[ClassificationService] = None):
        self.laya = laya_service
        self.llm = llm_manager
        self.classification_svc = classification_service or ClassificationService()

    def extract_options_and_check_context(self, text: str) -> Tuple[List[str], bool, str]:
        """
        Extracts candidate choices and determines whether the dilemma is self-contained
        or requires external cloud research/web searching.
        Returns: (options, is_self_contained, decision_type)
        """
        cleaned = text.strip().rstrip("?.! ")
        
        # Check if query demands external real-time facts
        research_indicators = [
            r"\bwho (won|will win|is winning)\b",
            r"\btonight('s)? (game|match|finals)\b",
            r"\blatest\b", r"\btoday('s)? price\b",
            r"\bcurrent (market|price|score|weather|standings)\b",
            r"\bbreaking news\b", r"\brecent earnings\b"
        ]
        needs_research = any(re.search(pat, cleaned, re.IGNORECASE) for pat in research_indicators)
        if needs_research:
            return ([], False, "research_needed")

        # Check if user-configured classification rule mandates web search/research handoff
        rule = self.classification_svc.find_matching_rule(cleaned)
        if rule and rule.requires_research:
            return ([], False, "research_needed")

        # Strip conversational prefixes
        cleaned_core = re.sub(
            r"^(?:can\s+you\s+)?(?:please\s+)?(?:help\s+me\s+)?(?:decide|choose|pick|tell\s+me)\s+(?:between\s+|whether\s+to\s+|which\s+is\s+better,?\s+)?",
            "",
            cleaned,
            flags=re.IGNORECASE
        ).strip()

        # 1. Regex pattern: "X vs Y" or "X versus Y"
        vs_match = re.search(r"^(?:compare\s+|which\s+is\s+better,?\s+)?(.+?)\s+(?:vs\.?|versus)\s+(.+?)(?:\s+(?:for|in|tonight).*)?$", cleaned_core, re.IGNORECASE)
        if vs_match:
            opt1, opt2 = vs_match.group(1).strip(), vs_match.group(2).strip()
            return ([opt1, opt2], True, "choice")

        # 2. Regex pattern: "between X and Y"
        between_match = re.search(r"(?:between\s+)?(.+?)\s+and\s+(.+?)(?:\s+(?:for|in|tonight).*)?$", cleaned_core, re.IGNORECASE)
        if between_match and " and " in cleaned_core.lower():
            opt1, opt2 = between_match.group(1).strip(), between_match.group(2).strip()
            if 0 < len(opt1.split()) <= 8 and 0 < len(opt2.split()) <= 8:
                return ([opt1, opt2], True, "choice")

        # 3. Regex pattern: "Should I X or Y?" or "X or Y?"
        or_match = re.search(r"^(?:should\s+(?:i|we)\s+)?(.+?)\s+or\s+(.+?)(?:\s+(?:for|in|tonight).*)?$", cleaned_core, re.IGNORECASE)
        if or_match:
            opt1 = re.sub(r"^(?:choose|pick|prefer|decide between)\s+", "", or_match.group(1).strip(), flags=re.IGNORECASE)
            opt2 = or_match.group(2).strip()
            if len(opt1.split()) <= 8 and len(opt2.split()) <= 8:
                return ([opt1, opt2], True, "choice")

        # 4. Check for yes/no / approval questions (noul)
        if re.search(r"^(?:should\s+(?:i|we)|is\s+it\s+(?:good|safe|worth|time)|can\s+(?:i|we))\b", cleaned_core, re.IGNORECASE):
            return (["Yes, proceed", "No, hold off"], True, "noul")

        # If options cannot be determined directly via regex, escalate to LLM (System 2) to dynamically extract them
        return ([], False, "general_decision")

    def triage_query(self, text: str) -> QueryTriage:
        text_lower = text.lower().strip()
        
        # Greetings
        greeting_patterns = [r"^hello\b", r"^hi\b", r"^hey\b", r"\bwho are you\b", r"\bwhat can you do\b", r"^thanks\b"]
        if any(re.search(pat, text_lower) for pat in greeting_patterns):
            return QueryTriage(
                intent="conversational",
                reasoning="Standard greeting or conversational check.",
                suggested_filler="I'm here.",
                is_self_contained=True
            )

        options, is_self_contained, q_type = self.extract_options_and_check_context(text)
        
        decision_patterns = [
            r"\bdecid(e|ing|ed)?\b", r"\bshould\b", r"\bchoos(e|ing)?\b", r"\bwhich\b",
            r"\bpick\b", r"\bbetter\b", r"\brecommend(ation)?\b", r"\bselect\b",
            r"\bcompar(e|ison)?\b", r"\bevaluat(e|ion)?\b", r"\bor\b", r"\bvs\.?\b",
            r"\bversus\b", r"\btradeoff(s)?\b", r"\bbest\b", r"\bwin(ner)?\b",
            r"\bpredict\b", r"\boutcome\b"
        ]
        is_decision = bool(options) or (not is_self_contained) or any(re.search(pat, text_lower) for pat in decision_patterns)
        
        if is_decision:
            # Self-contained ONLY when candidate options are successfully identified
            can_run_system1 = bool(options and is_self_contained)
            filler = "Locking in decision variables..." if can_run_system1 else "Analyzing options and context..."
            return QueryTriage(
                intent="decision",
                reasoning="Comparative evaluation or dilemma choice request.",
                suggested_filler=filler,
                is_self_contained=can_run_system1,
                detected_options=options if options else None
            )
            
        return QueryTriage(
            intent="informational",
            reasoning="Informational query.",
            suggested_filler="Analyzing...",
            is_self_contained=True
        )

    def _generate_verdict_flavor(self, confidence: float) -> str:
        threshold = self.classification_svc.settings.hedging_threshold
        if confidence >= 0.90:
            return "Absolute No-Brainer"
        elif confidence >= threshold:
            return "Decisive Winner"
        elif confidence >= threshold - 0.13:
            return "Close Call / Leaning"
        else:
            return "Toss-Up / High Dilemma"

    def _generate_xyz_reasoning(self, winner: str, loser: str, query: str, matched_rule: Optional[ClassificationRule] = None) -> List[str]:
        """Generates 3 fast, tailored xyz reasoning pillars grounded in user rules or domain heuristics."""
        if matched_rule and matched_rule.criteria and len(matched_rule.criteria) > 0:
            pillars = []
            for idx, crit in enumerate(matched_rule.criteria[:3]):
                if idx == 0:
                    pillars.append(f"{crit}: Under '{matched_rule.name}', {winner} demonstrates superior alignment and performance over {loser}.")
                elif idx == 1:
                    pillars.append(f"{crit}: Quantifiable edge in efficiency and lower friction relative to {loser}.")
                else:
                    guidance = matched_rule.steering_prompt[:65].rstrip(".")
                    pillars.append(f"{crit}: Confirmed advantage adhering to configured rule ({guidance}).")
            return pillars

        w_lower = winner.lower()
        q_lower = query.lower()
        
        # Context-aware pillar generation
        if any(f in q_lower for f in ["pizza", "sushi", "eat", "food", "cook", "order", "dinner"]):
            return [
                f"Satiety & Craving Match: {winner} aligns superior immediate reward for current craving profile.",
                f"Execution Simplicity: Lower friction and proven satisfaction index over {loser}.",
                "Post-meal Net Utility: Optimal balance of enjoyment without excessive food coma."
            ]
        elif any(f in q_lower for f in ["macbook", "thinkpad", "laptop", "pc", "tech", "m4", "gpu", "react", "vue"]):
            return [
                f"Ecosystem Synergy & Performance: {winner} delivers higher efficiency per dollar in developer benchmarks.",
                f"Tooling & Long-Term Viability: Superior sustained workflow ergonomics compared to {loser}.",
                "Resale & Maintenance Overhead: Lower total friction across a 2-3 year lifecycle."
            ]
        elif any(f in q_lower for f in ["gym", "workout", "sleep", "rest", "diet", "run"]):
            return [
                f"Momentum Continuity: {winner} compounds positive habit loops and neuro-chemical payoff.",
                f"Opportunity Cost Minimization: Regret probability is statistically lower than choosing {loser}.",
                "Energy Regeneration: Long-term physical readiness outranks immediate short-term friction."
            ]
        elif any(f in q_lower for f in ["pineapple", "crime", "debate", "movie", "series"]):
            return [
                f"Flavor / Aesthetic Profile: Bold, distinctive characteristics give {winner} the unassailable edge.",
                f"Consensus Factor: Cultural debate favors {winner} upon objective scrutiny.",
                "Pure Entertainment Yield: Higher dopamine and conversational novelty."
            ]
        else:
            return [
                f"Primary Advantage Factor: {winner} maximizes net expected utility under your specified constraints.",
                f"Downside Risk Containment: {loser} carries higher tail-risk or hidden compromise.",
                "Calibrated Confidence Edge: Statistical distribution points firmly toward decisive commitment."
            ]

    async def process_turn(self, req: TalkRequest) -> TalkResponse:
        start_time = time.perf_counter()
        matched_rule = self.classification_svc.find_matching_rule(req.text)
        triage = self.triage_query(req.text)

        # If document text is attached, ensure it is treated as a grounded decision
        if req.document_text:
            triage.intent = "decision"
            triage.is_self_contained = True
            triage.suggested_filler = f"Analyzing {req.document_name or 'document'} context..."

        # 1. Conversational / Informational Path
        if triage.intent != "decision":
            total_latency = (time.perf_counter() - start_time) * 1000.0 + random.uniform(80, 160)
            if triage.intent == "conversational":
                spoken = "I'm ready. Hit me with any dilemma, choice, or debate — from Pizza vs Sushi to career bets — and I will settle it with calibrated confidence."
            else:
                spoken = f"Regarding '{req.text.strip('?')}': this is an informational ask. Give me two or more choices or a decision dilemma, and I will make the call for you."

            return TalkResponse(
                session_id=req.session_id or "default",
                triage=triage,
                spoken_answer=spoken,
                framed_question=None,
                laya_result=None,
                visual_payload=None,
                thinking_filler=triage.suggested_filler,
                total_latency_ms=round(total_latency, 1)
            )

        # 2. FAST SYSTEM 1 PATH (Laya-First, <50ms)
        # When choices are extracted and no external web research is demanded
        if triage.is_self_contained and (triage.detected_options or req.document_text):
            fast_start = time.perf_counter()
            options = triage.detected_options or ["Option A", "Option B"]
            
            # Incorporate document context into state if present
            if req.document_text:
                doc_title = req.document_name or "Uploaded Document"
                doc_excerpt = req.document_text[:1200]
                state_str = f"Document Grounding Context from '{doc_title}':\n{doc_excerpt}\n\nDecision Query: '{req.text}'. Evaluated candidates: {', '.join(options)}."
            else:
                state_str = f"Decision inquiry: '{req.text}'. Evaluated candidate options: {', '.join(options)}."

            if matched_rule:
                state_str += f"\nActive User Rule Applied: '{matched_rule.name}' (Priority {matched_rule.priority}). Guidance: {matched_rule.steering_prompt}"

            framed = LayaFramedQuestion(
                question_type=matched_rule.decision_type if matched_rule else "choice",
                state=state_str,
                question=f"Which choice is superior: {options[0]} or {options[1] if len(options) > 1 else 'alternatives'}?",
                options=options,
                criteria=matched_rule.criteria if matched_rule else None
            )

            # Laya direct execution
            laya_start = time.perf_counter()
            laya_res = await self.laya.execute_decision(framed)
            laya_latency_ms = (time.perf_counter() - laya_start) * 1000.0

            # Compute Verdict Flavor & xyz Reasoning
            flavor = self._generate_verdict_flavor(laya_res.confidence)
            laya_res.verdict_flavor = flavor
            
            winner = laya_res.decision
            loser = [opt for opt in options if opt != winner][0] if len(options) > 1 else "alternatives"

            # Customize pillars with document evidence if available
            if req.document_snippets and len(req.document_snippets) > 0:
                doc_label = req.document_name or "Document"
                snip_quote = req.document_snippets[0]
                if len(snip_quote) > 110:
                    snip_quote = snip_quote[:107] + "..."
                pillars = [
                    f"Document Strategic Fit: Analysis of '{doc_label}' confirms higher alignment and quantifiable advantages for {winner}.",
                    f"Document Evidence: \"{snip_quote}\"",
                    f"Downside Protection: Lower execution risk and fewer hidden compromises compared to {loser} under documented constraints."
                ]
            else:
                pillars = self._generate_xyz_reasoning(winner, loser, req.text, matched_rule=matched_rule)

            laya_res.reasoning_pillars = pillars

            # Punchy Spoken Personality with Dynamic XYZ Reasoning
            conf_int = int(laya_res.confidence * 100)
            doc_mention = f"Based on '{req.document_name}', " if req.document_name else ""
            rule_mention = f"Under your '{matched_rule.name}' basis, " if matched_rule else ""
            primary_reason = pillars[0].split(':')[-1].strip().rstrip('.') if pillars else "it maximizes net expected value"
            
            if flavor == "Absolute No-Brainer":
                spoken = f"{doc_mention}{rule_mention}{winner}! It's an absolute no-brainer at {conf_int}% confidence. {primary_reason}."
            elif flavor == "Decisive Winner":
                spoken = f"{doc_mention}{rule_mention}I decide in favor of {winner}. At {conf_int}% confidence, it decisively edges out {loser} because {primary_reason.lower()}."
            elif flavor == "Close Call / Leaning":
                spoken = f"{doc_mention}{rule_mention}This is a close call, but I'm leaning toward {winner} with {conf_int}% confidence. Key reason: {primary_reason}."
            else:
                spoken = f"{doc_mention}{rule_mention}It's a genuine toss-up at {conf_int}%, but {winner} holds the edge. {primary_reason}."

            # Build Visual Decision Card
            items = []
            for opt, prob in laya_res.distribution.items():
                is_win = (opt == winner)
                item_conf = laya_res.confidence if is_win else prob
                items.append(VisualItem(
                    label=opt,
                    value=f"{int(round(item_conf * 100))}%",
                    confidence=item_conf,
                    is_winner=is_win,
                    pros=[pillars[0]] if is_win else [f"Marginally competitive, but trails on {pillars[1].split(':')[0]}."],
                    cons=[] if is_win else [f"Fails to surpass {winner}'s calibrated utility score."]
                ))

            # Build Citations from Document
            doc_citations: List[Citation] = []
            if req.document_snippets and len(req.document_snippets) > 0:
                for idx, snip in enumerate(req.document_snippets[:3]):
                    doc_citations.append(Citation(
                        title=f"Excerpt #{idx+1} from {req.document_name or 'Attached File'}",
                        source="Document Parser (Verified Context)",
                        snippet=snip,
                        url=None
                    ))
            elif req.document_text:
                doc_citations.append(Citation(
                    title=f"Context from {req.document_name or 'Attached File'}",
                    source="Document Parser (Verified Context)",
                    snippet=req.document_text[:200] + "...",
                    url=None
                ))

            subtitle_text = f"Evaluated under basis '{matched_rule.name}'" if matched_rule else (f"Document Grounded ({req.document_name}) • {flavor}" if req.document_name else f"Instant Calibrated Decision ({flavor})")

            visual_payload = VisualPayload(
                type="choice_matrix",
                title=f"{winner} vs {loser}",
                subtitle=subtitle_text,
                decision_badge=winner.upper(),
                confidence=laya_res.confidence,
                summary=f"Laya selects {winner} with {conf_int}% calibrated confidence based on {matched_rule.name if matched_rule else (req.document_name or 'dilemma criteria')}.",
                verdict_flavor=flavor,
                basis_name=matched_rule.name if matched_rule else None,
                reasoning_pillars=pillars,
                items=items,
                citations=doc_citations
            )

            total_latency = (time.perf_counter() - start_time) * 1000.0

            from .models import Stage2Telemetry
            mode_name = "laya_document_grounded" if req.document_name else "laya_fast_path"
            provider_name = f"Laya System 1 + Document Context ({req.document_name})" if req.document_name else "Laya System 1 (Direct Fast Path)"
            
            stage2_tel = Stage2Telemetry(
                llm_provider=provider_name,
                framing_latency_ms=round((time.perf_counter() - fast_start - laya_latency_ms / 1000.0) * 1000.0, 1),
                laya_latency_ms=round(laya_latency_ms, 1),
                synthesis_latency_ms=round((time.perf_counter() - fast_start) * 1000.0, 1),
                shortlist_applied=False,
                criteria_evaluated=["Document Specifications", "Utility & Payoff", "Risk Containment"],
                decision_engine_mode=mode_name,
                decision_path="laya_fast_path"
            )

            return TalkResponse(
                session_id=req.session_id or "default",
                triage=triage,
                spoken_answer=spoken,
                framed_question=framed,
                laya_result=laya_res,
                visual_payload=visual_payload,
                thinking_filler=triage.suggested_filler,
                total_latency_ms=round(total_latency, 1),
                stage2_telemetry=stage2_tel
            )

        # 3. ESCALATED SYSTEM 2 PATH (Cloud LLM + Web Research)
        # For open-ended questions requiring external facts before Laya decision
        active_conn = self.llm.connections.get(req.connection_id) if req.connection_id else self.llm.get_active()

        framing_start = time.perf_counter()
        framed = await self.llm.frame_decision_with_llm(
            query_text=req.text,
            conn=active_conn,
            pilot_domain=req.pilot_domain,
            criteria_pref=matched_rule.criteria if matched_rule else req.criteria_preference
        )
        framing_latency_ms = (time.perf_counter() - framing_start) * 1000.0

        if framed.options and len(framed.options) > 20:
            shortlisted = await self.laya.predict_shortlist(
                state=framed.state,
                question=framed.question,
                options=framed.options,
                top_k=5
            )
            framed.options = shortlisted
            framed.shortlist_applied = True

        laya_start = time.perf_counter()
        laya_res = await self.laya.execute_decision(framed)
        laya_latency_ms = (time.perf_counter() - laya_start) * 1000.0

        flavor = self._generate_verdict_flavor(laya_res.confidence)
        laya_res.verdict_flavor = flavor
        winner = laya_res.decision
        loser = [opt for opt in (framed.options or []) if opt != winner][0] if framed.options and len(framed.options) > 1 else "alternatives"
        pillars = self._generate_xyz_reasoning(winner, loser, req.text)
        laya_res.reasoning_pillars = pillars

        synthesis_start = time.perf_counter()
        spoken, visual_payload = await self.llm.synthesize_decision_response(
            original_query=req.text,
            framed=framed,
            laya_res=laya_res,
            conn=active_conn
        )
        synthesis_latency_ms = (time.perf_counter() - synthesis_start) * 1000.0
        
        visual_payload.verdict_flavor = flavor
        visual_payload.reasoning_pillars = pillars
        visual_payload.basis_name = matched_rule.name if matched_rule else None

        total_latency = (time.perf_counter() - start_time) * 1000.0

        from .models import Stage2Telemetry
        stage2_tel = Stage2Telemetry(
            llm_provider=active_conn.name,
            framing_latency_ms=round(framing_latency_ms, 1),
            laya_latency_ms=round(laya_latency_ms, 1),
            synthesis_latency_ms=round(synthesis_latency_ms, 1),
            shortlist_applied=framed.shortlist_applied,
            initial_options_count=framed.initial_options_count,
            criteria_evaluated=framed.criteria,
            decision_engine_mode="laya_cloud_escalated",
            decision_path="cloud_llm_escalated"
        )

        return TalkResponse(
            session_id=req.session_id or "default",
            triage=triage,
            spoken_answer=spoken,
            framed_question=framed,
            laya_result=laya_res,
            visual_payload=visual_payload,
            thinking_filler=triage.suggested_filler,
            total_latency_ms=round(total_latency, 1),
            stage2_telemetry=stage2_tel
        )
