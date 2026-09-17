import axios from 'axios';

async function testLogin() {
  const url = 'http://localhost:5000/api/v1/auth/login';
  console.log('Testing login endpoint at:', url);

  try {
    const res = await axios.post(url, {
      email: 'superadmin@demo.com',
      password: 'Password123',
    });
    console.log('✅ Login Response 200 OK:', res.data);
  } catch (err: any) {
    console.error('❌ Login error:', err.response?.data || err.message);
  }

  try {
    const resDot = await axios.post(url, {
      email: 'superadmin@demo.com',
      password: 'Password123.',
    });
    console.log('✅ Login with trailing dot Response 200 OK:', resDot.data);
  } catch (err: any) {
    console.error('❌ Login dot error:', err.response?.data || err.message);
  }
}

testLogin();
