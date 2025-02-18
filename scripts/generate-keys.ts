#!/usr/bin/env bun
import * as crypto from 'crypto';
import * as fs from 'fs';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096, // Key size in bits (2048 is standard)
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

fs.writeFileSync(__dirname + '/../keys/private.pem', privateKey);
fs.writeFileSync(__dirname + '/../keys/public.pem', publicKey);

console.log("RSA key pair generated!");
