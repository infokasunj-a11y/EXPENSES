const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const JSONDatabase = require('./database');

const app = express();
app.enable('trust proxy');
const PORT = process.env.PORT || 3001;

// Initialize JSON database
const db = new JSONDatabase();

app.use(cors());
app.use(express.json());

// Serve static assets from built frontend
app.use(express.static(path.join(__dirname, 'dist')));

// Helper to manually read .env variables (if user decides to add environment settings later)
function getEnv(key) {
    try {
        const envPath = path.join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf-8');
            const lines = envContent.split(/\r?\n/);
            for (const line of lines) {
                const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
                if (match && match[1] === key) {
                    return match[2] ? match[2].trim() : '';
                }
            }
        }
    } catch (e) {
        // Silently ignore if .env does not exist
    }
    return undefined;
}

// Helper to get local network IP
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// API Routes

// Get all transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await db.getAll();
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Create new transaction
app.post('/api/transactions', async (req, res) => {
  try {
    const { amount, type, category, date, notes, addedBy } = req.body;
    
    if (amount === undefined || !type || !category) {
      return res.status(400).json({ error: 'Missing required fields (amount, type, category)' });
    }

    const newTx = await db.create({ amount, type, category, date, notes, addedBy });
    res.status(201).json(newTx);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Update transaction
app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, type, category, date, notes, addedBy } = req.body;
    
    const updatedTx = await db.update(id, { amount, type, category, date, notes, addedBy });
    if (!updatedTx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(updatedTx);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// Delete transaction
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.delete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Serve frontend routing fallback (SPA support)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend not built yet. Please run build script first.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`Family Budget Tracker Backend is running!`);
  console.log(`Local Access: http://localhost:${PORT}`);
  console.log(`WiFi Network Access: http://${getLocalIP()}:${PORT}`);
  console.log(`======================================================\n`);
});
