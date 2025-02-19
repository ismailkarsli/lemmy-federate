import type {APObject} from "./ap-object.ts";
import {Context} from "./context.ts";

interface Collection<TType extends 'Collection' | 'OrderedCollection', TItemType extends APObject<string>> extends APObject<TType> {
    totalItems: number;
    items?: TItemType[];
    orderedItems?: TItemType[];
}

export class UnorderedCollection<TItem extends APObject<string>> implements Collection<'Collection', TItem> {
    public readonly type = 'Collection';
    public readonly totalItems: number;
    public readonly '@context' = [
        Context.Default,
    ];

    constructor(
        public readonly id: string,
        public readonly items: TItem[],
    ) {
        this.totalItems = items.length;
    }
}

export class OrderedCollection<TItem extends APObject<string>> implements Collection<'OrderedCollection', TItem> {
    public readonly type = 'OrderedCollection';
    public readonly totalItems: number;
    public readonly '@context' = [
        Context.Default,
    ];

    constructor(
        public readonly id: string,
        public readonly orderedItems: TItem[],
    ) {
        this.totalItems = orderedItems.length;
    }
}
