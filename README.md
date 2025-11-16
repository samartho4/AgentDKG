# DKG Node - Supply Chain Intelligence

Real supply chain data published to OriginTrail's Decentralized Knowledge Graph.

## Published Data

**TSMC Semiconductor Supply Chain**
- Source: Wikipedia (Nov 2025)
- Dataset Root: `0x63cc9aaa19a29a3d30c39d20160faf52f9df0800ea4b2ef655940abfd13c8372`
- Wallet: `0xe8B00B6dD212c2c88415d934cffacEc8D739d2e4`
- Network: NeuroWeb Testnet (otp:20430)

## Verify Publication

**1. Check saved result:**
```bash
cat published-tsmc.json
```
The `datasetRoot` hash is cryptographic proof your data is on the DKG.

**2. Find your token_id on blockchain:**

Visit: https://neuroweb-testnet.subscan.io/account/0xe8B00B6dD212c2c88415d934cffacEc8D739d2e4

Look for recent transactions. Your token_id will be in the transaction that published the knowledge asset.

**3. Query DKG with SPARQL (once replication completes):**

The DKG uses SPARQL to query knowledge assets. Example query to find your publications:

```sparql
PREFIX dkg: <https://ontology.origintrail.io/dkg/1.0#>

SELECT ?kaGraph ?publishTime WHERE {
    GRAPH <metadata:graph> {
        ?kc dkg:publishedBy <did:dkg:publisherKey/0xe8B00B6dD212c2c88415d934cffacEc8D739d2e4> .
        ?kc dkg:hasNamedGraph ?kaGraph .
        OPTIONAL { ?kc dkg:publishTime ?publishTime . }
    }
}
```

**4. Search DKG Explorer:**

https://dkg-testnet.origintrail.io/explore

Search by:
- Dataset root: `0x63cc9aaa19a29a3d30c39d20160faf52f9df0800ea4b2ef655940abfd13c8372`
- Wallet: `0xe8B00B6dD212c2c88415d934cffacEc8D739d2e4`

## Your UAL Format

Once you find the token_id from blockchain:
```
did:dkg:otp:20430/0xe8B00B6dD212c2c88415d934cffacEc8D739d2e4/[token_id]
```

## Wallet

Address: `0xe8B00B6dD212c2c88415d934cffacEc8D739d2e4`  
Balance: 0.0000099 NEURO


## Publish More

```bash
node check-wallet.js
node publish-tsmc-supply-chain.js
```

## Files

- `check-wallet.js` - Check balance
- `publish-tsmc-supply-chain.js` - Publish data
- `published-tsmc.json` - Publication proof
- `query-dkg.js` - SPARQL query example
