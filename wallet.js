const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const pubPath = path.join(__dirname, 'wallet-public.pem');
const privPath = path.join(__dirname, 'wallet-private.pem');

function generateKeys() {
    if (fs.existsSync(pubPath) && fs.existsSync(privPath)) {
        console.log("🔐 Wallet already exists.");
        return;
    }

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
    });

    fs.writeFileSync(pubPath, publicKey.export({ type: 'pkcs1', format: 'pem' }));
    fs.writeFileSync(privPath, privateKey.export({ type: 'pkcs1', format: 'pem' }));
    console.log("✅ Wallet created: public/private keys saved to disk.");
}

function sign(data) {
    const privateKey = fs.readFileSync(privPath, 'utf8');
    const signer = crypto.createSign('SHA256');
    signer.update(data);
    signer.end();
    return signer.sign(privateKey, 'hex');
}

function verify(data, signature, publicKey) {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(data);
    verifier.end();
    return verifier.verify(publicKey, signature, 'hex');
}

function getPublicKey() {
    return fs.readFileSync(pubPath, 'utf8');
}

// generate keys when file is run directly
if (require.main === module) {
    generateKeys();
}

module.exports = {
    generateKeys,
    sign,
    verify,
    getPublicKey
};

