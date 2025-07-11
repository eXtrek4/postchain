const WebSocket = require('ws');
const WS_PORT = process.env.WS_PORT || 6001;
const peers = process.env.PEERS ? process.env.PEERS.split(',') : [];

const { Block } = require('./blockchain'); // ✅ Import Block class

const MESSAGE_TYPES = {
    chain: 'CHAIN',
    new_block: 'NEW_BLOCK'
};

class P2PServer {
    constructor(blockchain) {
        this.blockchain = blockchain;
        this.sockets = [];
    }

    listen() {
        const server = new WebSocket.Server({ port: WS_PORT });
        server.on('connection', socket => this.connectSocket(socket));

        peers.forEach(peer => {
            const socket = new WebSocket(peer);
            socket.on('open', () => this.connectSocket(socket));
            socket.on('error', err => console.error('❌ Peer connection error:', err));
        });

        console.log(`🔗 P2P WebSocket listening on port ${WS_PORT}`);

        // 🧠 Gossip-style sync every 5 seconds
        setInterval(() => {
            this.sockets.forEach(socket => this.sendChain(socket));
        }, 5000);
    }

    connectSocket(socket) {
        this.sockets.push(socket);
        console.log('🟢 Connected to peer');
        this.messageHandler(socket);
        this.sendChain(socket); // Send chain immediately upon connect
    }

    messageHandler(socket) {
        socket.on('message', message => {
            const data = JSON.parse(message);
            switch (data.type) {
                case MESSAGE_TYPES.chain:
                    this.blockchain.replaceChain(data.chain);
                    break;
                case MESSAGE_TYPES.new_block:
                    const b = data.block;
                    const receivedBlock = new Block(b.index, b.timestamp, b.data, b.previousHash);
                    receivedBlock.hash = b.hash;
                    this.blockchain.addBlock(receivedBlock);
                    console.log(`📥 Received block #${receivedBlock.index} with hash ${receivedBlock.hash}`);
                    break;
            }
        });
    }

    sendChain(socket) {
        socket.send(JSON.stringify({
            type: MESSAGE_TYPES.chain,
            chain: this.blockchain.chain
        }));
    }

    broadcastBlock(block) {
        this.sockets.forEach(socket => {
            socket.send(JSON.stringify({
                type: MESSAGE_TYPES.new_block,
                block: block
            }));
        });
    }
}

module.exports = P2PServer;

