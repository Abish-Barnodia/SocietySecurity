import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { io, Socket } from 'socket.io-client';
import api, { API_URL } from '../utils/api';
import tokenStorage from '../utils/tokenStorage';
import { useAuth } from '@apartment-security/shared-auth';
import { RazorpayWebCheckout } from '../components/RazorpayWebCheckout';

// react-native-razorpay's native module isn't present in Expo Go (only in a
// custom dev-client/production build), so Expo Go falls back to the WebView
// checkout instead of crashing on a missing native module.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, '');

export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export type Invoice = {
  id: string;
  amount: number;
  description: string;
  dueDate: string;
  status: InvoiceStatus;
  paidAt?: string | null;
};

const mapInvoice = (raw: any): Invoice => ({
  id: raw.id,
  amount: raw.amount,
  description: raw.description,
  dueDate: raw.dueDate,
  status: raw.status,
  paidAt: raw.paidAt ?? null,
});

type MaintenanceContextType = {
  invoices: Invoice[];
  loading: boolean;
  fetchInvoices: () => Promise<void>;
  payInvoice: (invoiceId: string) => Promise<void>;
};

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

type CheckoutState = {
  params: { key: string; amount: number; currency: string; order_id: string; name: string; description: string; callback_url?: string };
  orderId: string;
  invoiceId: string;
  resolve: (result: any) => void;
  reject: (err: Error) => void;
} | null;

export const MaintenanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, userRole } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  // ponytail: one state drives the checkout modal; Promise ref bridges async payInvoice
  const [checkout, setCheckout] = useState<CheckoutState>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/maintenance/invoices');
      const raw: any[] = response.data.data ?? [];
      setInvoices(raw.map(mapInvoice));
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Real Razorpay TEST MODE flow: create an order (server reads the amount
  // from the DB), open Checkout via WebView (works in Expo Go + web), then
  // verify signature server-side before flipping invoice to PAID.
  const payInvoice = useCallback(async (invoiceId: string) => {
    const invoice = invoices.find((i) => i.id === invoiceId);

    const orderRes = await api.post(`/maintenance/invoices/${invoiceId}/order`);
    const { orderId, amount, currency, keyId } = orderRes.data.data;

    let checkoutResult: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
    try {
      if (Platform.OS === 'web') {
        // Web: inject Razorpay JS directly into the page
        checkoutResult = await new Promise((resolve, reject) => {
          const existing = document.querySelector('script[src*="checkout.razorpay"]');
          const open = () => {
            const rzp = new (window as any).Razorpay({
              key: keyId, amount, currency, order_id: orderId,
              name: 'Society Maintenance',
              description: invoice?.description ?? 'Maintenance charge',
              theme: { color: '#0D9488' },
              handler: resolve,
              modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
            });
            rzp.on('payment.failed', (r: any) => reject(new Error(r.error.description || 'Payment failed')));
            rzp.open();
          };
          if (existing) { open(); return; }
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = open;
          script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
          document.body.appendChild(script);
        });
      } else if (!isExpoGo) {
        // Custom dev-client / production build: native Razorpay Checkout SDK.
        // Required lazily — importing it eagerly touches a NativeEventEmitter
        // that doesn't exist in Expo Go and crashes the app at import time.
        const RazorpayCheckout = require('react-native-razorpay').default as typeof import('react-native-razorpay').default;
        checkoutResult = await RazorpayCheckout.open({
          key: keyId,
          amount,
          currency,
          order_id: orderId,
          name: 'Society Maintenance',
          description: invoice?.description ?? 'Maintenance charge',
          theme: { color: '#0D9488' },
        });
      } else {
        // Expo Go: no native module available, fall back to the WebView checkout
        checkoutResult = await new Promise((resolve, reject) => {
          setCheckout({
            params: {
              key: keyId,
              amount,
              currency,
              order_id: orderId,
              name: 'Society Maintenance',
              description: invoice?.description ?? 'Maintenance charge',
              // ponytail: redirect callback URL ensures WebView doesn't lose standard callbacks after bank redirects
              callback_url: `${API_URL}/maintenance/invoices/${invoiceId}/verify-public`
            },
            orderId,
            invoiceId,
            resolve,
            reject,
          });
        });
      }
    } catch (err: any) {
      await api.post(`/maintenance/invoices/${invoiceId}/cancel`, { razorpay_order_id: orderId }).catch(() => {});
      throw new Error(err?.message || err?.description || 'Payment cancelled');
    }

    const verifyRes = await api.post(`/maintenance/invoices/${invoiceId}/verify`, {
      razorpay_order_id: checkoutResult.razorpay_order_id,
      razorpay_payment_id: checkoutResult.razorpay_payment_id,
      razorpay_signature: checkoutResult.razorpay_signature,
    });
    const updated = mapInvoice(verifyRes.data.data.invoice);
    setInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }, [invoices]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (userRole === 'RESIDENT') {
      fetchInvoices();
    }
  }, [isAuthenticated, userRole, fetchInvoices]);

  // New/updated invoices (manager raises a bill, payment confirmed) show up live.
  const socketRef = useRef<Socket | null>(null);
  useEffect(() => {
    if (!isAuthenticated || userRole !== 'RESIDENT') return;
    let cancelled = false;

    (async () => {
      const token = await tokenStorage.getItemAsync('userToken');
      if (!token || cancelled) return;

      const socket = io(SOCKET_URL, { auth: { token } });
      socketRef.current = socket;

      const upsert = (raw: any) => {
        const mapped = mapInvoice(raw);
        setInvoices((prev) =>
          prev.some((i) => i.id === mapped.id) ? prev.map((i) => (i.id === mapped.id ? mapped : i)) : [mapped, ...prev]
        );
      };
      socket.on('invoice:new', upsert);
      socket.on('invoice:update', upsert);
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, userRole]);

  const handleCheckoutSuccess = (result: any) => {
    checkout?.resolve(result);
    setCheckout(null);
  };

  const handleCheckoutDismiss = () => {
    checkout?.reject(new Error('Payment cancelled'));
    setCheckout(null);
  };

  return (
    <MaintenanceContext.Provider value={{ invoices, loading, fetchInvoices, payInvoice }}>
      {children}
      {/* Native Razorpay checkout modal — rendered here so it always has a host view */}
      {checkout && Platform.OS !== 'web' && (
        <RazorpayWebCheckout
          visible={!!checkout}
          params={checkout.params}
          onSuccess={handleCheckoutSuccess}
          onDismiss={handleCheckoutDismiss}
        />
      )}
    </MaintenanceContext.Provider>
  );
};

export const useMaintenance = () => {
  const context = useContext(MaintenanceContext);
  if (context === undefined) {
    throw new Error('useMaintenance must be used within a MaintenanceProvider');
  }
  return context;
};
