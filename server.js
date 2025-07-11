const express = require('express');
const cors = require('cors'); // ✅ CORS support
const fs = require('fs');
const { Block, Blockchain } = require('./blockchain');
const P2PServer = require('./p2p');
const { sign, getPublicKey } = require('./wallet');
const { credit, getBalance } = require('./token');

const app = express();
app.use(cors()); // ✅ Allow cross-origin
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

// 📬 GET /posts — return all posts from blockchain
app.get('/posts', (req, res) => {
    const posts = myChain.chain
        .filter(block => block.data && block.data.message)
        .map(block => ({
            message: block.data.message,
            from: block.data.from,
            timestamp: block.timestamp,
            hash: block.hash
        }));
    res.json(posts);
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

    // 💰 Reward the miner
    credit(from, 10);

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
    res.json({ balance: balance.toString() });
});

// 🚀 Start HTTP server
app.listen(HTTP_PORT, () => {
    console.log(`🚀 Server running at http://localhost:${HTTP_PORT}`);
});

