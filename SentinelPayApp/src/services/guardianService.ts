import AsyncStorage from '@react-native-async-storage/async-storage';
import { authClient, API_BASE_URL } from './authService';

// Map 10.0.2.2 for emulator WebSocket connection
const WS_BASE_URL = API_BASE_URL.replace('http://', 'ws://');

export interface GuardianRelationship {
  id: string;
  guardian_phone: string;
  guardian_vpa: string;
  status: 'PENDING' | 'ACTIVE' | 'REMOVED';
  invited_at: string | null;
  accepted_at: string | null;
  guardian_name: string | null;
}

export interface WardRelationship {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'REMOVED';
  invited_at: string | null;
  accepted_at: string | null;
  ward_name: string | null;
  ward_phone: string;
  ward_vpa: string;
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
    const resp = await authClient.get('/guardian/list');
    return resp.data;
  }

  async addGuardian(phone?: string, vpa?: string): Promise<{ relationship_id: string; status: string }> {
    const resp = await authClient.post('/guardian/add', { phone, vpa });
    return resp.data;
  }

  async acceptInvitation(relationshipId: string): Promise<{ success: boolean; status: string }> {
    const resp = await authClient.post(`/guardian/accept-invitation?relationship_id=${relationshipId}`);
    return resp.data;
  }

  async removeGuardian(relationshipId: string): Promise<{ success: boolean; status: string }> {
    const resp = await authClient.post(`/guardian/remove?relationship_id=${relationshipId}`);
    return resp.data;
  }

  async requestApproval(data: {
    transaction_id: string;
    amount: number;
    recipient_vpa: string;
    fraud_score: number;
    risk_signals: string[];
  }): Promise<{ success: boolean; requests: string[]; expires_at: string }> {
    const resp = await authClient.post('/guardian/request-approval', data);
    return resp.data;
  }

  async respondToRequest(
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    note?: string
  ): Promise<{ success: boolean; status: string }> {
    const resp = await authClient.post('/guardian/respond', {
      request_id: requestId,
      decision,
      note,
    });
    return resp.data;
  }

  async getPendingRequests(): Promise<{ incoming: PendingRequest[]; outgoing: PendingRequest[] }> {
    const resp = await authClient.get('/guardian/pending-requests');
    return resp.data;
  }

  async getRequestStatus(transactionId: string): Promise<{ status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'NONE'; guardian_name?: string; note?: string }> {
    const resp = await authClient.get(`/guardian/request-status/${transactionId}`);
    return resp.data;
  }
}

export const guardianService = new GuardianService();
export default guardianService;
