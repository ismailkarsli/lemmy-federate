export class PublicKey {
    constructor(
        public readonly id: string,
        public readonly owner: string,
        public readonly publicKeyPem: string,
    ) {
    }
}
