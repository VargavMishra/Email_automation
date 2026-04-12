import {
  createRazorpaySignature,
  verifyRazorpaySignature
} from '../src/modules/payments/providers/razorpay.provider.js';

describe('razorpay provider', () => {
  it('verifies valid checkout signatures', () => {
    const payload = {
      orderId: 'order_123',
      paymentId: 'pay_456',
      secret: 'test_secret'
    };

    const signature = createRazorpaySignature(payload);

    expect(verifyRazorpaySignature({ ...payload, signature })).toBe(true);
  });

  it('rejects invalid checkout signatures', () => {
    expect(verifyRazorpaySignature({
      orderId: 'order_123',
      paymentId: 'pay_456',
      signature: 'bad_signature',
      secret: 'test_secret'
    })).toBe(false);
  });
});
