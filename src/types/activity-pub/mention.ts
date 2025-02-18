import type {ContextValue} from "./context.ts";
import {Context} from "./context.ts";

export class Mention {
    public readonly type = 'Mention';
    public readonly '@context': ContextValue = [
        Context.Default,
        {
            Hashtag: Context.Hashtag,
        },
    ];

    constructor(
        public readonly name: string,
        public readonly href: string,
    ) {
        if (!name.startsWith('@')) {
            throw new Error("The mention must start with a @");
        }
    }
}
