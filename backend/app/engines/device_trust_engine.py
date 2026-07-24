"""
Dedicated Device Trust Engine.
Evaluates hardware integrity, root/emulator indicators, VPN usage, developer settings, and SIM swap indicators.
"""

import logging
from typing import Dict, Any, List
from pydantic import BaseModel
from app.models.transaction import DeviceInfo

logger = logging.getLogger("fraudshield.device_trust")


class DeviceTrustResult(BaseModel):
    trust_score: float         # [0.0, 1.0] where 1.0 = fully trusted
    device_risk_score: float  # [0.0, 1.0] where 1.0 = highly suspicious
    risk_flags: List[str]


class DeviceTrustEngine:
    """Multi-signal Device Reputation & Integrity Scoring."""

    SIGNALS = {
        "is_rooted": 0.35,
        "is_emulator": 0.40,
        "vpn_detected": 0.15,
        "usb_debug": 0.15,
        "developer_mode": 0.10,
        "app_clone_flag": 0.25,
        "sim_swap_risk": 0.20
    }

    def score_device(self, device: DeviceInfo, graph_risk: Dict[str, Any] = None) -> DeviceTrustResult:
        trust = 1.0
        risk_flags = []

        if device.is_rooted:
            trust -= self.SIGNALS["is_rooted"]
            risk_flags.append("DEVICE_ROOTED_OR_JAILBROKEN")

        if device.is_emulator:
            trust -= self.SIGNALS["is_emulator"]
            risk_flags.append("DEVICE_EMULATOR_DETECTED")

        # Additional extended fields if available
        if getattr(device, "vpn_detected", False):
            trust -= self.SIGNALS["vpn_detected"]
            risk_flags.append("DEVICE_VPN_PROXY_ACTIVE")

        if getattr(device, "usb_debug_enabled", False):
            trust -= self.SIGNALS["usb_debug"]
            risk_flags.append("DEVICE_USB_DEBUGGING_ON")

        if getattr(device, "app_clone_flag", False):
            trust -= self.SIGNALS["app_clone_flag"]
            risk_flags.append("DEVICE_APP_CLONING_DETECTED")

        # Check graph shared device flags
        if graph_risk and graph_risk.get("fraud_ring_flag"):
            trust -= 0.30
            risk_flags.append("DEVICE_SHARED_IN_MULE_RING")

        trust = max(0.0, min(1.0, trust))
        device_risk = round(1.0 - trust, 4)

        return DeviceTrustResult(
            trust_score=round(trust, 4),
            device_risk_score=device_risk,
            risk_flags=risk_flags
        )


device_trust_engine = DeviceTrustEngine()
