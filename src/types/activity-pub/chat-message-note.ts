import {Note} from "./note.ts";
import {Mention} from "./mention.ts";
import type {Actor} from "./actor.ts";

export class ChatMessageNote extends Note {
    constructor(
        from: string,
        to: Actor<string>,
        content: string,
    ) {
        super(
            from,
            to.id,
            content,
            [
                new Mention(
                    to.preferredUsername,
                    to.id,
                ),
            ]
        );
    }
}
