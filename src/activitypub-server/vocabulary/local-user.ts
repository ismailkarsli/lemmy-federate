import type {Actor} from "./actor.ts";
import {PublicKey} from "./public-key.ts";
import typia from "typia";
import {Context} from "./context.ts";

export class LocalUser implements Actor<'Service'> {
    public readonly id = `${typia.assert(process.env.APP_URL)}/ap/u/bot`;

    public readonly type = 'Service';
    public readonly preferredUsername = 'bot';
    public readonly displayName = 'Lemmy Federate Bot';
    public readonly description = 'This bot is used for sending private messages with the code to log in to Lemmy Federate. Texting it is pointless, its inbox ignores all messages.';

    public readonly inbox = `${this.id}/inbox`;
    public readonly outbox = `${this.id}/outbox`;
    public readonly followers = `${this.id}/followers`;
    public readonly following = `${this.id}/following`;

    public readonly publicKey: PublicKey;

    // todo image?

    public readonly '@context' = [
        Context.Default,
        Context.Security,
    ];

    constructor(
        publicKeyPem: string,
    ) {
        this.publicKey = new PublicKey(
            `${this.id}#main-key`,
            this.id,
            publicKeyPem,
        )
    }
}
