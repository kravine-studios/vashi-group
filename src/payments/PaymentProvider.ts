import type { OrderSummary } from '../services/demoOrders';

export type MockPaymentOutcome = 'paid' | 'failed';

function isOrderStatus(value: unknown): value is OrderSummary['status'] {
  return typeof value === 'string'
    && ['pending_payment', 'confirmed', 'expired', 'cancelled', 'completed'].includes(value);
}

export interface PaymentProvider {
  completeMockPayment(input: {
    accessToken: string;
    orderId: string;
    outcome: MockPaymentOutcome;
    idempotencyKey: string;
  }): Promise<OrderSummary['status']>;
}

export const mockPaymentProvider: PaymentProvider = {
  async completeMockPayment(input) {
    const response = await fetch('/.netlify/functions/mock-payment', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        orderId: input.orderId,
        outcome: input.outcome,
        idempotencyKey: input.idempotencyKey,
      }),
    });

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      throw new Error('The mock payment service returned an invalid response.');
    }

    if (!response.ok) {
      const message = responseBody && typeof responseBody === 'object' && 'error' in responseBody
        && typeof responseBody.error === 'string'
        ? responseBody.error
        : 'Unable to record the mock payment.';
      throw new Error(message);
    }

    if (
      !responseBody
      || typeof responseBody !== 'object'
      || !('orderStatus' in responseBody)
      || !isOrderStatus(responseBody.orderStatus)
    ) {
      throw new Error('The mock payment service returned an invalid order status.');
    }

    return responseBody.orderStatus;
  },
};
