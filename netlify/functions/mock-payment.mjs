const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Use POST to simulate a mock payment.' });
  }
  if ((process.env.PAYMENT_PROVIDER ?? 'mock') !== 'mock') {
    return jsonResponse(503, { error: 'Mock payment simulation is disabled for this deployment.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(503, { error: 'Configure the server-side Supabase URL, anon key, and service-role key.' });
  }

  const authorization = event.headers.authorization ?? event.headers.Authorization;
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return jsonResponse(401, { error: 'Sign in before simulating a payment.' });

  let userResponse;
  try {
    userResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` },
    });
  } catch (requestError) {
    console.error('Mock payment auth lookup failed:', requestError);
    return jsonResponse(502, { error: 'Unable to verify the signed-in user with Supabase.' });
  }
  if (!userResponse.ok) return jsonResponse(401, { error: 'Your session is invalid or has expired.' });

  let user;
  try {
    user = await userResponse.json();
  } catch {
    return jsonResponse(502, { error: 'Supabase returned an invalid user response.' });
  }
  if (typeof user.id !== 'string') return jsonResponse(401, { error: 'Supabase did not return a valid user ID.' });

  let input;
  try {
    input = JSON.parse(event.body ?? '');
  } catch {
    return jsonResponse(400, { error: 'Send a valid JSON payment request.' });
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return jsonResponse(400, { error: 'Send a payment request object.' });
  }
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(input.orderId ?? '') || !uuidPattern.test(input.idempotencyKey ?? '')) {
    return jsonResponse(400, { error: 'A valid order ID and idempotency key are required.' });
  }
  if (input.outcome !== 'paid' && input.outcome !== 'failed') {
    return jsonResponse(400, { error: 'Choose either a successful or failed mock payment.' });
  }

  let paymentResponse;
  try {
    paymentResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/complete_mock_payment`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        target_order_id: input.orderId,
        target_retailer_id: user.id,
        payment_succeeded: input.outcome === 'paid',
        idempotency_key: input.idempotencyKey,
      }),
    });
  } catch (requestError) {
    console.error('Mock payment completion request failed:', requestError);
    return jsonResponse(502, { error: 'Unable to record the mock payment with Supabase.' });
  }

  let paymentResult;
  try {
    paymentResult = await paymentResponse.json();
  } catch {
    return jsonResponse(502, { error: 'Supabase returned an invalid payment response.' });
  }
  if (!paymentResponse.ok) {
    return jsonResponse(400, {
      error: typeof paymentResult.message === 'string' ? paymentResult.message : 'Supabase could not complete this mock payment.',
    });
  }

  return jsonResponse(200, { orderStatus: paymentResult });
}
