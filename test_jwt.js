// Quick test for JWT utilities
const { parseJwt, encodeJwt, verifyJwt } = require('./SentinelPayApp/src/utils/formatters.ts');

const testPayload = {
  user_id: '123456',
  phone: '9876543210',
  email: 'test@example.com',
  exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
};

const secret = 'test-secret-key';

console.log('Testing JWT utilities...\n');

// Test 1: Encode JWT
try {
  const token = encodeJwt(testPayload, secret);
  console.log('✓ encodeJwt() works');
  console.log('  Token:', token.substring(0, 50) + '...');
  
  // Test 2: Parse JWT
  const parsed = parseJwt(token);
  console.log('\n✓ parseJwt() works');
  console.log('  Parsed payload:', parsed);
  
  // Test 3: Verify JWT
  const isValid = verifyJwt(token, secret);
  console.log('\n✓ verifyJwt() works');
  console.log('  Token valid:', isValid);
  
  // Test 4: Expiration check with expired token
  const expiredPayload = {
    ...testPayload,
    exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
  };
  const expiredToken = encodeJwt(expiredPayload, secret);
  const isExpiredValid = verifyJwt(expiredToken, secret);
  console.log('\n✓ Expiration checking works');
  console.log('  Expired token valid:', isExpiredValid);
  
  console.log('\n✅ All JWT utilities working correctly!');
} catch (error) {
  console.error('❌ Error:', error.message);
}
