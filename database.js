const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class JSONDatabase {
  constructor(filePath) {
    this.filePath = filePath || path.join(__dirname, 'data', 'transactions.json');
    this.backupDir = path.join(__dirname, 'data', 'backups');
    
    // Cloud Mode (Vercel KV) config
    this.kv = null;
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;

    if (KV_URL && KV_TOKEN) {
      try {
        const { createClient } = require('@vercel/kv');
        this.kv = createClient({
          url: KV_URL,
          token: KV_TOKEN,
        });
        console.log('[INFO] Vercel KV database client initialized successfully (Cloud Mode).');
      } catch (e) {
        console.error('Failed to initialize Vercel KV client:', e);
      }
    }

    this.init();
  }

  init() {
    // If in Cloud Mode, we don't need to create local directories
    if (this.kv) return;

    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      this.writeRawSync([]);
    } else {
      // Validate file integrity
      try {
        const content = fs.readFileSync(this.filePath, 'utf8');
        JSON.parse(content);
      } catch (err) {
        console.error('Database file corrupted! Attempting recovery from backup...', err);
        this.recoverLatestBackupSync() || this.writeRawSync([]);
      }
    }
  }

  // Synchronous helpers only used in constructor/init (before async context)
  writeRawSync(data) {
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, this.filePath);
  }

  recoverLatestBackupSync() {
    try {
      const backups = fs.readdirSync(this.backupDir)
        .filter(file => file.endsWith('.bak'))
        .map(file => ({
          name: file,
          time: fs.statSync(path.join(this.backupDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      if (backups.length > 0) {
        const latestBackup = path.join(this.backupDir, backups[0].name);
        fs.copyFileSync(latestBackup, this.filePath);
        console.log(`Recovered database from backup: ${backups[0].name}`);
        return true;
      }
    } catch (err) {
      console.error('Failed to recover database from backup:', err);
    }
    return false;
  }

  // Core Async Read/Write operations

  async readRaw() {
    if (this.kv) {
      try {
        const data = await this.kv.get('family-budget:transactions');
        return data || [];
      } catch (e) {
        console.error('Error reading from Vercel KV:', e);
        return [];
      }
    }

    // Local file fallback
    try {
      const content = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.error('Failed to read database file:', err);
      return [];
    }
  }

  async writeRaw(data) {
    if (this.kv) {
      try {
        await this.kv.set('family-budget:transactions', data);
        return true;
      } catch (e) {
        console.error('Error writing to Vercel KV:', e);
        return false;
      }
    }

    // Local file fallback
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tempPath, this.filePath);
      this.autoBackup();
      return true;
    } catch (err) {
      console.error('Failed to write database file:', err);
      return false;
    }
  }

  async getAll() {
    const rawData = await this.readRaw();
    return rawData.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB - dateA;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  async getById(id) {
    const items = await this.readRaw();
    return items.find(item => item.id === id);
  }

  async create(transactionData) {
    const items = await this.readRaw();
    const amount = parseFloat(transactionData.amount) || 0;
    const category = transactionData.category || 'Other';
    const isHotel = category.toLowerCase().includes('hotel');
    const commissionRate = isHotel ? (transactionData.commissionRate !== undefined ? parseFloat(transactionData.commissionRate) : 23) : 0;
    const commissionAmount = isHotel ? parseFloat((amount * (commissionRate / 100)).toFixed(2)) : 0;
    const netAmount = isHotel ? parseFloat((amount - commissionAmount).toFixed(2)) : amount;

    const newTransaction = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      amount: amount,
      type: transactionData.type || 'expense',
      category: category,
      date: transactionData.date || new Date().toISOString().split('T')[0],
      notes: transactionData.notes || '',
      addedBy: transactionData.addedBy || 'Family Member',
      isHotel: isHotel,
      commissionRate: commissionRate,
      commissionAmount: commissionAmount,
      netAmount: netAmount,
      createdAt: new Date().toISOString()
    };
    items.push(newTransaction);
    await this.writeRaw(items);
    return newTransaction;
  }

  async update(id, updatedData) {
    const items = await this.readRaw();
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;

    const currentItem = items[index];
    const amount = updatedData.amount !== undefined ? parseFloat(updatedData.amount) : currentItem.amount;
    const category = updatedData.category || currentItem.category;
    const isHotel = category.toLowerCase().includes('hotel');
    const commissionRate = isHotel ? (updatedData.commissionRate !== undefined ? parseFloat(updatedData.commissionRate) : (currentItem.commissionRate || 23)) : 0;
    const commissionAmount = isHotel ? parseFloat((amount * (commissionRate / 100)).toFixed(2)) : 0;
    const netAmount = isHotel ? parseFloat((amount - commissionAmount).toFixed(2)) : amount;

    items[index] = {
      ...currentItem,
      amount: amount,
      type: updatedData.type || currentItem.type,
      category: category,
      date: updatedData.date || currentItem.date,
      notes: updatedData.notes !== undefined ? updatedData.notes : currentItem.notes,
      addedBy: updatedData.addedBy || currentItem.addedBy,
      isHotel: isHotel,
      commissionRate: commissionRate,
      commissionAmount: commissionAmount,
      netAmount: netAmount,
      updatedAt: new Date().toISOString()
    };

    await this.writeRaw(items);
    return items[index];
  }

  async delete(id) {
    const items = await this.readRaw();
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return false;

    items.splice(index, 1);
    await this.writeRaw(items);
    return true;
  }

  autoBackup() {
    try {
      const backupPath = path.join(this.backupDir, `transactions_${Date.now()}.json.bak`);
      fs.copyFileSync(this.filePath, backupPath);

      const backups = fs.readdirSync(this.backupDir)
        .filter(file => file.endsWith('.bak'))
        .map(file => ({
          name: file,
          time: fs.statSync(path.join(this.backupDir, file)).mtime.getTime()
        }))
        .sort((a, b) => a.time - b.time);

      while (backups.length > 10) {
        const oldest = backups.shift();
        fs.unlinkSync(path.join(this.backupDir, oldest.name));
      }
    } catch (err) {
      console.error('Failed to create backup:', err);
    }
  }
}

module.exports = JSONDatabase;
