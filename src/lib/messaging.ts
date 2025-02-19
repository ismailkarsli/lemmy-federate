import type {Actor} from "../activitypub-server/vocabulary/actor.ts";
import {Create} from "../activitypub-server/vocabulary/create.ts";
import {ChatMessage} from "../activitypub-server/vocabulary/chat-message.ts";
import {ChatMessageNote} from "../activitypub-server/vocabulary/chat-message-note.ts";

function stringifyActor(actor: string | Actor<string>): string {
    return typeof actor === "string" ? actor : actor.id;
}

export function createMessage(software: string, from: string | Actor<string>, to: Actor<string>, content: string): Create[] {
    const lemmyStyleMessage = createLemmyStyleMessage(from, to, content);
    const mastodonStyleMessage = createMastodonStyleMessage(from, to, content);

    switch (software.toUpperCase()) {
        case "LEMMY":
        case "MBIN":
        case "DCH_BLOG":
            return [lemmyStyleMessage];
        case "MASTODON":
            return [mastodonStyleMessage];
        default:
            return [lemmyStyleMessage, mastodonStyleMessage];
    }
}

export function createLemmyStyleMessage(from: string | Actor<string>, to: string | Actor<string>, content: string): Create {
    const message = new ChatMessage(
        stringifyActor(from),
        stringifyActor(to),
        content,
    );

    return new Create(message, stringifyActor(from), stringifyActor(to));
}

export function createMastodonStyleMessage(from: string | Actor<string>, to: Actor<string>, content: string): Create {
    const message = new ChatMessageNote(
        stringifyActor(from),
        to,
        content,
    );

    return new Create(message, stringifyActor(from), stringifyActor(to));
}
