#!/usr/bin/env node

/**
 * Check Wallet Balance on NeuroWeb Testnet
 * Run: node check-wallet.js
 */

const { ethers } = require('ethers');
require('dotenv').config({ path: './dkg-node/apps/agent/.env' });

const PRIVATE_KEY = process.env.DKG_PUBLISH_WALLET;
// NeuroWeb Testnet RPC (chain ID 20430 = 0x4fce)
const RPC_URL = 'https://lofar-testnet.origin-trail.network/';

async function checkBalance() {
  try {
    console.log('🔍 Checking Wallet Balance on NeuroWeb Testnet');
    console.log('================================================');
    console.log('');

    // Derive wallet address
    const wallet = new ethers.Wallet(PRIVATE_KEY);
    console.log('📍 Wallet Address:', wallet.address);
    console.log('');

    // Connect to NeuroWeb Testnet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const walletWithProvider = wallet.connect(provider);

    // Get NEURO balance (native token)
    console.log('⏳ Fetching balances...');
    const balance = await provider.getBalance(wallet.address);
    const balanceInNeuro = ethers.formatEther(balance);

    console.log('');
    console.log('💰 Balances:');
    console.log('   NEURO (gas):', balanceInNeuro, 'NEURO');
    console.log('');

    // Check if wallet has enough funds
    const hasEnoughGas = parseFloat(balanceInNeuro) > 0.1;
    
    if (hasEnoughGas) {
      console.log('✅ Wallet has sufficient NEURO for gas fees');
    } else {
      console.log('⚠️  Low NEURO balance!');
      console.log('');
      console.log('   Get testnet NEURO tokens:');
      console.log('   → https://neuroweb-testnet.subscan.io/tools/faucet');
    }

    console.log('');
    console.log('📝 Note: TRAC token balance requires contract interaction');
    console.log('   Check TRAC balance on explorer:');
    console.log('   → https://neuroweb-testnet.subscan.io/account/' + wallet.address);
    console.log('');
    console.log('🔗 Get testnet TRAC tokens:');
    console.log('   → https://faucet-testnet.origin-trail.network/');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Error checking balance:', error.message);
    console.error('');
    
    if (error.message.includes('private key')) {
      console.error('🔑 Invalid private key in .env file');
      console.error('   Check DKG_PUBLISH_WALLET variable');
    }
  }
}

checkBalance();
