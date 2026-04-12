import { createOpaqueToken } from '../../../utils/security.js';

export function createMockOrder({ amount, currency }) {
  const id = `mock_order_${createOpaqueToken(8)}`;

  return {
    id,
    amount,
    currency,
    status: 'created',
    provider: 'mock'
  };
}

export function createMockPayment() {
  return {
    id: `mock_payment_${createOpaqueToken(8)}`,
    signature: `mock_signature_${createOpaqueToken(8)}`
  };
}
