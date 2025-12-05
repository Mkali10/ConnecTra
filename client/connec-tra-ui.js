// Full UI logic with ConnecTra API calls
async function connecTraLogin() {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: document.getElementById('emailInput').value,
      password: document.getElementById('passwordInput').value
    })
  });
  // ... Handle response
}
