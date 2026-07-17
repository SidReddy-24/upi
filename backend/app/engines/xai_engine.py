"""Explainable AI (XAI) Engine generating reason codes and natural language summaries."""
from app.models.scoring_result import ReasonCode, FeatureContribution, Explanation
from app.engines.rule_engine import RuleFlag

# Reason code definitions from SRD Section 11.3
REASON_CODE_MAP = {
    "vel_txn_count_1m":          ("HIGH_VELOCITY",        "Unusually high transaction frequency in the last minute", "HIGH"),
    "device_is_new":             ("NEW_DEVICE",            "Transaction initiated from a device not seen before", "HIGH"),
    "amount_vs_user_avg_ratio":  ("UNUSUAL_AMOUNT",        "Transaction amount significantly exceeds user's typical spending", "MEDIUM"),
    "receiver_is_blacklisted":   ("BLACKLISTED_RECEIVER",  "Recipient VPA is on the fraud blacklist", "CRITICAL"),
    "geo_is_impossible_travel":  ("IMPOSSIBLE_TRAVEL",     "Transaction location is physically inconsistent with recent activity", "HIGH"),
    "device_is_emulator":        ("EMULATOR_DETECTED",     "Transaction originated from a device emulator", "HIGH"),
    "device_is_rooted":          ("ROOTED_DEVICE",         "Device has been rooted or jailbroken", "MEDIUM"),
    "geo_distance_from_last_txn_km": ("LOCATION_ANOMALY", "Transaction location is significantly different from recent location", "MEDIUM"),
    "amount_vs_user_max_ratio":  ("EXTREME_AMOUNT",        "Transaction amount exceeds historical maximum spending", "HIGH"),
    "sender_graph_risk_score":   ("FRAUD_NETWORK_PROXIMITY","Sender is in close proximity to known fraud accounts", "HIGH")
}

def generate_explanation(
    shap_values: dict[str, float], 
    rule_flags: list[RuleFlag], 
    features: dict[str, float],
    risk_score: float,
    decision: str,
    model_version: str
) -> Explanation:
    """
    Assembles SHAP feature contributions, triggers reason codes, and generates
    natural language summaries.
    """
    reasons = []
    top_features = []
    
    # 1. Process SHAP values
    sorted_shaps = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)
    
    for feature_name, val in sorted_shaps:
        if abs(val) < 0.001:
            continue
            
        direction = "INCREASES_RISK" if val > 0 else "DECREASES_RISK"
        feat_val = features.get(feature_name, 0.0)
        
        top_features.append(
            FeatureContribution(
                feature=feature_name,
                value=feat_val,
                contribution=round(val, 4),
                direction=direction
            )
        )
        
        # Trigger reason code if contribution is positive and feature is in code map
        if val > 0.05 and feature_name in REASON_CODE_MAP:
            code, desc, severity = REASON_CODE_MAP[feature_name]
            reasons.append(
                ReasonCode(
                    code=code,
                    description=desc,
                    severity=severity,
                    contribution=round(val, 4)
                )
            )

    # 2. Integrate rule flags
    for flag in rule_flags:
        # Check if already added via SHAP to avoid duplicate descriptions
        already_added = any(r.code == flag.rule_id for r in reasons)
        if not already_added:
            reasons.append(
                ReasonCode(
                    code=flag.rule_id,
                    description=flag.explanation,
                    severity=flag.severity,
                    contribution=None
                )
            )

    # Sort reasons: CRITICAL > HIGH > MEDIUM > LOW, then by contribution
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    reasons.sort(key=lambda r: (severity_order.get(r.severity, 4), -abs(r.contribution or 0.0)))
    
    # Cap at top 5 reasons (SRD Section 11.3)
    reasons = reasons[:5]
    
    # 3. Generate natural language summary (SRD Section 11.4)
    decision_text = {
        "APPROVE": "appears to be legitimate",
        "REVIEW": "shows some suspicious signals and requires manual review",
        "REJECT": "has been blocked due to high fraud risk"
    }.get(decision, "is under review")
    
    reason_texts = [r.description for r in reasons if r.severity in ["CRITICAL", "HIGH", "MEDIUM"]]
    reasons_str = "; ".join(reason_texts[:3]) if reason_texts else "no significant fraud signals detected"
    
    nl_summary = (
        f"This transaction {decision_text} (risk score: {risk_score:.0%}). "
        f"Primary signals: {reasons_str}."
    )

    return Explanation(
        nl_summary=nl_summary,
        reasons=reasons,
        top_features=top_features[:10],  # Return top 10 features
        model_version=model_version
    )
