
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');

const { Block, Blockchain } = require('./blockchain');
const { sign, getPublicKey } = require('./wallet');
const { credit, getBalance } = require('./token');

const app = express();
app.use(cors());
app.use(express.json());

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const DB_FILE = `blockchain-${HTTP_PORT}.json`;

const myChain = new Blockchain();

// 🧠 Store WebSocket connections
const sockets = [];

// 🧠 Gossip-style sync every 5s
function broadcastChain() {
    sockets.forEach(ws => {
        ws.send(JSON.stringify({ type: 'CHAIN', chain: myChain.chain }));
    });
}

// 🧠 Broadcast new block to all peers
function broadcastBlock(block) {
    sockets.forEach(ws => {
        ws.send(JSON.stringify({ type: 'NEW_BLOCK', block }));
    });
}

// 🧠 Sync logic
function messageHandler(ws) {
    ws.on('message', msg => {
        const data = JSON.parse(msg);
        if (data.type === 'CHAIN') {
            myChain.replaceChain(data.chain);
        } else if (data.type === 'NEW_BLOCK') {
            const b = data.block;
            const newBlock = new Block(b.index, b.timestamp, b.data, b.previousHash);
            newBlock.hash = b.hash;
            myChain.addBlock(newBlock);
            fs.writeFileSync(DB_FILE, JSON.stringify(myChain.chain, null, 2));
            console.log(`📥 Received block #${newBlock.index} from peer`);
        }
    });
}

// ✅ Load blockchain from disk
if (fs.existsSync(DB_FILE)) {
    const saved = fs.readFileSync(DB_FILE);
    myChain.chain = JSON.parse(saved);
    console.log("✅ Blockchain loaded from disk");
} else {
    console.log("📦 New blockchain created");
}

// 🔗 API endpoints
app.get('/blocks', (req, res) => {
    res.json(myChain.chain);
});

app.get('/posts', (req, res) => {
    const posts = myChain.chain
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

    const newIndex = myChain.chain.length;
    const newBlock = new Block(newIndex, Date.now().toString(), { message, from, signature });

    myChain.addBlock(newBlock);
    credit(from, 10);
    fs.writeFileSync(DB_FILE, JSON.stringify(myChain.chain, null, 2));
    broadcastBlock(newBlock);

    console.log(`✅ New post: #${newBlock.index} from ${from}`);
    res.status(201).json({
        message: newBlock.data.message,
        from: newBlock.data.from,
        timestamp: newBlock.timestamp,
        hash: newBlock.hash
    });
});

app.get('/balance/:pubKey', (req, res) => {
    const pubKey = req.params.pubKey;
    const balance = getBalance(pubKey);
    res.json({ balance: balance.toString() });
});

// 🌐 HTTP + WebSocket shared server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// 🌐 WebSocket logic
wss.on('connection', ws => {
    sockets.push(ws);
    console.log('🟢 Peer connected');
    messageHandler(ws);
    ws.send(JSON.stringify({ type: 'CHAIN', chain: myChain.chain }));
});

// 🔁 Periodic gossip
setInterval(broadcastChain, 5000);

// 🚀 Start server
server.listen(HTTP_PORT, () => {
    console.log(`🚀 Server running at http://localhost:${HTTP_PORT}`);
});