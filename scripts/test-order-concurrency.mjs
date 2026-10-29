import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const envFile = fileURLToPath(new URL('../.env.local', import.meta.url));
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] in process.env) continue;
    const value = match[2].replace(/^(["'])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
}

const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ORDER_TEST_PRODUCT_ID',
  'ORDER_TEST_RETAILER_ONE_EMAIL',
  'ORDER_TEST_RETAILER_ONE_PASSWORD',
  'ORDER_TEST_RETAILER_TWO_EMAIL',
  'ORDER_TEST_RETAILER_TWO_PASSWORD',
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  throw new Error(`Set these .env.local values before running the concurrency test: ${missing.join(', ')}`);
}

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const productId = process.env.ORDER_TEST_PRODUCT_ID;
const serviceClient = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function signedInClient(emailName, passwordName) {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email: process.env[emailName],
    password: process.env[passwordName],
  });
  if (error) throw new Error(`Could not sign in ${emailName}: ${error.message}`);
  return client;
}

const [retailerOne, retailerTwo] = await Promise.all([
  signedInClient('ORDER_TEST_RETAILER_ONE_EMAIL', 'ORDER_TEST_RETAILER_ONE_PASSWORD'),
  signedInClient('ORDER_TEST_RETAILER_TWO_EMAIL', 'ORDER_TEST_RETAILER_TWO_PASSWORD'),
]);

const { data: product, error: productError } = await retailerOne
  .from('products')
  .select('stock, min_order, is_active')
  .eq('id', productId)
  .single();
if (productError) throw productError;
assert.equal(product.is_active, true, 'The fixture product must be active.');
assert.equal(Number(product.stock), 1, 'The fixture product must have exactly one unit in stock.');
assert.ok(Number(product.min_order) <= 1, 'The fixture product minimum order must be at most one unit.');

const checkout = (client) => client.rpc('place_order', {
  cart_lines: [{ product_id: productId, quantity: 1 }],
  payment_method_input: 'cod',
  fulfilment_method_input: 'self_pickup',
  transport_slot_id_input: null,
});

let successfulOrderIds = [];
try {
  const outcomes = await Promise.all([checkout(retailerOne), checkout(retailerTwo)]);
  successfulOrderIds = outcomes.flatMap(({ data, error }) => !error && data ? [data] : []);
  const failures = outcomes.filter(({ error }) => error);

  assert.equal(successfulOrderIds.length, 1, 'Exactly one concurrent checkout must succeed.');
  assert.equal(failures.length, 1, 'Exactly one concurrent checkout must be rejected.');
  assert.match(failures[0].error.message, /unavailable|stock|minimum order/i);
  console.log('PASS: only one of two concurrent checkouts purchased the last unit.');
} finally {
  if (successfulOrderIds.length) {
    const { error: restoreError } = await serviceClient
      .from('products')
      .update({ stock: 1 })
      .eq('id', productId);
    if (restoreError) throw new Error(`Order test passed but could not restore fixture stock: ${restoreError.message}`);
    const { error: cleanupError } = await serviceClient
      .from('orders')
      .delete()
      .in('id', successfulOrderIds);
    if (cleanupError) throw new Error(`Order test passed but could not remove its test order: ${cleanupError.message}`);
  }
}
