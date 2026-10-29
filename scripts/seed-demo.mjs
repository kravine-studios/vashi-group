import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const inheritedEnvironment = new Set(Object.keys(process.env));
for (const fileName of ['.env', '.env.local']) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) continue;
  const contents = readFileSync(filePath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith('#') || inheritedEnvironment.has(match[1])) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
}

const required = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  throw new Error(`Missing required environment values: ${missing.join(', ')}. Add them to .env.local.`);
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const adminEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD;
if (adminPassword.length < 12 || adminPassword === 'replace-me') {
  throw new Error('ADMIN_PASSWORD must be a non-placeholder password of at least 12 characters.');
}

const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (usersError) throw usersError;

let adminUser = usersPage.users.find((user) => user.email?.toLowerCase() === adminEmail);
if (!adminUser) {
  const registrationMetadata = {
    role: 'retailer',
    business_name: 'Kirana Operations',
    address: 'Vashi, Navi Mumbai',
    gst_number: '27ABCDE1234F1Z5',
    fssai_number: '12345678901234',
    shop_number: 'Admin Office',
    contact_name: 'Marketplace Administrator',
    contact_phone: '9876543210',
  };
  const { data, error } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: registrationMetadata,
  });
  if (error) throw error;
  adminUser = data.user;
}

const { error: profileError } = await supabase.from('profiles').upsert({
  id: adminUser.id,
  email: adminEmail,
  role: 'super_admin',
  status: 'approved',
  profile_completed: true,
  rejection_reason: null,
  approval_notice_pending: false,
});
if (profileError) throw profileError;

const { error: businessError } = await supabase.from('business_profiles').upsert({
  user_id: adminUser.id,
  business_name: 'Kirana Operations',
  address: 'Vashi, Navi Mumbai',
  gst_number: '27ABCDE1234F1Z5',
  fssai_number: '12345678901234',
  shop_number: 'Admin Office',
  contact_name: 'Marketplace Administrator',
  contact_phone: '9876543210',
  logo_path: null,
});
if (businessError) throw businessError;

console.log(`Super admin account is ready for ${adminEmail}.`);
