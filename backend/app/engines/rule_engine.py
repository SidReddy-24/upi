"""Rule Engine executing dynamic JSON-DSL rules."""
import logging
from sqlalchemy import text
from app.db.database import async_session_factory

logger = logging.getLogger("fraudshield.rules")

class RuleFlag:
    def __init__(self, rule_id: str, name: str, severity: str, explanation: str):
        self.rule_id = rule_id
        self.name = name
        self.severity = severity
        self.explanation = explanation

class RuleEngine:
    def __init__(self):
        self.rules = []

    async def reload_rules(self):
        """Loads active rules from PostgreSQL database."""
        logger.info("Loading active rules from DB...")
        try:
            async with async_session_factory() as session:
                result = await session.execute(
                    text("SELECT rule_id, name, condition_dsl, action, severity, explanation, priority FROM rules WHERE is_active = TRUE ORDER BY priority ASC")
                )
                self.rules = []
                for row in result.all():
                    self.rules.append({
                        "rule_id": row[0],
                        "name": row[1],
                        "condition": row[2],
                        "action": row[3],
                        "severity": row[4],
                        "explanation": row[5],
                        "priority": row[6]
                    })
            logger.info(f"Loaded {len(self.rules)} active rules successfully.")
        except Exception as e:
            logger.error(f"Failed to load rules from database: {str(e)}")

    def _evaluate_condition(self, condition: dict, features: dict[str, float]) -> bool:
        """Evaluates a JSON-DSL condition against feature vector."""
        if "AND" in condition:
            return all(self._evaluate_condition(cond, features) for cond in condition["AND"])
        if "OR" in condition:
            return any(self._evaluate_condition(cond, features) for cond in condition["OR"])
        
        # Single condition: {"feature": "...", "op": "...", "value": ...}
        feat_name = condition.get("feature")
        op = condition.get("op")
        val = condition.get("value")
        
        if not feat_name or feat_name not in features:
            return False
            
        feat_val = features[feat_name]
        
        if op == "gt":
            return feat_val > val
        if op == "lt":
            return feat_val < val
        if op == "eq":
            return feat_val == val
        if op == "gte":
            return feat_val >= val
        if op == "lte":
            return feat_val <= val
        if op == "ne":
            return feat_val != val
        if op == "in_range" and isinstance(val, (list, tuple)) and len(val) == 2:
            return val[0] <= feat_val <= val[1]
        if op == "in_list" and isinstance(val, list):
            return feat_val in val
        if op == "not_in" and isinstance(val, list):
            return feat_val not in val
        if op == "is_null":
            return feat_val is None or feat_val == 0.0

        return False

    def evaluate(self, features: dict[str, float]) -> tuple[list[RuleFlag], bool]:
        """
        Evaluates features against all loaded rules.
        Returns a list of triggered RuleFlag objects and whether any CRITICAL rule triggered.
        """
        triggered_flags = []
        has_critical = False
        
        for r in self.rules:
            try:
                # If rule has no condition or evaluates to True, it triggers
                cond = r.get("condition")
                if not cond or self._evaluate_condition(cond, features):
                    flag = RuleFlag(
                        rule_id=r["rule_id"],
                        name=r["name"],
                        severity=r["severity"],
                        explanation=r["explanation"]
                    )
                    triggered_flags.append(flag)
                    if r["severity"] == "CRITICAL" and r["action"] == "REJECT":
                        has_critical = True
            except Exception as e:
                logger.error(f"Error evaluating rule {r.get('rule_id')}: {str(e)}")
                
        return triggered_flags, has_critical


rule_engine = RuleEngine()
