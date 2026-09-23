const JSONDatabase = require('./database');
const path = require('path');
const fs = require('fs');

async function runTest() {
  console.log('Testing JSONDatabase with Hotel 23% Commission Support...');
  const testDbPath = path.join(__dirname, 'data', 'test_transactions.json');

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  try {
    const db = new JSONDatabase(testDbPath);
    console.log('[OK] Database initialized successfully.');

    console.log('Testing Create Standard Expense Transaction...');
    const tx = await db.create({
      amount: 1500.50,
      type: 'expense',
      category: 'Food & Drinks',
      date: '2026-09-22',
      notes: 'Dinner test',
      addedBy: 'Husband'
    });
    console.log('Created Standard Transaction:', tx);

    if (tx.amount !== 1500.50 || tx.type !== 'expense' || !tx.id) {
      throw new Error('Transaction creation validation failed');
    }

    console.log('Testing Create Hotel Income Transaction with 23% Commission...');
    const hotelTx = await db.create({
      amount: 100000,
      type: 'income',
      category: 'Hotel Income',
      date: '2026-09-22',
      notes: 'Booking.com September booking',
      addedBy: 'Husband'
    });
    console.log('Created Hotel Transaction:', hotelTx);

    if (
      hotelTx.amount !== 100000 || 
      hotelTx.commissionRate !== 23 || 
      hotelTx.commissionAmount !== 23000 || 
      hotelTx.netAmount !== 77000
    ) {
      throw new Error('Hotel 23% commission calculation failed!');
    }
    console.log('[OK] Hotel Income 23% Commission verified successfully! (Gross: 100k, Comm: 23k, Net: 77k)');

    console.log('Testing Get All Transactions...');
    const allTx = await db.getAll();
    if (allTx.length !== 2) {
      throw new Error('Get all verification failed');
    }

    console.log('Testing Delete Transaction...');
    await db.delete(tx.id);
    await db.delete(hotelTx.id);

    // Cleanup
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    console.log('=============================================');
    console.log('HOTEL COMMISSION DATABASE TEST PASSED!');
    console.log('=============================================');
    process.exit(0);
  } catch (err) {
    console.error('Database test FAILED:', err);
    process.exit(1);
  }
}

runTest();
