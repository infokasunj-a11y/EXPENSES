const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class JSONDatabase {
  constructor(filePath) {
    this.filePath = filePath || path.join(__dirname, 'data', 'transactions.json');
    this.backupDir = path.join(__dirname, 'data', 'backups');
    
    // Cloud Mode (Vercel KV / Upstash Redis) config
    this.kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL || null;
    this.kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN || null;

    // Clean URL if wrapped in quotes or whitespace
    if (this.kvUrl) this.kvUrl = this.kvUrl.trim().replace(/^["']|["']$/g, '');
    if (this.kvToken) this.kvToken = this.kvToken.trim().replace(/^["']|["']$/g, '');

    this.kv = null;

    if (this.kvUrl && this.kvToken) {
      try {
        const { createClient } = require('@vercel/kv');
        this.kv = createClient({
          url: this.kvUrl,
          token: this.kvToken,
        });
        console.log('[INFO] Cloud Redis (@vercel/kv) client initialized successfully (Cloud Mode).');
      } catch (e) {
        console.log('[INFO] @vercel/kv client initialization skipped, using direct HTTP REST API fallback.');
      }
    }

    this.init();
  }

  init() {
    // If in Cloud Mode, we don't need to create local file system directories
    if (this.kvUrl && this.kvToken) return;

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

  // Synchronous helpers only used in constructor/init for local mode
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
    // 1. Try @vercel/kv client if available
    if (this.kv) {
      try {
        const data = await this.kv.get('family-budget:transactions');
        return Array.isArray(data) ? data : (typeof data === 'string' ? JSON.parse(data) : []);
      } catch (e) {
        console.error('[WARN] @vercel/kv get failed, attempting direct REST fetch fallback:', e.message);
      }
    }

    // 2. Direct HTTP REST API fallback for Upstash Redis
    if (this.kvUrl && this.kvToken) {
      try {
        const cleanUrl = this.kvUrl.replace(/\/+$/, '');
        const res = await fetch(`${cleanUrl}/get/family-budget:transactions`, {
          headers: {
            'Authorization': `Bearer ${this.kvToken}`
          }
        });
        if (res.ok) {
          const json = await res.json();
          let rawVal = json.result;
          if (!rawVal) return [];
          if (typeof rawVal === 'string') {
            try { return JSON.parse(rawVal); } catch (e) { return []; }
          }
          return Array.isArray(rawVal) ? rawVal : [];
        } else {
          console.error('[ERROR] Upstash REST GET returned non-200 status:', res.status);
        }
      } catch (e) {
        console.error('[ERROR] Upstash REST GET fetch error:', e.message);
      }
      return [];
    }

    // 3. Local file fallback
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const content = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.error('Failed to read local database file:', err);
      return [];
    }
  }

  async writeRaw(data) {
    let cloudSaveSuccess = false;

    // 1. Try @vercel/kv client
    if (this.kv) {
      try {
        await this.kv.set('family-budget:transactions', data);
        console.log('[SUCCESS] Saved transactions to Cloud Redis via @vercel/kv client.');
        cloudSaveSuccess = true;
      } catch (e) {
        console.error('[WARN] @vercel/kv set failed, attempting direct REST POST fallback:', e.message);
      }
    }

    // 2. Direct HTTP REST API fallback for Upstash Redis
    if (!cloudSaveSuccess && this.kvUrl && this.kvToken) {
      try {
        const cleanUrl = this.kvUrl.replace(/\/+$/, '');
        const res = await fetch(`${cleanUrl}/set/family-budget:transactions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.kvToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          console.log('[SUCCESS] Saved transactions to Upstash Cloud Redis via direct HTTP REST API.');
          cloudSaveSuccess = true;
        } else {
          const errText = await res.text();
          console.error('[ERROR] Upstash REST SET returned non-200 status:', res.status, errText);
        }
      } catch (e) {
        console.error('[ERROR] Upstash REST SET fetch error:', e.message);
      }
    }

    if (this.kvUrl && this.kvToken) {
      if (!cloudSaveSuccess) {
        throw new Error('FAILED_TO_SAVE_TO_CLOUD_DATABASE: Cloud database set operation failed.');
      }
      return true;
    }

    // 3. Local file fallback
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tempPath, this.filePath);
      this.autoBackup();
      console.log('[SUCCESS] Saved transactions to local file database.');
      return true;
    } catch (err) {
      console.error('Failed to write database file:', err);
      throw new Error(`LOCAL_DB_WRITE_FAILED: ${err.message}`);
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

    // Will throw Error if write fails, so caller receives error status!
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
