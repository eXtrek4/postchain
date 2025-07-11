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

// ✅ Load blockchain from file
if (fs.existsSync(DB_FILE)) {
    const saved = fs.readFileSync(DB_FILE);
    myChain.chain = JSON.parse(saved);
    console.log("✅ Blockchain loaded from disk");
} else {
    console.log("📦 New blockchain created");
}

// 🔗 GET /blocks — full chain
app.get('/blocks', (req, res) => {
    res.json(myChain.chain);
});

// 📰 GET /posts — filter only messages
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

// 📝 POST /newPost — called by Lovable frontend
app.post('/newPost', (req, res) => {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
    }

    const signature = sign(message);
    const from = getPublicKey();

    const newIndex = myChain.chain.length;
    const newBlock = new Block(newIndex, Date.now().toString(), { message, from, signature });

    myChain.addBlock(newBlock);
    credit(from, 10);
    fs.writeFileSync(DB_FILE, JSON.stringify(myChain.chain, null, 2));
    p2pServer.broadcastBlock(newBlock);

    console.log(`✅ New post: #${newBlock.index} from ${from}`);
    res.status(201).json({
        message: newBlock.data.message,
        from: newBlock.data.from,
        timestamp: newBlock.timestamp,
        hash: newBlock.hash
    });
});

// 📊 GET /balance/:pubKey — return balance
app.get('/balance/:pubKey', (req, res) => {
    const pubKey = req.params.pubKey;
    const balance = getBalance(pubKey);
    res.json({ balance: balance.toString() });
});

// 🚀 Start HTTP server
app.listen(HTTP_PORT, () => {
    console.log(`🚀 Server running at http://localhost:${HTTP_PORT}`);
});
