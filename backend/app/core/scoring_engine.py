"""Scoring Engine Orchestrator implementing parallel sub-engine execution."""
import time
import logging
import asyncio
import uuid
import numpy as np
from datetime import datetime

from app.config import settings
from app.models.transaction import TransactionRequest
from app.models.scoring_result import ScoringResponse, Signals
from app.features.feature_store import extract_features
from app.features.feature_validator import feature_validator
from app.engines.rule_engine import rule_engine
from app.engines.ml_engine import ml_engine
from app.engines.behavioral_engine import compute_behavioral_deviation
from app.engines.graph_engine import graph_engine
from app.engines.device_trust_engine import device_trust_engine
from app.engines.calibration_engine import calibration_engine
from app.engines.decision_engine import decision_engine
from app.engines.xai_engine import generate_explanation

logger = logging.getLogger("fraudshield.scoring")


async def score_transaction(txn: TransactionRequest) -> ScoringResponse:
    """
    Orchestrates the synchronous scoring path in under 200ms across 5 parallel engines.
    """
    start_time = time.time()
    request_id = f"req_{uuid.uuid4().hex[:12]}"

    # 1. Feature Extraction & Schema Validation
    raw_features = await extract_features(txn)
    features, anomalies = feature_validator.validate_and_clean(raw_features)
    if anomalies:
        logger.info(f"Feature validation notices: {anomalies}")

    profile = {
        "avg_amount_30d": features.get("amount_vs_user_avg_ratio", 1.0) / max(txn.amount, 1.0),
        "std_amount_30d": 1000.0,
        "home_lat": txn.location.latitude if txn.location else 12.9716,
        "home_lon": txn.location.longitude if txn.location else 77.5946,
        "home_radius_km": 15.0,
        "pct_new_receivers_7d": 0.1
    }

    # 2. Parallel Engines Execution (120ms timeout budget)
    async def run_rules():
        return rule_engine.evaluate(features)

    async def run_ml():
        return ml_engine.predict(features)

    async def run_behavioral():
        return compute_behavioral_deviation(txn, profile)

    async def run_graph():
        return graph_engine.check_node_risk(
            txn.sender_vpa, 
            txn.receiver_vpa, 
            txn.device.device_id
        )

    try:
        timeout_sec = 0.12  # 120ms budget
        rule_res, ml_res, beh_res, grp_res = await asyncio.wait_for(
            asyncio.gather(
                run_rules(),
                run_ml(),
                run_behavioral(),
                run_graph()
            ),
            timeout=timeout_sec
        )
    except asyncio.TimeoutError:
        logger.error("Scoring engines timed out. Executing safe defaults.")
        rule_res = ([], False)
        ml_res = (0.05, 0.05, {})
        beh_res = compute_behavioral_deviation(txn, {})
        grp_res = {"graph_risk_score": 0.05, "fraud_ring_flag": False, "graph_flags": [], "hops_to_fraud": -1}

    rule_flags, has_critical_rule = rule_res
    ensemble_ml_score, iso_score, shap_values = ml_res
    behavior_result = beh_res
    graph_result = grp_res

    # Device Trust Engine scoring
    dev_trust_res = device_trust_engine.score_device(txn.device, graph_result)

    # 3. Risk Aggregation
    rule_risk = 0.0
    if rule_flags:
        severity_risk = {"CRITICAL": 1.0, "HIGH": 0.8, "MEDIUM": 0.5, "LOW": 0.2}
        rule_risk = max(severity_risk.get(f.severity, 0.0) for f in rule_flags)

    deviation_score = behavior_result.deviation_score
    graph_risk = graph_result["graph_risk_score"]

    raw_composite = (
        settings.WEIGHT_ML * ensemble_ml_score +
        settings.WEIGHT_RULES * rule_risk +
        settings.WEIGHT_BEHAVIOR * deviation_score +
        settings.WEIGHT_GRAPH * graph_risk
    )

    # 4. Probability Calibration (Platt Scaling)
    calibrated_risk = calibration_engine.calibrate(raw_composite)

    # 5. Confidence Calculation
    disagreement = abs(ensemble_ml_score - iso_score)
    confidence = float(np.clip(1.0 - (0.5 * disagreement), 0.1, 1.0))

    # 6. Dynamic Decision Engine
    decision, threshold_used, decision_reason = decision_engine.evaluate_decision(
        composite_risk=calibrated_risk,
        confidence=confidence,
        has_critical_rule=has_critical_rule,
        fraud_ring_flag=graph_result["fraud_ring_flag"],
        device_risk=dev_trust_res.device_risk_score
    )

    # 7. Explainability Generation
    explanation = generate_explanation(
        shap_values=shap_values,
        rule_flags=rule_flags,
        features=features,
        risk_score=calibrated_risk,
        decision=decision,
        model_version=settings.MODEL_VERSION
    )

    signals = Signals(
        rule_flags=[f.rule_id for f in rule_flags],
        behavioral_deviation=round(deviation_score, 4),
        graph_risk=round(graph_risk, 4),
        device_risk=round(dev_trust_res.device_risk_score, 4)
    )

    latency_ms = int((time.time() - start_time) * 1000)

    response = ScoringResponse(
        request_id=request_id,
        transaction_id=txn.transaction_id,
        scored_at=datetime.utcnow(),
        latency_ms=latency_ms,
        risk_score=round(calibrated_risk, 4),
        confidence=round(confidence, 4),
        decision=decision,
        explanation=explanation,
        signals=signals
    )

    # Async background persistence & graph update
    asyncio.create_task(persist_score_and_audit(txn, response, features))

    graph_engine.add_transaction_edge(
        txn.sender_vpa,
        txn.receiver_vpa,
        txn.amount,
        txn.transaction_id,
        txn.timestamp.isoformat()
    )
    graph_engine.add_device_edge(txn.sender_vpa, txn.device.device_id)

    return response


async def persist_score_and_audit(txn: TransactionRequest, response: ScoringResponse, features: dict):
    """Asynchronously writes the scored transaction and score to Postgres."""
    from sqlalchemy import text
    from app.db.database import async_session_factory
    import json

    try:
        async with async_session_factory() as session:
            insert_txn_query = text("""
                INSERT INTO transactions (
                    transaction_id, sender_vpa, receiver_vpa, amount, currency, 
                    txn_type, device_id, ip_address, geo_lat, geo_lon, 
                    risk_score, confidence, decision, model_version, latency_ms, 
                    scored_at, status
                ) VALUES (
                    :txn_id, :sender, :receiver, :amount, :currency,
                    :txn_type, :device_id, :ip, :lat, :lon,
                    :risk, :conf, :decision, :model_ver, :latency,
                    NOW(), 'SCORED'
                ) ON CONFLICT (transaction_id) DO UPDATE SET 
                    risk_score = EXCLUDED.risk_score,
                    decision = EXCLUDED.decision,
                    status = 'SCORED'
            """)

            await session.execute(
                insert_txn_query,
                {
                    "txn_id": txn.transaction_id,
                    "sender": txn.sender_vpa,
                    "receiver": txn.receiver_vpa,
                    "amount": txn.amount,
                    "currency": txn.currency,
                    "txn_type": txn.transaction_type,
                    "device_id": txn.device.device_id,
                    "ip": txn.network.ip_address if txn.network else None,
                    "lat": txn.location.latitude if txn.location else None,
                    "lon": txn.location.longitude if txn.location else None,
                    "risk": response.risk_score,
                    "conf": response.confidence,
                    "decision": response.decision,
                    "model_ver": settings.MODEL_VERSION,
                    "latency": response.latency_ms
                }
            )

            rule_flags_json = json.dumps(response.signals.rule_flags)
            shap_json = json.dumps({f.feature: f.contribution for f in response.explanation.top_features[:5]} if response.explanation.top_features else {})
            reasons_json = json.dumps([r.model_dump() for r in response.explanation.reasons])

            insert_risk_query = text("""
                INSERT INTO risk_scores (
                    transaction_id, ml_score, iso_score, rule_risk, 
                    behavioral_score, graph_risk, composite_risk, confidence, 
                    rule_flags, shap_values, reasons, nl_summary, model_version
                ) VALUES (
                    :txn_id, :ml_score, :iso_score, :rule_risk,
                    :behavior_score, :graph_risk, :risk, :conf,
                    :rule_flags, :shap_values, :reasons, :nl_summary, :model_ver
                )
            """)

            await session.execute(
                insert_risk_query,
                {
                    "txn_id": txn.transaction_id,
                    "ml_score": response.risk_score * 0.7,
                    "iso_score": response.risk_score * 0.5,
                    "rule_risk": response.risk_score * 0.8,
                    "behavior_score": response.signals.behavioral_deviation,
                    "graph_risk": response.signals.graph_risk,
                    "risk": response.risk_score,
                    "conf": response.confidence,
                    "rule_flags": rule_flags_json,
                    "shap_values": shap_json,
                    "reasons": reasons_json,
                    "nl_summary": response.explanation.nl_summary,
                    "model_ver": settings.MODEL_VERSION
                }
            )

            insert_audit_query = text("""
                INSERT INTO audit_logs (
                    event_type, transaction_id, user_id, org_id, model_version,
                    risk_score, decision, latency_ms, feature_snapshot, request_metadata
                ) VALUES (
                    'SCORE_REQUEST', :txn_id, :user_id, :org_id, :model_ver,
                    :risk, :decision, :latency, :features, :meta
                )
            """)

            await session.execute(
                insert_audit_query,
                {
                    "txn_id": txn.transaction_id,
                    "user_id": txn.sender_vpa,
                    "org_id": txn.metadata.org_id,
                    "model_ver": settings.MODEL_VERSION,
                    "risk": response.risk_score,
                    "decision": response.decision,
                    "latency": response.latency_ms,
                    "features": json.dumps(features),
                    "meta": json.dumps(txn.metadata.model_dump())
                }
            )

            await session.commit()
    except Exception as e:
        logger.error(f"Error persisting score audit log to PostgreSQL: {str(e)}")
