import os
import json
import logging
import re
from typing import List, Optional, Tuple
from .models import ClassificationRule, ClassificationSettings, RuleSuggestionResponse
from .llm_manager import LLMManager

logger = logging.getLogger("classification_service")

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
RULES_FILE = os.path.join(DATA_DIR, "classification_rules.json")

DEFAULT_RULES = [
    ClassificationRule(
        id="rule-tech-sample",
        name="Tech Hardware & Developer Gear",
        priority=1,
        domain_keywords=["macbook", "laptop", "thinkpad", "m4", "gpu", "framework", "keyboard", "monitor"],
        decision_type="choice",
        criteria=[
            "Developer Ergonomics & Workflow",
            "Battery Endurance & Portability",
            "Sustained Thermal Performance",
            "Resale Value & Longevity"
        ],
        steering_prompt="Prioritize developer ergonomics, battery endurance, and unified memory bandwidth over raw peak synthetic clock speeds.",
        requires_research=False,
        is_active=True
    ),
    ClassificationRule(
        id="rule-career-sample",
        name="Career & Startup Bets",
        priority=2,
        domain_keywords=["career", "startup", "corporate", "job", "offer", "equity", "salary", "founder", "hiring"],
        decision_type="multi_criteria",
        criteria=[
            "Long-Term Career Leverage & Compounding",
            "Equity Upside vs Downside Safety",
            "Learning Velocity & Autonomy",
            "Work-Life Sustainability"
        ],
        steering_prompt="Favor asymmetric learning upside, equity growth potential, and direct agency over comfortable corporate bureaucracy.",
        requires_research=False,
        is_active=True
    ),
    ClassificationRule(
        id="rule-food-sample",
        name="Daily Dining & Satiety",
        priority=3,
        domain_keywords=["pizza", "sushi", "eat", "food", "cook", "order", "dinner", "lunch", "restaurant"],
        decision_type="choice",
        criteria=[
            "Immediate Craving & Flavor Match",
            "Preparation Speed & Delivery Friction",
            "Post-Meal Alertness & Net Utility"
        ],
        steering_prompt="Balance immediate craving satisfaction with post-meal digestive energy and mental clarity.",
        requires_research=False,
        is_active=True
    ),
    ClassificationRule(
        id="rule-fitness-sample",
        name="Fitness & Physical Recovery",
        priority=4,
        domain_keywords=["gym", "workout", "sleep", "rest", "diet", "run", "lift", "training", "exercise"],
        decision_type="choice",
        criteria=[
            "Habit Compounding Payoff",
            "Systemic Fatigue vs Recovery State",
            "Injury Prevention & Longevity"
        ],
        steering_prompt="Compound positive momentum; if systemic fatigue is dangerously high, prioritize strategic restorative recovery.",
        requires_research=False,
        is_active=True
    ),
]

class ClassificationService:
    def __init__(self, data_file: str = RULES_FILE):
        self.data_file = data_file
        self.settings: ClassificationSettings = self._load()

    def _load(self) -> ClassificationSettings:
        os.makedirs(os.path.dirname(self.data_file), exist_ok=True)
        if os.path.exists(self.data_file):
            try:
                with open(self.data_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return ClassificationSettings(**data)
            except Exception as e:
                logger.error(f"Failed to load classification rules: {e}. Reverting to defaults.")
        
        # Initialize with sample rules
        initial_settings = ClassificationSettings(
            risk_tolerance="balanced",
            hedging_threshold=0.78,
            rules=DEFAULT_RULES
        )
        self._save_settings(initial_settings)
        return initial_settings

    def _save_settings(self, settings: ClassificationSettings):
        try:
            os.makedirs(os.path.dirname(self.data_file), exist_ok=True)
            with open(self.data_file, "w", encoding="utf-8") as f:
                json.dump(settings.dict(), f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save classification rules: {e}")

    def get_settings(self) -> ClassificationSettings:
        return self.settings

    def update_settings(self, new_settings: ClassificationSettings) -> ClassificationSettings:
        self.settings = new_settings
        self._save_settings(self.settings)
        return self.settings

    def save_rule(self, rule: ClassificationRule) -> ClassificationRule:
        existing = [r for r in self.settings.rules if r.id == rule.id]
        if existing:
            # Update
            self.settings.rules = [rule if r.id == rule.id else r for r in self.settings.rules]
        else:
            # Append new rule
            self.settings.rules.append(rule)
        
        # Keep rules sorted by priority rank (1 = highest)
        self.settings.rules.sort(key=lambda r: (r.priority, -len(r.domain_keywords)))
        self._save_settings(self.settings)
        return rule

    def delete_rule(self, rule_id: str) -> bool:
        initial_len = len(self.settings.rules)
        self.settings.rules = [r for r in self.settings.rules if r.id != rule_id]
        if len(self.settings.rules) != initial_len:
            self._save_settings(self.settings)
            return True
        return False

    def find_matching_rule(self, query: str) -> Optional[ClassificationRule]:
        """
        Matches incoming query against active classification rules.
        Priority Rank (1 is highest) is evaluated first.
        Ties are broken by keyword specificity (count of matched keywords).
        """
        cleaned = query.lower()
        words = set(re.findall(r"\b\w{3,}\b", cleaned))

        candidates: List[Tuple[ClassificationRule, int]] = []
        for rule in self.settings.rules:
            if not rule.is_active:
                continue
            
            overlap = 0
            for kw in rule.domain_keywords:
                kw_lower = kw.lower().strip()
                if not kw_lower:
                    continue
                # Check exact phrase or word overlap
                if kw_lower in cleaned or any(kw_part in words for kw_part in kw_lower.split()):
                    overlap += 1

            if overlap > 0:
                candidates.append((rule, overlap))

        if not candidates:
            return None

        # Sort by: 1) priority rank ascending (1 is best), 2) overlap count descending
        candidates.sort(key=lambda item: (item[0].priority, -item[1]))
        return candidates[0][0]

    async def suggest_rule(self, query: str, llm_mgr: LLMManager) -> RuleSuggestionResponse:
        """
        Suggests how Laya can classify the query.
        Uses active LLM if available; otherwise falls back instantly to fast local heuristics.
        """
        active_conn = llm_mgr.get_active()
        
        # 1. Try Cloud LLM if API key is present
        if active_conn and active_conn.api_key and active_conn.api_key.strip():
            try:
                system_prompt = (
                    "You are the Laya Decision Engine Classifier. "
                    "Analyze the decision query and formulate a structured classification rule.\n"
                    "Output strict JSON with fields:\n"
                    "- name: Concise domain title (e.g. 'Automotive Purchase & Financing')\n"
                    "- domain_keywords: List of 4-6 trigger keywords\n"
                    "- decision_type: 'choice' | 'multi_criteria' | 'noul' | 'score'\n"
                    "- criteria: List of 3-4 explicit evaluation dimensions\n"
                    "- steering_prompt: Actionable decision bias/heuristic guidance\n"
                    "- priority: Recommended integer priority rank (1-5)\n"
                    "- requires_research: boolean (true if real-time web facts are needed)\n"
                    "- reasoning: Short explanation of why this basis was selected."
                )
                user_msg = f"Decision Query: \"{query}\""
                resp_text = await llm_mgr.generate_completion(active_conn, [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_msg}
                ])
                # Parse JSON
                clean_json = re.sub(r"```(?:json)?", "", resp_text).strip().rstrip("`")
                data = json.loads(clean_json)
                return RuleSuggestionResponse(
                    name=data.get("name", "Custom Decision Basis"),
                    domain_keywords=data.get("domain_keywords", ["decision"]),
                    decision_type=data.get("decision_type", "choice"),
                    criteria=data.get("criteria", ["Utility", "Risk", "Execution"]),
                    steering_prompt=data.get("steering_prompt", "Maximize net expected value."),
                    priority=data.get("priority", 2),
                    requires_research=bool(data.get("requires_research", False)),
                    reasoning=data.get("reasoning", "Suggested based on decision intent.")
                )
            except Exception as e:
                logger.warn(f"LLM rule suggestion failed ({e}). Falling back to fast local heuristics.")

        # 2. Fast Local Heuristic Engine (zero network, instant <5ms)
        return self._suggest_local_heuristics(query)

    def _suggest_local_heuristics(self, query: str) -> RuleSuggestionResponse:
        cleaned = query.strip()
        words = [w.lower() for w in re.findall(r"\b\w{3,}\b", cleaned) if w.lower() not in {"what", "which", "should", "between", "versus", "with", "this", "that"}]

        # Check for binary approval query
        if re.search(r"^(?:should\s+(?:i|we)|is\s+it\s+worth|can\s+(?:i|we))\b", cleaned, re.IGNORECASE):
            d_type = "noul"
            criteria = ["Net Expected Utility", "Execution Risk & Tail Hazards", "Opportunity Cost"]
            steering = "Favor actionable commitment only when risk-adjusted payoff exceeds baseline inaction."
        elif " vs " in cleaned.lower() or " or " in cleaned.lower():
            d_type = "choice"
            criteria = ["Core Performance & Quality", "Friction & Cost of Ownership", "Long-Term Compounding Viability"]
            steering = "Prioritize sustained long-term leverage and friction minimization over superficial features."
        else:
            d_type = "multi_criteria"
            criteria = ["Strategic Alignment", "Capital / Resource Allocation", "Downside Risk Protection", "Execution Velocity"]
            steering = "Optimize for systemic resilience and high-probability compounding outcomes."

        # Extract domain name
        domain_noun = words[0].title() if words else "General"
        keywords = words[:5] if words else ["decision", "arbitration"]

        return RuleSuggestionResponse(
            name=f"{domain_noun} Arbitration Basis",
            domain_keywords=keywords,
            decision_type=d_type,
            criteria=criteria,
            steering_prompt=steering,
            priority=2,
            requires_research=False,
            reasoning="Fast local heuristic analysis based on linguistic decision structure and domain nouns."
        )
