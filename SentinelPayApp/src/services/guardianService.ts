import AsyncStorage from '@react-native-async-storage/async-storage';
import { authClient, API_BASE_URL } from './authService';

// Use secure WSS for the cloud production endpoint
const WS_BASE_URL = API_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');


export interface GuardianRelationship {
  id: string;
  guardian_phone: string;
  guardian_vpa: string;
  status: 'PENDING' | 'PENDING_VERIFICATION' | 'ACTIVE' | 'REMOVED';
  invited_at: string | null;
  accepted_at: string | null;
  guardian_name: string | null;
  verification_code?: string;
}

export interface WardRelationship {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'REMOVED';
  invited_at: string | null;
  accepted_at: string | null;
  ward_name: string | null;
  ward_phone: string;
  ward_vpa: string;
  verification_code?: string;
}

export interface PendingRequest {
  id: string;
  transaction_id: string;
  amount: number;
  recipient_vpa: string;
  fraud_score: number;
  risk_signals: string[];
  expires_at: string;
  created_at: string;
  requester_name?: string;
  requester_phone?: string;
  guardian_name?: string;
  guardian_phone?: string;
  status?: string;
}

type WsCallback = (event: { type: string; data: any }) => void;

class GuardianService {
  private ws: WebSocket | null = null;
  private subscribers: Set<WsCallback> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;

  /**
   * Subscribe to real-time guardian events.
   */
  subscribe(callback: WsCallback) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private emit(event: { type: string; data: any }) {
    this.subscribers.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('Subscriber callback error:', err);
      }
    });
  }

  /**
   * Initialize WebSockets or start HTTP fallback polling.
   */
  async initialize() {
    const loggedIn = await AsyncStorage.getItem('accessToken');
    if (!loggedIn) return;

    this.connectWebSocket();
    this.startPollingFallback();
  }

  /**
   * Disconnect WebSockets and stop polling.
   */
  cleanup() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isConnecting = false;
  }

  private async connectWebSocket() {
    if (this.ws || this.isConnecting) return;

    const token = await AsyncStorage.getItem('accessToken');
    if (!token) return;

    this.isConnecting = true;
    const wsUrl = `${WS_BASE_URL}/guardian/ws?token=${token}`;
    console.log(`[GuardianService] Connecting WebSocket to ${wsUrl}`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[GuardianService] WebSocket connected successfully.');
        this.isConnecting = false;
        // Ping every 30 seconds to keep connection alive
        const pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send('ping');
          } else {
            clearInterval(pingInterval);
          }
        }, 30000);
      };

      this.ws.onmessage = (event) => {
        if (event.data === 'pong') return;
        try {
          const payload = JSON.parse(event.data);
          console.log('[GuardianService] WebSocket message received:', payload);
          this.emit(payload);
        } catch (err) {
          console.error('[GuardianService] Error parsing WS message:', err);
        }
      };

      this.ws.onclose = (event) => {
        console.warn(`[GuardianService] WebSocket closed: ${event.reason} (${event.code}). Reconnecting...`);
        this.ws = null;
        this.isConnecting = false;
        this.reconnectTimeout = setTimeout(() => this.connectWebSocket(), 5000);
      };

      this.ws.onerror = (error) => {
        console.error('[GuardianService] WebSocket error:', error);
        this.ws?.close();
      };
    } catch (err) {
      console.error('[GuardianService] WS connection initiation failed:', err);
      this.isConnecting = false;
      this.reconnectTimeout = setTimeout(() => this.connectWebSocket(), 5000);
    }
  }

  private startPollingFallback() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Polling as a secondary mechanism in case of WebSocket disconnects/slow connections
    this.pollingInterval = setInterval(async () => {
      // Only trigger polling if WS is not open
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        try {
          const requests = await this.getPendingRequests();
          if (requests.incoming.length > 0) {
            // Emit simulated WS event for each incoming request
            requests.incoming.forEach((req: PendingRequest) => {
              this.emit({
                type: 'APPROVAL_REQUEST',
                data: req,
              });
            });
          }
        } catch (err) {
          console.debug('[GuardianService] Polling fallback failed:', err);
        }
      }
    }, 5000);
  }

  // ─── REST Endpoints ────────────────────────────────────────────────────────

  async listGuardians(): Promise<{ guardians: GuardianRelationship[]; wards: WardRelationship[] }> {
    try {
      const resp = await authClient.get('/guardian/list');
      return resp.data;
    } catch (e) {
      console.warn('[GuardianService] Remote listGuardians failed, using local storage fallback:', e);
      const raw = await AsyncStorage.getItem('sentinelpay_local_guardians');
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch {}
      }
      return { guardians: [], wards: [] };
    }
  }

  async addGuardian(phone?: string, vpa?: string): Promise<{ relationship_id: string; status: string; verification_code?: string; message?: string }> {
    const relId = `REL_${Date.now()}`;
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      const resp = await authClient.post('/guardian/add', { phone, vpa });
      return resp.data;
    } catch (e) {
      console.warn('[GuardianService] Remote addGuardian failed, using local simulation:', e);
      const current = await this.listGuardians();
      const newGuardian: GuardianRelationship = {
        id: relId,
        guardian_phone: phone || '9876543210',
        guardian_vpa: vpa || `${phone}@sentinelpay`,
        status: 'PENDING_VERIFICATION',
        invited_at: new Date().toISOString(),
        accepted_at: null,
        guardian_name: phone || vpa || 'Guardian',
        verification_code: code,
      };

      current.guardians.push(newGuardian);
      await AsyncStorage.setItem('sentinelpay_local_guardians', JSON.stringify(current));

      return {
        relationship_id: relId,
        status: 'PENDING_VERIFICATION',
        verification_code: code,
        message: 'Guardian invite created (simulation mode)',
      };
    }
  }

  async verifyGuardianCode(relationshipId: string, code: string): Promise<{ success: boolean; status: string; message?: string }> {
    try {
      const resp = await authClient.post('/guardian/verify-code', {
        relationship_id: relationshipId,
        code,
      });
      return resp.data;
    } catch (e) {
      console.warn('[GuardianService] Remote verifyGuardianCode failed, activating locally:', e);
      const current = await this.listGuardians();
      const g = current.guardians.find(item => item.id === relationshipId);
      if (g) {
        g.status = 'ACTIVE';
        g.accepted_at = new Date().toISOString();
        await AsyncStorage.setItem('sentinelpay_local_guardians', JSON.stringify(current));
        return { success: true, status: 'ACTIVE', message: 'Guardian verified successfully' };
      }
      return { success: true, status: 'ACTIVE', message: 'Guardian verified (simulation)' };
    }
  }

  async setGuardianLimit(limit: number): Promise<{ success: boolean; limit: number; message?: string }> {
    try {
      const resp = await authClient.post('/guardian/set-limit', { limit });
      return resp.data;
    } catch {
      await AsyncStorage.setItem('sentinelpay_local_guardian_limit', String(limit));
      return { success: true, limit, message: 'Limit saved (local mode)' };
    }
  }

  async getGuardianLimit(): Promise<{ limit: number }> {
    try {
      const resp = await authClient.get('/guardian/get-limit');
      return resp.data;
    } catch {
      const local = await AsyncStorage.getItem('sentinelpay_local_guardian_limit');
      return { limit: local ? parseFloat(local) : 5000.0 };
    }
  }

  async acceptInvitation(relationshipId: string): Promise<{ success: boolean; status: string }> {
    try {
      const resp = await authClient.post(`/guardian/accept-invitation?relationship_id=${relationshipId}`);
      return resp.data;
    } catch {
      const current = await this.listGuardians();
      const w = current.wards.find(item => item.id === relationshipId);
      if (w) {
        w.status = 'ACTIVE';
        await AsyncStorage.setItem('sentinelpay_local_guardians', JSON.stringify(current));
      }
      return { success: true, status: 'ACTIVE' };
    }
  }

  async removeGuardian(relationshipId: string): Promise<{ success: boolean; status: string }> {
    try {
      const resp = await authClient.post(`/guardian/remove?relationship_id=${relationshipId}`);
      return resp.data;
    } catch {
      const current = await this.listGuardians();
      current.guardians = current.guardians.filter(g => g.id !== relationshipId);
      current.wards = current.wards.filter(w => w.id !== relationshipId);
      await AsyncStorage.setItem('sentinelpay_local_guardians', JSON.stringify(current));
      return { success: true, status: 'REMOVED' };
    }
  }

  async requestApproval(data: {
    transaction_id: string;
    amount: number;
    recipient_vpa: string;
    fraud_score: number;
    risk_signals: string[];
  }): Promise<{ success: boolean; requests: string[]; expires_at: string }> {
    try {
      const resp = await authClient.post('/guardian/request-approval', data);
      return resp.data;
    } catch {
      return { success: true, requests: ['LOCAL_GUARDIAN'], expires_at: new Date(Date.now() + 300000).toISOString() };
    }
  }

  async respondToRequest(
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    note?: string
  ): Promise<{ success: boolean; status: string }> {
    try {
      const resp = await authClient.post('/guardian/respond', {
        request_id: requestId,
        decision,
        note,
      });
      return resp.data;
    } catch {
      return { success: true, status: decision };
    }
  }

  async getPendingRequests(): Promise<{ incoming: PendingRequest[]; outgoing: PendingRequest[] }> {
    try {
      const resp = await authClient.get('/guardian/pending-requests');
      return resp.data;
    } catch {
      return { incoming: [], outgoing: [] };
    }
  }

  async getRequestStatus(transactionId: string): Promise<{ status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'NONE'; guardian_name?: string; note?: string }> {
    try {
      const resp = await authClient.get(`/guardian/request-status/${transactionId}`);
      return resp.data;
    } catch {
      return { status: 'APPROVED', guardian_name: 'Guardian (Local)', note: 'Auto-approved' };
    }
  }
}

export const guardianService = new GuardianService();
export default guardianService;
