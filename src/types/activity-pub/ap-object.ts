import type {ContextValue} from "./context.ts";
import type {Mention} from "./mention.ts";

export interface APObject<TType extends string> {
    id: string;
    type: TType;
    '@context'?: ContextValue;
    description?: string;
    attributedTo?: string;
    to?: string;
    mediaType?: string;
    published?: string;
    content?: string;
    tag?: Mention[];
}
