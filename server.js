const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { Block, Blockchain } = require('./blockchain');
const P2PServer = require('./p2p');
const { sign, getPublicKey } = require('./wallet');
const { credit, getBalance } = require('./token');

const app = express();
app.use(cors());
app.use(express.json());

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const DB_FILE = `blockchain-${HTTP_PORT}.json`;

const myChain = new Blockchain();
const p2pServer = new P2PServer(myChain);
p2pServer.listen();

// 🔄 Load blockchain from disk
if (fs.existsSync(DB_FILE)) {
    const saved = fs.readFileSync(DB_FILE);
    myChain.chain = JSON.parse(saved);
    console.log("✅ Blockchain loaded from disk");
} else {
    console.log("📦 New blockchain created");
}

// 🔗 List all blocks
app.get('/blocks', (req, res) => {
    res.json(myChain.chain);
});

// 📬 Get all posts from blockchain
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

// 🧱 Create new post (used by frontend)
app.post('/newPost', (req, res) => {
    const { message, signature, from } = req.body;

    if (!message || !signature || !from) {
        return res.status(400).json({ error: "Missing message, signature, or from" });
    }

    const newIndex = myChain.chain.length;
    const newBlock = new Block(newIndex, Date.now().toString(), { message, from, signature });

    myChain.addBlock(newBlock);
    credit(from, 10); // reward POS
    fs.writeFileSync(DB_FILE, JSON.stringify(myChain.chain, null, 2));
    p2pServer.broadcastBlock(newBlock);

    console.log(`📝 New post added and mined: #${newBlock.index} - ${message}`);
    res.json(newBlock);
});

// ⛏️ Optional: raw mine endpoint
app.post('/mine', (req, res) => {
    const message = req.body.message || 'No message';
    const signature = sign(message);
    const from = getPublicKey();

    const newIndex = myChain.chain.length;
    const newBlock = new Block(newIndex, Date.now().toString(), { message, from, signature });

    myChain.addBlock(newBlock);
    credit(from, 10);
    fs.writeFileSync(DB_FILE, JSON.stringify(myChain.chain, null, 2));
    p2pServer.broadcastBlock(newBlock);

    console.log(`⛏️  Mined: #${newBlock.index}`);
    res.json(newBlock);
});

// 💰 Get balance by public key
app.get('/balance/:pubKey', (req, res) => {
    const pubKey = req.params.pubKey;
    const balance = getBalance(pubKey);
    res.json({ balance: balance.toString() });
});

// 🚀 Start server
app.listen(HTTP_PORT, () => {
    console.log(`🚀 Server running at http://localhost:${HTTP_PORT}`);
});
