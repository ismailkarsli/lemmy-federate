import type {APObject} from "./ap-object.ts";
import {Context} from "./context.ts";
import type {Mention} from "./mention.ts";
import typia from "typia";
import {generateDeterministicUuid} from "../../lib/utils.ts";

export class Note implements APObject<'Note'> {
    public readonly id: string;
    public readonly '@context' = [
        Context.Default,
    ];
    public readonly type = 'Note';

    public readonly mediaType = 'text/html';
    public readonly published: string;
    public readonly tag: Mention[];

    constructor(
        public readonly attributedTo: string,
        public readonly to: string,
        public readonly content: string,
        mentions: Mention[] = [],
    ) {
        this.published = new Date().toISOString();
        this.tag = mentions;
        this.id = `${typia.assert(process.env.APP_URL)}/ap/activity/${generateDeterministicUuid(this.attributedTo, this.published, this.to, this.tag)}`;
    }
}
