"""
SQLAlchemy models for authentication system.
Phase 9: SentinelPay Advanced Features

Models:
- AuthUser: User authentication data
- OTPVerification: OTP codes for phone verification
- RefreshToken: JWT refresh tokens for session management
- GuardianRelationship: Guardian relationships for transaction approval
- GuardianApprovalRequest: Guardian approval requests
"""

from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, DECIMAL,
    ForeignKey, CheckConstraint, UniqueConstraint, text, TIMESTAMP
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, declarative_base
import uuid

Base = declarative_base()


class AuthUser(Base):
    """
    User authentication model.
    Separate from fraud detection users table.
    
    Requirements: 5.1, 5.19, 5.20
    """
    __tablename__ = 'auth_users'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String(15), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    vpa = Column(String(100), unique=True, nullable=False)
    name = Column(String(100), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('NOW()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('NOW()'), onupdate=datetime.utcnow)
    last_login = Column(TIMESTAMP(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    guardian_relationships = relationship("GuardianRelationship", back_populates="user", 
                                         foreign_keys="GuardianRelationship.user_id",
                                         cascade="all, delete-orphan")
    guardian_of = relationship("GuardianRelationship", back_populates="guardian_user",
                              foreign_keys="GuardianRelationship.guardian_user_id")
    approval_requests = relationship("GuardianApprovalRequest", back_populates="user",
                                   cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("phone ~ '^\\+?[1-9]\\d{1,14}$'", name='chk_phone_format'),
        CheckConstraint(
            "email IS NULL OR email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$'",
            name='chk_email_format'
        ),
    )
    
    def __repr__(self):
        return f"<AuthUser(id={self.id}, phone={self.phone}, vpa={self.vpa})>"


class OTPVerification(Base):
    """
    OTP verification model for phone authentication.
    OTPs expire after 5 minutes.
    
    Requirements: 5.2, 5.3, 5.15
    """
    __tablename__ = 'otp_verifications'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String(15), nullable=False)
    otp_code = Column(String(6), nullable=False)
    purpose = Column(String(20), nullable=False)  # REGISTRATION, PASSWORD_RESET, LOGIN
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    verified = Column(Boolean, default=False)
    verified_at = Column(TIMESTAMP(timezone=True), nullable=True)
    attempts = Column(Integer, default=0)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('NOW()'))
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "purpose IN ('REGISTRATION', 'PASSWORD_RESET', 'LOGIN')",
            name='chk_otp_purpose'
        ),
        CheckConstraint("otp_code ~ '^\\d{6}$'", name='chk_otp_code_format'),
        CheckConstraint('attempts <= 5', name='chk_attempts_limit'),
    )
    
    @property
    def is_expired(self) -> bool:
        """Check if OTP has expired."""
        return datetime.utcnow() > self.expires_at
    
    @property
    def is_valid(self) -> bool:
        """Check if OTP is valid (not verified, not expired, attempts < 5)."""
        return not self.verified and not self.is_expired and self.attempts < 5
    
    def __repr__(self):
        return f"<OTPVerification(phone={self.phone}, purpose={self.purpose}, verified={self.verified})>"


class RefreshToken(Base):
    """
    Refresh token model for JWT session management.
    Tokens expire after 30 days.
    
    Requirements: 5.13, 5.14, 5.21
    """
    __tablename__ = 'refresh_tokens'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('auth_users.id', ondelete='CASCADE'), nullable=False)
    token = Column(String(500), unique=True, nullable=False)
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('NOW()'))
    last_used_at = Column(TIMESTAMP(timezone=True), nullable=True)
    revoked = Column(Boolean, default=False)
    revoked_at = Column(TIMESTAMP(timezone=True), nullable=True)
    device_info = Column(JSONB, nullable=True)
    
    # Relationships
    user = relationship("AuthUser", back_populates="refresh_tokens")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("token != ''", name='chk_token_not_empty'),
    )
    
    @property
    def is_expired(self) -> bool:
        """Check if refresh token has expired."""
        return datetime.utcnow() > self.expires_at
    
    @property
    def is_valid(self) -> bool:
        """Check if refresh token is valid (not revoked, not expired)."""
        return not self.revoked and not self.is_expired
    
    def revoke(self):
        """Revoke this refresh token."""
        self.revoked = True
        self.revoked_at = datetime.utcnow()
    
    def __repr__(self):
        return f"<RefreshToken(id={self.id}, user_id={self.user_id}, revoked={self.revoked})>"


class GuardianRelationship(Base):
    """
    Guardian relationship model.
    Users can add up to 5 active guardians to approve high-risk transactions.
    
    Requirements: 2.1, 2.14, 2.15
    """
    __tablename__ = 'guardian_relationships'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('auth_users.id', ondelete='CASCADE'), nullable=False)
    guardian_phone = Column(String(15), nullable=True)
    guardian_vpa = Column(String(100), nullable=True)
    guardian_user_id = Column(UUID(as_uuid=True), ForeignKey('auth_users.id', ondelete='SET NULL'), nullable=True)
    status = Column(String(20), nullable=False, default='PENDING')  # PENDING, ACTIVE, REJECTED, REMOVED
    invited_at = Column(TIMESTAMP(timezone=True), server_default=text('NOW()'))
    accepted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    rejected_at = Column(TIMESTAMP(timezone=True), nullable=True)
    removed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('NOW()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('NOW()'), onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("AuthUser", back_populates="guardian_relationships", foreign_keys=[user_id])
    guardian_user = relationship("AuthUser", back_populates="guardian_of", foreign_keys=[guardian_user_id])
    approval_requests = relationship("GuardianApprovalRequest", back_populates="guardian",
                                   cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'ACTIVE', 'REJECTED', 'REMOVED')",
            name='chk_guardian_status'
        ),
        CheckConstraint(
            'guardian_phone IS NOT NULL OR guardian_vpa IS NOT NULL',
            name='chk_guardian_contact'
        ),
        CheckConstraint('user_id != guardian_user_id', name='chk_not_self_guardian'),
        UniqueConstraint('user_id', 'guardian_phone', 'guardian_vpa', name='unique_user_guardian'),
    )
    
    def accept(self):
        """Accept guardian invitation."""
        self.status = 'ACTIVE'
        self.accepted_at = datetime.utcnow()
    
    def reject(self):
        """Reject guardian invitation."""
        self.status = 'REJECTED'
        self.rejected_at = datetime.utcnow()
    
    def remove(self):
        """Remove guardian relationship."""
        self.status = 'REMOVED'
        self.removed_at = datetime.utcnow()
    
    def __repr__(self):
        return f"<GuardianRelationship(id={self.id}, user_id={self.user_id}, status={self.status})>"


class GuardianApprovalRequest(Base):
    """
    Guardian approval request model.
    Created when a transaction requires guardian approval (fraud score > 0.7).
    Expires after 5 minutes.
    
    Requirements: 2.5, 2.6, 2.10
    """
    __tablename__ = 'guardian_approval_requests'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(String(64), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('auth_users.id', ondelete='CASCADE'), nullable=False)
    guardian_id = Column(UUID(as_uuid=True), ForeignKey('guardian_relationships.id', ondelete='CASCADE'), nullable=False)
    amount = Column(DECIMAL(10, 2), nullable=False)
    recipient_vpa = Column(String(100), nullable=False)
    fraud_score = Column(DECIMAL(3, 2), nullable=False)
    risk_signals = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    status = Column(String(20), nullable=False, default='PENDING')  # PENDING, APPROVED, REJECTED, EXPIRED
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    responded_at = Column(TIMESTAMP(timezone=True), nullable=True)
    response_note = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('NOW()'))
    
    # Relationships
    user = relationship("AuthUser", back_populates="approval_requests")
    guardian = relationship("GuardianRelationship", back_populates="approval_requests")
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')",
            name='chk_approval_status'
        ),
        CheckConstraint('fraud_score >= 0 AND fraud_score <= 1', name='chk_fraud_score_range'),
        CheckConstraint('amount > 0', name='chk_amount_positive'),
    )
    
    @property
    def is_expired(self) -> bool:
        """Check if approval request has expired."""
        return datetime.utcnow() > self.expires_at
    
    @property
    def is_pending(self) -> bool:
        """Check if approval request is still pending."""
        return self.status == 'PENDING' and not self.is_expired
    
    def approve(self, note: Optional[str] = None):
        """Approve the transaction."""
        self.status = 'APPROVED'
        self.responded_at = datetime.utcnow()
        if note:
            self.response_note = note
    
    def reject(self, note: Optional[str] = None):
        """Reject the transaction."""
        self.status = 'REJECTED'
        self.responded_at = datetime.utcnow()
        if note:
            self.response_note = note
    
    def expire(self):
        """Mark as expired."""
        if self.status == 'PENDING':
            self.status = 'EXPIRED'
            self.responded_at = datetime.utcnow()
    
    def __repr__(self):
        return f"<GuardianApprovalRequest(id={self.id}, transaction_id={self.transaction_id}, status={self.status})>"
