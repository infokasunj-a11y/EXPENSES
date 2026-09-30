const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const QRCode = require('qrcode');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'public', 'uploads');
const authDir = path.join(__dirname, 'baileys_auth_info');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

// Copy default avatar SVG if missing
const defaultAvatarPath = path.join(uploadsDir, 'default_avatar.svg');
if (!fs.existsSync(defaultAvatarPath)) {
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="#64748b"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-1.04-4.83-2.61.03-1.6 3.22-2.48 4.83-2.48s4.8 1.88 4.83 2.48C15.8 18.96 14.03 20 12 20z"/></svg>`;
  fs.writeFileSync(defaultAvatarPath, svgContent);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// Multer Upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'upload-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

const crypto = require('crypto');

// JSON File DB Helpers
const OFFICERS_FILE = path.join(dataDir, 'officers.json');
const CUSTOMERS_FILE = path.join(dataDir, 'customers.json');
const HISTORY_FILE = path.join(dataDir, 'history.json');
const USERS_FILE = path.join(dataDir, 'users.json');

const activeTokens = new Map(); // Store active session tokens

function readJSON(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return fallback;
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// Baileys WhatsApp Engine Setup
let sock = null;
let whatsappStatus = 'initializing'; // initializing, qr, authenticated, ready, disconnected
let qrCodeDataURL = null;
let clientInfo = null;

async function connectToWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Office WhatsApp Sender', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('New WhatsApp QR Code generated for Baileys.');
        whatsappStatus = 'qr';
        QRCode.toDataURL(qr, (err, url) => {
          if (!err) qrCodeDataURL = url;
        });
      }

      if (connection === 'open') {
        console.log('===================================================');
        console.log('WhatsApp connection OPEN & READY (Baileys Engine)!');
        console.log('===================================================');
        whatsappStatus = 'ready';
        qrCodeDataURL = null;
        const rawUser = sock.user ? sock.user.id.split(':')[0] : 'Office Number';
        clientInfo = { wid: rawUser };
      } else if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`WhatsApp connection closed. Code: ${statusCode}. Reconnecting: ${shouldReconnect}`);
        whatsappStatus = 'disconnected';
        qrCodeDataURL = null;
        clientInfo = null;

        if (shouldReconnect) {
          setTimeout(connectToWhatsApp, 3000);
        } else {
          console.log('Logged out. Cleaning auth state...');
          try {
            fs.rmSync(authDir, { recursive: true, force: true });
          } catch (e) {}
          setTimeout(connectToWhatsApp, 3000);
        }
      }
    });
  } catch (err) {
    console.error('Failed to connect to Baileys WhatsApp engine:', err);
    setTimeout(connectToWhatsApp, 5000);
  }
}

connectToWhatsApp();

// Helper: Resolve Phone to WhatsApp JID
async function resolveJid(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/\D/g, ''); // Remove non-digits
  
  // Format Sri Lankan numbers (0771234567 -> 94771234567)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '94' + cleaned.substring(1);
  }

  try {
    if (sock && whatsappStatus === 'ready') {
      const results = await sock.onWhatsApp(cleaned);
      if (results && results.length > 0 && results[0].exists) {
        return results[0].jid;
      }
    }
  } catch (err) {
    console.error('onWhatsApp lookup error:', err.message);
  }

  return cleaned.endsWith('@s.whatsapp.net') ? cleaned : `${cleaned}@s.whatsapp.net`;
}

// Auth Middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : req.query.token;
  
  if (!token || !activeTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized. Please log in with a valid Section Head password.' });
  }
  req.user = activeTokens.get(token);
  next();
}

// --- AUTH ENDPOINTS ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE, []);
  
  const cleanUser = (username || '').toLowerCase().trim();
  const cleanPass = (password || '').trim();

  const user = users.find(u => u.username.toLowerCase().trim() === cleanUser && u.password.trim() === cleanPass);
  if (!user) {
    return res.status(401).json({ error: 'Invalid Username or Password. Please check for spelling or spaces.' });
  }

  const token = crypto.randomBytes(24).toString('hex');
  const userSession = { id: user.id, username: user.username, name: user.name, role: user.role };
  activeTokens.set(token, userSession);

  res.json({
    success: true,
    token,
    user: userSession
  });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : req.query.token;
  if (token && activeTokens.has(token)) {
    return res.json({ authenticated: true, user: activeTokens.get(token) });
  }
  res.json({ authenticated: false });
});

app.post('/api/change-password', requireAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters.' });
  }
  
  const users = readJSON(USERS_FILE, []);
  const uIndex = users.findIndex(u => u.id === req.user.id);
  if (uIndex === -1) return res.status(404).json({ error: 'User not found.' });

  if (users[uIndex].password !== oldPassword) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }

  users[uIndex].password = newPassword;
  writeJSON(USERS_FILE, users);
  res.json({ success: true, message: 'Password updated successfully!' });
});

// --- API ENDPOINTS ---

// WhatsApp Connection Status
app.get('/api/status', (req, res) => {
  res.json({
    status: whatsappStatus,
    qrCode: qrCodeDataURL,
    info: clientInfo
  });
});

// Logout WhatsApp Session
app.post('/api/logout', async (req, res) => {
  try {
    if (sock && (whatsappStatus === 'ready' || whatsappStatus === 'authenticated')) {
      await sock.logout();
    }
    whatsappStatus = 'disconnected';
    qrCodeDataURL = null;
    clientInfo = null;
    try {
      fs.rmSync(authDir, { recursive: true, force: true });
    } catch (e) {}
    setTimeout(connectToWhatsApp, 2000);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Officers CRUD
app.get('/api/officers', (req, res) => {
  let officers = readJSON(OFFICERS_FILE, []);
  const q = req.query.q ? req.query.q.toLowerCase().trim() : '';
  
  if (q) {
    officers = officers.filter(off =>
      (off.name && off.name.toLowerCase().includes(q)) ||
      (off.designation && off.designation.toLowerCase().includes(q)) ||
      (off.department && off.department.toLowerCase().includes(q)) ||
      (off.phone && off.phone.includes(q))
    );
  }
  res.json(officers);
});

app.post('/api/officers', requireAuth, upload.single('photo'), (req, res) => {
  const officers = readJSON(OFFICERS_FILE, []);
  const { name, designation, department, phone, notes } = req.body;
  
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and Phone number are required.' });
  }
  
  const photo = req.file ? '/uploads/' + req.file.filename : '/uploads/default_avatar.svg';
  const newOfficer = {
    id: 'off_' + Date.now(),
    name,
    designation: designation || '',
    department: department || '',
    phone,
    photo,
    notes: notes || '',
    createdAt: new Date().toISOString()
  };
  
  officers.push(newOfficer);
  writeJSON(OFFICERS_FILE, officers);
  res.status(201).json(newOfficer);
});

app.put('/api/officers/:id', requireAuth, upload.single('photo'), (req, res) => {
  const officers = readJSON(OFFICERS_FILE, []);
  const index = officers.findIndex(o => o.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Officer not found.' });
  }
  
  const { name, designation, department, phone, notes } = req.body;
  const existing = officers[index];
  
  const updatedOfficer = {
    ...existing,
    name: name || existing.name,
    designation: designation !== undefined ? designation : existing.designation,
    department: department !== undefined ? department : existing.department,
    phone: phone || existing.phone,
    photo: req.file ? '/uploads/' + req.file.filename : existing.photo,
    notes: notes !== undefined ? notes : existing.notes,
    updatedAt: new Date().toISOString()
  };
  
  officers[index] = updatedOfficer;
  writeJSON(OFFICERS_FILE, officers);
  res.json(updatedOfficer);
});

app.delete('/api/officers/:id', requireAuth, (req, res) => {
  let officers = readJSON(OFFICERS_FILE, []);
  const filtered = officers.filter(o => o.id !== req.params.id);
  writeJSON(OFFICERS_FILE, filtered);
  res.json({ success: true, message: 'Officer deleted.' });
});

// --- CUSTOMER / PUBLIC FILES CRUD ---
app.get('/api/customers', (req, res) => {
  let customers = readJSON(CUSTOMERS_FILE, []);
  const q = req.query.q ? req.query.q.toLowerCase().trim() : '';
  
  if (q) {
    customers = customers.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.fileNo && c.fileNo.toLowerCase().includes(q)) ||
      (c.idNo && c.idNo.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.notes && c.notes.toLowerCase().includes(q))
    );
  }
  res.json(customers);
});

app.post('/api/customers', requireAuth, (req, res) => {
  const customers = readJSON(CUSTOMERS_FILE, []);
  const { fileNo, name, idNo, address, phone, notes } = req.body;
  
  if (!name || !phone) {
    return res.status(400).json({ error: 'Customer Name and Phone number are required.' });
  }
  
  const newCustomer = {
    id: 'cust_' + Date.now(),
    fileNo: fileNo || 'DSB/REC/' + Date.now().toString().slice(-4),
    name,
    idNo: idNo || '',
    address: address || '',
    phone,
    notes: notes || '',
    createdAt: new Date().toISOString()
  };
  
  customers.push(newCustomer);
  writeJSON(CUSTOMERS_FILE, customers);
  res.status(201).json(newCustomer);
});

app.put('/api/customers/:id', requireAuth, (req, res) => {
  const customers = readJSON(CUSTOMERS_FILE, []);
  const index = customers.findIndex(c => c.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Customer record not found.' });
  }
  
  const { fileNo, name, idNo, address, phone, notes } = req.body;
  const existing = customers[index];
  
  const updatedCustomer = {
    ...existing,
    fileNo: fileNo !== undefined ? fileNo : existing.fileNo,
    name: name || existing.name,
    idNo: idNo !== undefined ? idNo : existing.idNo,
    address: address !== undefined ? address : existing.address,
    phone: phone || existing.phone,
    notes: notes !== undefined ? notes : existing.notes,
    updatedAt: new Date().toISOString()
  };
  
  customers[index] = updatedCustomer;
  writeJSON(CUSTOMERS_FILE, customers);
  res.json(updatedCustomer);
});

app.delete('/api/customers/:id', requireAuth, (req, res) => {
  let customers = readJSON(CUSTOMERS_FILE, []);
  const filtered = customers.filter(c => c.id !== req.params.id);
  writeJSON(CUSTOMERS_FILE, filtered);
  res.json({ success: true, message: 'Customer record deleted.' });
});

// Send Message / Image via WhatsApp (Baileys Engine)
app.post('/api/send', requireAuth, upload.single('attachment'), async (req, res) => {
  if (whatsappStatus !== 'ready' || !sock) {
    return res.status(400).json({
      error: 'WhatsApp is not ready. Please scan the QR code to connect.'
    });
  }

  const { officerId, phone, message } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }
  if (!message && !req.file) {
    return res.status(400).json({ error: 'Message content or image attachment is required.' });
  }

  const jid = await resolveJid(phone);
  let officerName = 'Unknown Officer';

  if (officerId) {
    const officers = readJSON(OFFICERS_FILE, []);
    const off = officers.find(o => o.id === officerId);
    if (off) officerName = off.name;
  }

  try {
    let attachmentUrl = null;

    if (req.file) {
      attachmentUrl = '/uploads/' + req.file.filename;
      const mediaPath = path.join(uploadsDir, req.file.filename);
      const fileBuffer = fs.readFileSync(mediaPath);

      // Send Image via Baileys
      await sock.sendMessage(jid, {
        image: fileBuffer,
        caption: message || '',
        mimetype: req.file.mimetype || 'image/jpeg'
      });
    } else {
      // Send Text Message via Baileys
      await sock.sendMessage(jid, {
        text: message
      });
    }

    // Save history log
    const history = readJSON(HISTORY_FILE, []);
    const newLog = {
      id: 'msg_' + Date.now(),
      officerId: officerId || null,
      officerName,
      phone,
      message: message || '',
      attachment: attachmentUrl,
      timestamp: new Date().toISOString(),
      status: 'SENT'
    };
    history.unshift(newLog);
    writeJSON(HISTORY_FILE, history);

    res.json({ success: true, message: 'Message sent successfully!', log: newLog });
  } catch (err) {
    console.error('Baileys Send Error:', err);
    res.status(500).json({
      error: 'Failed to send WhatsApp message.',
      details: err.message
    });
  }
});

// Message History
app.get('/api/history', (req, res) => {
  const history = readJSON(HISTORY_FILE, []);
  res.json(history);
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`Office WhatsApp Sender App (Baileys Engine) running at:`);
  console.log(`http://localhost:${PORT}`);
  console.log(`===================================================`);
});
