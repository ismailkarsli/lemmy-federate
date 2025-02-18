export enum Context {
    Default = 'https://www.w3.org/ns/activitystreams',
    Security = 'https://w3id.org/security/v1',
    ChatMessage = 'http://litepub.social/ns#ChatMessage',
}

export type ContextValue = Array<Context | {[key: string]: Context}>;
