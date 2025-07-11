const fs = require('fs');
const BigNumber = require('bignumber.js');

const DECIMALS = 18;
const INITIAL_SUPPLY = new BigNumber('21000000').multipliedBy(new BigNumber(10).pow(DECIMALS));
const BALANCES_FILE = 'balances.json';

// Load or init balances
let balances = {};
if (fs.existsSync(BALANCES_FILE)) {
    balances = JSON.parse(fs.readFileSync(BALANCES_FILE));
} else {
    fs.writeFileSync(BALANCES_FILE, JSON.stringify(balances, null, 2));
}

// Get balance of a public key
function getBalance(pubKey) {
    const key = pubKey.trim();
    const raw = balances[key] || '0';
    return new BigNumber(raw);
}

// 🟢 Credit tokens to a wallet (was: rewardMiner)
function credit(pubKey, amountPOS) {
    const key = pubKey.trim();
    const current = getBalance(key);
    const amount = new BigNumber(amountPOS).multipliedBy(new BigNumber(10).pow(DECIMALS));
    balances[key] = current.plus(amount).toFixed();
    fs.writeFileSync(BALANCES_FILE, JSON.stringify(balances, null, 2));
}

module.exports = {
    DECIMALS,
    INITIAL_SUPPLY,
    getBalance,
    credit,
};

