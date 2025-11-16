# DKG Node - Supply Chain Intelligence

Publishing real supply chain data to OriginTrail's Decentralized Knowledge Graph.

## Published Data

**TSMC Semiconductor Supply Chain**
- Source: Wikipedia (Nov 2025)
- Dataset Root: `0x63cc9aaa19a29a3d30c39d20160faf52f9df0800ea4b2ef655940abfd13c8372`
- Network: NeuroWeb Testnet (Chain ID 20430)

## Manual Verification

**1. Check saved publication:**
```bash
cat published-tsmc.json
```
Look for `datasetRoot` - this hash proves your data is on the DKG.

**2. Check blockchain transactions:**
https://neuroweb-testnet.subscan.io/account/0xe8B00B6dD212c2c88415d934cffacEc8D739d2e4

**3. Verify wallet balance:**
```bash
node check-wallet.js
```

The dataset root hash (`0x63cc9aaa...`) is cryptographic proof that the TSMC data exists on the decentralized network.

## Wallet

Address: `0xe8B00B6dD212c2c88415d934cffacEc8D739d2e4`  
Balance: 0.0000099 NEURO

Get tokens:
- NEURO: https://neuroweb-testnet.subscan.io/tools/faucet
- TRAC: https://faucet-testnet.origin-trail.network/

## Publish More

```bash
node check-wallet.js
node publish-tsmc-supply-chain.js
```

## Files

- `check-wallet.js` - Check balance
- `publish-tsmc-supply-chain.js` - Publish data
- `published-tsmc.json` - Publication proof
