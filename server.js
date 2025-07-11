const express = require('express');
const cors = require('cors'); // ✅ ADD THIS
const fs = require('fs');
const { Block, Blockchain } = require('./blockchain');
const P2PServer = require('./p2p');
const { sign, getPublicKey } = require('./wallet');
const { credit, getBalance } = require('./token'); // ✅ Import getBalance for /balance route

const app = express();
app.use(cors()); // ✅ ALLOW CROSS-ORIGIN REQUESTS
app.use(express.json());

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const DB_FILE = `blockchain-${HTTP_PORT}.json`;

const myChain = new Blockchain();
const p2pServer = new P2PServer(myChain);
p2pServer.listen();

// ✅ Load blockchain from disk if exists
if (fs.existsSync(DB_FILE)) {
    const saved = fs.readFileSync(DB_FILE);
    myChain.chain = JSON.parse(saved);
    console.log("✅ Blockchain loaded from disk");
} else {
    console.log("📦 New blockchain created");
}

// 🔗 GET /blocks — list all blocks
app.get('/blocks', (req, res) => {
    res.json(myChain.chain);
});

// ⛏️ POST /mine — mine a new block and reward 10 POS
app.post('/mine', (req, res) => {
    const message = req.body.message || 'No message';
    const signature = sign(message);
    const from = getPublicKey();

    const blockData = { message, from, signature };
    const newIndex = myChain.chain.length;
    const newBlock = new Block(newIndex, Date.now().toString(), blockData);

    myChain.addBlock(newBlock);

    // 💰 Reward the miner's wallet
    credit(from, 10); // Reward 10 POS to miner only

    // 💾 Save to disk
    fs.writeFileSync(DB_FILE, JSON.stringify(myChain.chain, null, 2));
    p2pServer.broadcastBlock(newBlock);

    console.log(`⛏️  New block mined: #${newBlock.index} with hash ${newBlock.hash}`);
    res.json(newBlock);
});

// 📊 GET /balance/:pubKey — return POS balance for a wallet
app.get('/balance/:pubKey', (req, res) => {
    const pubKey = req.params.pubKey;
    const balance = getBalance(pubKey);
    res.json({ balance: balance.toString() }); // still in wei-like format
});

// 🚀 Start HTTP server
app.listen(HTTP_PORT, () => {
    console.log(`🚀 Server running at http://localhost:${HTTP_PORT}`);
});

