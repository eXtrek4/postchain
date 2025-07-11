const crypto = require('crypto');

class Block {
  constructor(index, timestamp, data, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(this.index + this.timestamp + JSON.stringify(this.data) + this.previousHash)
      .digest('hex');
  }
}

class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
  }

  createGenesisBlock() {
    return new Block(0, "1725000000000", "Genesis Block", "0");
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  addBlock(newBlock) {
    newBlock.previousHash = this.getLatestBlock().hash;
    newBlock.hash = newBlock.calculateHash();

    if (this.isValidNewBlock(newBlock, this.getLatestBlock())) {
      this.chain.push(newBlock);
      const origin = newBlock.data && newBlock.data.message?.includes("Block from Node")
        ? "📥 Received"
        : "⛏️ Mined";
      console.log(`${origin} block #${newBlock.index} with hash ${newBlock.hash}`);
    } else {
      console.log(`❌ Invalid block #${newBlock.index} — rejected.`);
    }
  }

  isValidNewBlock(newBlock, previousBlock) {
    if (previousBlock.index + 1 !== newBlock.index) return false;
    if (previousBlock.hash !== newBlock.previousHash) return false;
    if (newBlock.hash !== newBlock.calculateHash()) return false;
    return true;
  }

  isChainValid() {
    return this.isValidChain(this.chain);
  }

  isValidChain(chain) {
    if (JSON.stringify(chain[0]) !== JSON.stringify(this.createGenesisBlock())) {
      return false;
    }

    for (let i = 1; i < chain.length; i++) {
      const block = chain[i];
      const prev = chain[i - 1];

      if (block.previousHash !== prev.hash) return false;

      const recalculatedHash = crypto
        .createHash('sha256')
        .update(block.index + block.timestamp + JSON.stringify(block.data) + block.previousHash)
        .digest('hex');

      if (block.hash !== recalculatedHash) return false;
    }

    return true;
  }

  replaceChain(newChain) {
    if (newChain.length <= this.chain.length) return;

    if (!this.isValidChain(newChain)) {
      console.log("❌ Received chain is invalid.");
      return;
    }

    console.log("🔄 Replacing current chain with received chain.");
    this.chain = newChain;
  }
}

module.exports = { Block, Blockchain };

