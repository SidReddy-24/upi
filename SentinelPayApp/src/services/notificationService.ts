import AsyncStorage from '@react-native-async-storage/async-storage';
import { authClient } from './authService';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: 'PAYMENT_RECEIVED' | 'PAYMENT_SENT' | 'GUARDIAN_APPROVED' | 'GUARDIAN_REJECTED' | 'AI_RISK_BLOCK' | 'QR_VERIFIED' | 'SCAM_DETECTED' | 'DEVICE_TRUST' | 'COMMUNITY_ALERT';
  transaction_id?: string;
  timestamp: string;
  read: boolean;
}

const STORAGE_KEY = 'sentinelpay_notifications_store';

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'NOTIF_001',
    title: '💰 ₹500 Payment Received',
    body: 'Received ₹500.00 from Alice (alice@sentinelpay). Ref: SP250726X91M84',
    type: 'PAYMENT_RECEIVED',
    transaction_id: 'SP250726X91M84',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    read: false,
  },
  {
    id: 'NOTIF_002',
    title: '🛡️ Guardian Approved Payment',
    body: 'Your guardian approved payment of ₹1,200.00 to Merchant. Ref: SP250726A81D72',
    type: 'GUARDIAN_APPROVED',
    transaction_id: 'SP250726A81D72',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    read: false,
  },
  {
    id: 'NOTIF_003',
    title: '🚫 FraudShield AI Alert',
    body: 'High-risk transaction to unknown merchant was blocked safely by AI rule engine.',
    type: 'AI_RISK_BLOCK',
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    read: true,
  },
  {
    id: 'NOTIF_004',
    title: '🔐 Device Security Verified',
    body: 'Device Trust score is 94%. Root, emulator, and overlay checks passed.',
    type: 'DEVICE_TRUST',
    timestamp: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    read: true,
  },
];

type NotificationCallback = (notifications: NotificationItem[]) => void;

class NotificationService {
  private subscribers: Set<NotificationCallback> = new Set();

  configure(): void {}
  requestPermissions(): void {}

  async getNotifications(): Promise<NotificationItem[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_NOTIFICATIONS));
      return DEFAULT_NOTIFICATIONS;
    } catch {
      return DEFAULT_NOTIFICATIONS;
    }
  }

  async syncRemoteNotifications(): Promise<NotificationItem[]> {
    try {
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const userKey = user?.vpa || user?.phone || '';

      if (userKey) {
        const res = await authClient.get(`/notifications/list?user_key=${encodeURIComponent(userKey)}`);
        if (res.data && Array.isArray(res.data.notifications)) {
          const remoteItems: NotificationItem[] = res.data.notifications.map((n: any) => ({
            id: n.id || `NOTIF_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            title: n.title || 'Notification',
            body: n.body || '',
            type: n.type || 'PAYMENT_RECEIVED',
            transaction_id: n.transaction_id,
            timestamp: n.timestamp || new Date().toISOString(),
            read: n.read ?? false,
          }));

          const localItems = await this.getNotifications();
          const map = new Map<string, NotificationItem>();
          [...remoteItems, ...localItems].forEach(item => map.set(item.id, item));
          const merged = Array.from(map.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          this.notifySubscribers(merged);
          return merged;
        }
      }
    } catch (e) {
      console.warn('[NotificationService] Remote sync failed:', e);
    }
    return this.getNotifications();
  }

  async addNotification(item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>): Promise<NotificationItem> {
    const current = await this.getNotifications();
    const newNotif: NotificationItem = {
      ...item,
      id: `NOTIF_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };

    const updated = [newNotif, ...current].slice(0, 50);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    this.notifySubscribers(updated);
    return newNotif;
  }

  async markAllAsRead(): Promise<void> {
    const current = await this.getNotifications();
    const updated = current.map(n => ({ ...n, read: true }));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    this.notifySubscribers(updated);
  }

  async getUnreadCount(): Promise<number> {
    const current = await this.getNotifications();
    return current.filter(n => !n.read).length;
  }

  cancelNotification(id: string | number): void {}
  cancelAllNotifications(): void {}

  async sendTransactionNotification(data: any, secondArg?: any): Promise<void> {
    const amount = data.amount || 0;
    const vpa = data.counterpartyVpa || 'merchant';
    const status = data.status || 'APPROVED';
    await this.addNotification({
      title: status === 'REJECT' ? '🚫 Payment Blocked' : `💸 ₹${amount} Payment ${status}`,
      body: `Transaction with ${vpa} (${status}). Ref: ${data.txnId || 'SP001'}`,
      type: status === 'REJECT' ? 'AI_RISK_BLOCK' : 'PAYMENT_SENT',
      transaction_id: data.txnId,
    });
  }

  async showGuardianCodeAlert(inviterName: string, code: string): Promise<void> {
    await this.addNotification({
      title: '🔑 Guardian Code Received',
      body: `${inviterName} shared guardian verification code: ${code}`,
      type: 'GUARDIAN_APPROVED',
    });
  }

  async showSmsFraudAlert(message: string, sender?: string, risk?: string, confidence?: number): Promise<void> {
    await this.addNotification({
      title: `🚨 Scam SMS Threat (${sender || 'Blocked'})`,
      body: message,
      type: 'SCAM_DETECTED',
    });
  }

  subscribe(callback: NotificationCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(list: NotificationItem[]) {
    this.subscribers.forEach(cb => cb(list));
  }
}

export { NotificationService };
export const notificationService = new NotificationService();
export default NotificationService;
