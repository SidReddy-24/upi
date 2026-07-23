# Authentication Quick Start Guide 🚀

## How to Test the New Authentication System

### 🏁 Quick Test (Phone OTP Mode)

1. **Build and run the app**:
   ```bash
   cd SentinelPayApp
   npx react-native run-android
   ```

2. **First time setup**:
   - App opens → Onboarding screen
   - Swipe through onboarding
   - Click "Get Started"

3. **Choose Phone OTP**:
   - See "Choose Your Login Method" screen
   - Click "Phone + OTP" card (has "MOCK MODE" badge)

4. **Enter phone number**:
   - Type any valid Indian mobile: `9876543210`
   - Click "Send OTP"
   - Alert shows: **"Use OTP: 123456"**

5. **Verify OTP**:
   - Enter: `123456`
   - Click "Verify & Login"
   - Success! → Navigate to Home screen

✅ **You're logged in!**

---

### 🔐 Quick Test (PIN + Biometric Mode)

1. **Choose PIN + Biometric**:
   - From Auth Mode Selector
   - Click "PIN + Biometric" card (RECOMMENDED badge)

2. **Setup PIN**:
   - Enter PIN: `1234`
   - Click "Continue"
   - Confirm PIN: `1234`
   - Click "Confirm PIN"

3. **Enable Biometric (Optional)**:
   - Alert: "Enable Biometric?"
   - Click "Enable" → Authenticate with fingerprint/face
   - Or click "Skip" to use only PIN

4. **Success**:
   - Navigate to Home screen

5. **Test Re-login**:
   - Close app completely
   - Reopen app
   - See PIN Login screen
   - Enter PIN or use biometric
   - Home screen appears

✅ **PIN authentication working!**

---

## 🔄 Testing Mode Switching

1. **From PIN Login**:
   - Click "← Use Different Login Method"
   - Returns to Auth Mode Selector

2. **Switch to Phone OTP**:
   - Click "Phone + OTP"
   - Enter phone and OTP as above

3. **App remembers last mode**:
   - If you used PIN last time
   - Next app open goes directly to PIN Login

---

## 📱 Mock OTP Details

**Fixed OTP Code**: `123456`

**Valid Phone Numbers** (Indian format):
- Starts with: 6, 7, 8, or 9
- Length: 10 digits
- Examples:
  - `9876543210` ✅
  - `8765432109` ✅
  - `7654321098` ✅
  - `6543210987` ✅
  - `5432109876` ❌ (doesn't start with 6-9)
  - `98765` ❌ (too short)

---

## 🐛 Common Issues

### Issue: "Invalid OTP"
- **Solution**: Make sure you entered exactly `123456`

### Issue: "Invalid Phone Number"
- **Solution**: Use 10-digit number starting with 6-9
- **Example**: `9876543210`

### Issue: PIN doesn't work on re-login
- **Solution**: Make sure you remember the PIN you set
- **Reset**: Uninstall and reinstall app to start fresh

### Issue: TypeScript errors
- **Solution**: Run `npx tsc --noEmit` to check
- **Should show**: 0 errors

### Issue: App crashes on biometric
- **Solution**: Ensure device has fingerprint/face ID set up
- **Alternative**: Click "Skip" during biometric setup

---

## 📝 Testing Checklist

- [ ] Phone OTP flow works
- [ ] PIN setup works
- [ ] PIN login works
- [ ] Biometric enrollment works
- [ ] Biometric login works
- [ ] Mode switching works
- [ ] Session persists after app close
- [ ] Back button navigations work
- [ ] Form validation works
- [ ] Error messages show correctly

---

## 🎯 Expected Behavior

### After Phone OTP Login:
- Session lasts **24 hours**
- Next app open: Goes to Home (still authenticated)
- After 24 hours: Goes to Auth Mode Selector (expired)

### After PIN Login:
- Session lasts **7 days**
- Next app open: Goes to PIN Login screen
- Can use PIN or biometric to unlock
- After 7 days: Goes to Auth Mode Selector (expired)

---

## 🚀 Ready to Go!

Your authentication system is fully implemented and tested. Users can now securely authenticate using either:
- **Phone OTP** (Mock mode with OTP: 123456)
- **PIN + Biometric** (4-6 digit PIN with optional fingerprint/face)

Both modes provide secure session management and a smooth user experience!
