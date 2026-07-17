"""Pydantic schemas for Transaction Request validation."""
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from typing import Optional


class DeviceInfo(BaseModel):
    device_id: str = Field(..., description="Unique hardware-bound device ID")
    os_type: Optional[str] = Field("ANDROID", description="OS: ANDROID, IOS")
    os_version: Optional[str] = Field(None, description="OS major/minor version")
    app_version: Optional[str] = Field(None, description="Client app version")
    is_rooted: Optional[bool] = Field(False, description="Root/Jailbreak detection flag")
    is_emulator: Optional[bool] = Field(False, description="Emulator detection flag")
    screen_resolution: Optional[str] = Field(None, description="e.g. 1080x2400")
    carrier_hash: Optional[str] = Field(None, description="Hash of SIM Mobile Network Operator")
    sim_hash: Optional[str] = Field(None, description="Hash of SIM Serial Number")


class LocationInfo(BaseModel):
    latitude: Optional[float] = Field(None, description="GPS Latitude")
    longitude: Optional[float] = Field(None, description="GPS Longitude")
    accuracy_meters: Optional[int] = Field(None, description="GPS accuracy in meters")
    location_method: Optional[str] = Field("GPS", description="GPS, Network, IP, etc.")


class NetworkInfo(BaseModel):
    ip_address: Optional[str] = Field(None, description="IPV4 or IPV6 address")
    connection_type: Optional[str] = Field(None, description="4G, 5G, Wifi")
    isp: Optional[str] = Field(None, description="Internet Service Provider")


class TransactionMetadata(BaseModel):
    org_id: str = Field(..., description="Requesting organization client ID")
    channel: Optional[str] = Field("mobile_app", description="App, Web, API")
    session_id: Optional[str] = Field(None, description="Client session ID")


class TransactionRequest(BaseModel):
    transaction_id: str = Field(..., description="Unique transaction reference ID")
    sender_vpa: str = Field(..., description="Sender virtual payment address")
    receiver_vpa: str = Field(..., description="Receiver virtual payment address")
    amount: float = Field(..., description="Transaction amount in INR")
    currency: str = Field("INR", description="Three-letter currency code")
    transaction_type: str = Field("P2P", description="P2P or P2M")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="ISO-8601 Timestamp of transaction")
    device: DeviceInfo
    location: Optional[LocationInfo] = None
    network: Optional[NetworkInfo] = None
    metadata: TransactionMetadata

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than zero")
        if v > 200000:
            raise ValueError("Amount exceeds UPI single daily limit of ₹200,000")
        return v

    @field_validator("sender_vpa", "receiver_vpa")
    @classmethod
    def validate_vpa(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("Invalid VPA format. Must contain '@'")
        return v
