#!/usr/bin/env node

/**
 * Publish TSMC Semiconductor Supply Chain Data to DKG Testnet
 * Data source: Wikipedia (November 2025)
 * Run: node publish-tsmc-supply-chain.js
 */

const DKG = require('dkg.js');
const { ethers } = require('ethers');
require('dotenv').config({ path: './dkg-node/apps/agent/.env' });

const PRIVATE_KEY = process.env.DKG_PUBLISH_WALLET;
const BLOCKCHAIN = process.env.DKG_BLOCKCHAIN || 'otp:20430';
const NODE_URL = process.env.DKG_OTNODE_URL || 'https://v6-pegasus-node-02.origin-trail.network:8900';

const wallet = new ethers.Wallet(PRIVATE_KEY);
const WALLET_ADDRESS = wallet.address;

console.log('Publishing TSMC Supply Chain Data to DKG');
console.log('Blockchain:', BLOCKCHAIN);
console.log('Wallet:', WALLET_ADDRESS);
console.log('');

const dkg = new DKG({
  endpoint: 'https://v6-pegasus-node-02.origin-trail.network',
  port: 8900,
  blockchain: {
    name: BLOCKCHAIN,
    publicKey: WALLET_ADDRESS,
    privateKey: PRIVATE_KEY
  },
  maxNumberOfRetries: 5,
  frequency: 2,
  contentType: 'all'
});

// Real data from Wikipedia about TSMC
const knowledgeAsset = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Taiwan Semiconductor Manufacturing Company (TSMC)",
  "description": "World's largest dedicated independent semiconductor foundry",
  "foundingDate": "1987",
  "location": {
    "@type": "Place",
    "name": "Hsinchu Science Park, Taiwan",
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "Taiwan"
    }
  },
  "industry": "Semiconductor manufacturing",
  "marketPosition": "World's largest pure-play semiconductor foundry",
  "economicImpact": {
    "taiwanExports2022": "$184 billion in integrated circuits",
    "percentageOfTaiwanGDP": "25%",
    "taiwanStockExchangeWeight": "30% of main index",
    "forbesGlobal2000Rank": 44
  },
  "supplyChainSignificance": "Critical supplier for global technology companies including Apple, NVIDIA, AMD, and Qualcomm",
  "geopoliticalRisk": "Concentration of advanced semiconductor manufacturing in Taiwan creates supply chain vulnerability",
  "dataSource": {
    "@type": "WebPage",
    "name": "TSMC - Wikipedia",
    "url": "https://en.wikipedia.org/wiki/TSMC",
    "dateAccessed": "2025-11-12"
  },
  "keywords": ["TSMC", "semiconductors", "supply chain", "Taiwan", "chip manufacturing", "technology"]
};

async function publish() {
  try {
    console.log('Knowledge Asset:');
    console.log('  Name:', knowledgeAsset.name);
    console.log('  Industry:', knowledgeAsset.industry);
    console.log('  Market Position:', knowledgeAsset.marketPosition);
    console.log('  Data Source: Wikipedia');
    console.log('');

    console.log('Publishing to DKG Testnet...');
    console.log('(This may take 30-60 seconds)');
    console.log('');

    const result = await dkg.asset.create(
      {
        public: knowledgeAsset
      },
      {
        epochsNum: 2,
        immutable: false
      }
    );

    console.log('SUCCESS - Knowledge Asset Published');
    console.log('');
    console.log('UAL:', result.UAL);
    console.log('');
    console.log('View on DKG Explorer:');
    console.log(`https://dkg-testnet.origintrail.io/explore?ual=${encodeURIComponent(result.UAL)}`);
    console.log('');
    
    const fs = require('fs');
    fs.writeFileSync(
      'published-tsmc.json',
      JSON.stringify({ ...result, knowledgeAsset }, null, 2)
    );
    console.log('Result saved to: published-tsmc.json');

  } catch (error) {
    console.error('');
    console.error('ERROR: Publishing failed');
    console.error('');
    
    if (error.message.includes('insufficient funds')) {
      console.error('Insufficient funds');
      console.error('NEURO faucet: https://neuroweb-testnet.subscan.io/tools/faucet');
      console.error('TRAC faucet: https://faucet-testnet.origin-trail.network/');
      console.error('Wallet:', WALLET_ADDRESS);
    } else {
      console.error('Error:', error.message);
      if (error.stack) {
        console.error('Stack:', error.stack);
      }
    }
    
    process.exit(1);
  }
}

publish();
