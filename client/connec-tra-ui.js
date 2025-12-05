// ConnecTra UI Controller
let token = null;
let controlEnabled = false;

// Login
async function connecTraLogin() {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      email: document.getElementById('emailInput').value,
      password: document.getElementById('passwordInput').value
    })
  });
  const data = await res.json();
  if (data.token) {
    token = data.token;
    localStorage.setItem('connecTraToken', token);
    document.getElementById('loginPanel').style.display = 'none';
    document.getElementById('mainPanel').style.display = 'block';
  } else alert(data.error);
}

// Session Management
async function createConnecTraSession() {
  const res = await fetch('/api/sessions/create', {
    method: 'POST',
    headers: {'Authorization': `Bearer ${token}`}
  });
  const {sessionId} = await res.json();
  document.getElementById('sessionIdInput').value = sessionId;
  connecTraRTC = new ConnecTraWebRTC(sessionId);
}

async function joinConnecTraSession() {
  const sessionId = document.getElementById('sessionIdInput').value;
  connecTraRTC = new ConnecTraWebRTC(sessionId);
}

// Controls
function toggleConnecTraControl() {
  controlEnabled = !controlEnabled;
  document.getElementById('controlStatus').textContent = controlEnabled ? 'Control ON' : 'Enable Control';
}

// Event Listeners
document.addEventListener('mousemove', e => {
  if (connecTraRTC && controlEnabled) connecTraRTC.sendControl(e);
});
