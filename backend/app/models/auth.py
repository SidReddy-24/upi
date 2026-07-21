"""SQLAlchemy ORM models for authentication system.

These models support the JWT-based authentication system with OTP verification,
password hashing, and session management.

Requirements: 5.1, 5.19, 5.20
"""
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    CheckConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    """User account model with authentication credentials.
    
    Validates Requirements 5.1, 5.19, 5.20:
    - Phone and email uniqueness
    - Secure password storage
    - VPA linking for wallet integration
    """
    __tablename__ = "users_auth"
    
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
        comment="Unique user identifier"
    )
    phone = Column(
        String(15),
        unique=True,
        nullable=False,
        index=True,
        comment="User phone number (unique)"
    )
    email = Column(
        String(100),
        unique=True,
        nullable=True,
        index=True,
        comment="User email address (optional, unique)"
    )
    password_hash = Column(
        String(255),
        nullable=False,
        comment="bcrypt password hash (≥12 rounds)"
    )
    vpa = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="Virtual Payment Address (UPI identifier)"
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("NOW()"),
        comment="Account creation timestamp"
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("NOW()"),
        onupdate=datetime.utcnow,
        comment="Last profile update timestamp"
    )
    last_login = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Last successful login timestamp"
    )
    
    # Relationships
    otp_verifications = relationship("OtpVerification", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("idx_users_auth_phone", "phone"),
        Index("idx_users_auth_email", "email"),
        Index("idx_users_auth_vpa", "vpa"),
        {"comment": "User authentication accounts with secure credential storage"}
    )
    
    def __repr__(self):
        return f"<User(id={self.id}, phone={self.phone}, vpa={self.vpa})>"


class OtpVerification(Base):
    """OTP verification records for registration, login, and password reset.
    
    Validates Requirements 5.1, 5.19:
    - Time-limited OTP codes (5-minute expiration)
    - Purpose-specific verification
    - Single-use verification tracking
    """
    __tablename__ = "otp_verifications"
    
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
        comment="Unique OTP record identifier"
    )
    phone = Column(
        String(15),
        nullable=False,
        index=True,
        comment="Phone number for OTP delivery"
    )
    otp_code = Column(
        String(6),
        nullable=False,
        comment="6-digit verification code"
    )
    purpose = Column(
        String(20),
        nullable=False,
        comment="OTP purpose: REGISTRATION, PASSWORD_RESET, LOGIN"
    )
    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
        comment="OTP expiration timestamp (5 minutes from creation)"
    )
    verified = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("FALSE"),
        comment="Whether OTP has been successfully verified"
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("NOW()"),
        comment="OTP generation timestamp"
    )
    
    # Foreign key (optional - user may not exist yet during registration)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users_auth.id", ondelete="CASCADE"),
        nullable=True,
        comment="Associated user ID (null for registration OTPs)"
    )
    
    # Relationships
    user = relationship("User", back_populates="otp_verifications")
    
    __table_args__ = (
        CheckConstraint(
            "purpose IN ('REGISTRATION', 'PASSWORD_RESET', 'LOGIN')",
            name="chk_otp_purpose"
        ),
        Index("idx_otp_phone", "phone"),
        Index("idx_otp_phone_purpose", "phone", "purpose"),
        Index("idx_otp_expires_at", "expires_at"),
        {"comment": "OTP verification codes for authentication flows"}
    )
    
    def __repr__(self):
        return f"<OtpVerification(id={self.id}, phone={self.phone}, purpose={self.purpose}, verified={self.verified})>"


class RefreshToken(Base):
    """Refresh token records for session management.
    
    Validates Requirements 5.1:
    - Long-lived refresh tokens (30 days)
    - Token revocation support
    - One-to-many user-token relationship
    """
    __tablename__ = "refresh_tokens"
    
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
        comment="Unique token record identifier"
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users_auth.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="User who owns this refresh token"
    )
    token = Column(
        String(500),
        unique=True,
        nullable=False,
        index=True,
        comment="Refresh token value (JWT or random string)"
    )
    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
        comment="Token expiration timestamp (30 days)"
    )
    revoked = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("FALSE"),
        comment="Whether token has been revoked"
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("NOW()"),
        comment="Token creation timestamp"
    )
    
    # Relationships
    user = relationship("User", back_populates="refresh_tokens")
    
    __table_args__ = (
        Index("idx_refresh_token", "token"),
        Index("idx_refresh_user_id", "user_id"),
        Index("idx_refresh_expires_at", "expires_at"),
        {"comment": "Refresh tokens for session management"}
    )
    
    def __repr__(self):
        return f"<RefreshToken(id={self.id}, user_id={self.user_id}, revoked={self.revoked})>"
