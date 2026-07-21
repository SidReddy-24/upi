"""Test script for OTP API endpoints."""
import asyncio
from sqlalchemy import select, and_
from app.db.database import async_session_factory
from app.models.auth import OtpVerification

async def test_otp_query():
    """Test querying OTP records."""
    async with async_session_factory() as session:
        try:
            # Test query
            stmt = select(OtpVerification).where(
                and_(
                    OtpVerification.phone == "5555555555",
                    OtpVerification.purpose == "REGISTRATION",
                    OtpVerification.verified == False
                )
            ).order_by(OtpVerification.created_at.desc())
            
            result = await session.execute(stmt)
            otp_record = result.scalars().first()
            
            if otp_record:
                print(f"✓ Found OTP record:")
                print(f"  Phone: {otp_record.phone}")
                print(f"  Code: {otp_record.otp_code}")
                print(f"  Purpose: {otp_record.purpose}")
                print(f"  Verified: {otp_record.verified}")
                print(f"  Expires: {otp_record.expires_at}")
            else:
                print("✗ No OTP record found")
                
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_otp_query())
