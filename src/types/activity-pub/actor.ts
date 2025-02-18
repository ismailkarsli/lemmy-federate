import type {APObject} from "./ap-object.ts";
import type {PublicKey} from "./public-key.ts";

export interface Actor<T extends string> extends APObject<T> {
    publicKey: PublicKey;
    preferredUsername: string;
    inbox: string;
    outbox: string;
    displayName: string;
    followers: string;
    following: string;
}
