const express = require('express');
const cors = require('cors');
const fs = require('fs');
const http = require('http');

const { Block, Blockchain } = require('./blockchain');
const { sign, getPublicKey } = require('./wallet');
const { credit, getBalance } = require('./token');
const P2PServer = require('./p2p');

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const DB_FILE = `blockchain-${HTTP_PORT}.json`;

const app = express();
app.use(cors());
app.use(express.json());

const blockchain = new Blockchain();
const p2p = new P2PServer(blockchain);

// ✅ Load blockchain from disk
if (fs.existsSync(DB_FILE)) {
    const saved = fs.readFileSync(DB_FILE);
    blockchain.chain = JSON.parse(saved);
    console.log("✅ Blockchain loaded from disk");
} else {
    console.log("📦 New blockchain created");
}

// 🔗 Existing endpoints
app.get('/blocks', (req, res) => {
    res.json(blockchain.chain);
});

app.get('/posts', (req, res) => {
    const posts = blockchain.chain
        .filter(block => block.data?.message)
        .map(block => ({
            message: block.data.message,
            from: block.data.from,
            timestamp: block.timestamp,
            hash: block.hash
        }));
    res.json(posts);
});

app.post('/newPost', (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
    }

    const signature = sign(message);
    const from = getPublicKey();

    const newIndex = blockchain.chain.length;
    const newBlock = new Block(newIndex, Date.now().toString(), { message, from, signature });

    const added = blockchain.addBlock(newBlock);
    if (!added) return res.status(500).json({ error: "Failed to add block" });

    credit(from, 10);
    fs.writeFileSync(DB_FILE, JSON.stringify(blockchain.chain, null, 2));
    p2p.broadcastBlock(newBlock);

    console.log(`✅ New post: #${newBlock.index} from ${from}`);
    res.status(201).json({
        message: newBlock.data.message,
        from: newBlock.data.from,
        timestamp: newBlock.timestamp,
        hash: newBlock.hash
    });
});

// ✅ New mining endpoint (just adds a block with dummy data)
app.post('/mine', (req, res) => {
    const data = req.body.data || "⛏️ Block mined from /mine API";
    const lastBlock = blockchain.getLatestBlock();

    const newBlock = new Block(
        lastBlock.index + 1,
        Date.now().toString(),
        data,
        lastBlock.hash
    );

    const added = blockchain.addBlock(newBlock);
    if (!added) return res.status(500).json({ error: "Block rejected" });

    fs.writeFileSync(DB_FILE, JSON.stringify(blockchain.chain, null, 2));
    p2p.broadcastBlock(newBlock);

    console.log(`⛏️ Mined new block #${newBlock.index} via /mine`);
    res.json({ message: "Block mined and broadcast", block: newBlock });
});

// 🌐 Start HTTP and P2P server
const server = http.createServer(app);
server.listen(HTTP_PORT, () => {
    console.log(`🚀 HTTP API running at http://localhost:${HTTP_PORT}`);
    p2p.listen();
});
