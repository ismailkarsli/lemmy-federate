import type {APObject} from "./ap-object.ts";
import type {ContextValue} from './context.ts'
import {Context} from "./context.ts";
import typia from "typia";
import {generateDeterministicUuid} from "../../lib/utils.ts";

export class ChatMessage implements APObject<'ChatMessage'> {
    public readonly '@context': ContextValue = [
        Context.Default,
        {
            ChatMessage: Context.ChatMessage,
        },
    ];
    public readonly type = 'ChatMessage';

    public readonly id: string;
    public readonly published: string;
    public readonly mediaType = 'text/html';

    constructor(
        public readonly attributedTo: string,
        public readonly to: string,
        public readonly content: string,
    ) {
        this.published = new Date().toISOString();
        this.id = `${typia.assert(process.env.APP_URL)}/ap/activity/${generateDeterministicUuid(this.attributedTo, this.published, this.to, this.content)}`;
    }
}
