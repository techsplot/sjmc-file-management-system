const API_BASE_URL = process.env.SMOKE_API_BASE_URL ?? 'http://localhost:3001';
const FRONTEND_URL = process.env.SMOKE_FRONTEND_URL ?? 'http://localhost:5173';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL ?? 'admin@sjmc.com';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD ?? 'password123';

const runCheck = async (label, fn) => {
  try {
    await fn();
    console.log(`✅ ${label}`);
  } catch (error) {
    console.error(`❌ ${label}`);
    const message = error instanceof Error ? error.message : String(error);
    console.error(`   ${message}`);
    process.exitCode = 1;
  }
};

const assertStatus = (response, expectedStatus, context) => {
  if (response.status !== expectedStatus) {
    throw new Error(`${context} returned ${response.status} (expected ${expectedStatus})`);
  }
};

const asJson = async (response, context) => {
  try {
    return await response.json();
  } catch {
    throw new Error(`${context} did not return valid JSON`);
  }
};

const main = async () => {
  let token = '';

  await runCheck('API health endpoint', async () => {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    assertStatus(response, 200, '/api/health');
    const body = await asJson(response, '/api/health');
    if (body.dbConnected !== true) {
      throw new Error('/api/health reported dbConnected=false');
    }
  });

  await runCheck('Login endpoint', async () => {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });

    assertStatus(response, 200, '/api/login');
    const body = await asJson(response, '/api/login');

    if (!body?.token) {
      throw new Error('/api/login did not return a token');
    }

    token = body.token;
  });

  await runCheck('Verify-token endpoint', async () => {
    if (!token) {
      throw new Error('No token available from login step');
    }

    const response = await fetch(`${API_BASE_URL}/api/verify-token`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    assertStatus(response, 200, '/api/verify-token');
  });

  await runCheck('Personal files endpoint', async () => {
    const response = await fetch(`${API_BASE_URL}/api/personal`);
    assertStatus(response, 200, '/api/personal');
    const body = await asJson(response, '/api/personal');
    if (!Array.isArray(body)) {
      throw new Error('/api/personal did not return an array');
    }
  });

  await runCheck('Frontend endpoint', async () => {
    const response = await fetch(`${FRONTEND_URL}/`);
    assertStatus(response, 200, `${FRONTEND_URL}/`);
  });

  if (process.exitCode && process.exitCode !== 0) {
    console.error('\nSmoke test failed. Ensure `npm run dev` is running and backend/.env is valid.');
    process.exit(process.exitCode);
  }

  console.log('\nSmoke test passed.');
};

await main();
