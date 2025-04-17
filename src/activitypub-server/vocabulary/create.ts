import type {Activity} from "./activity.ts";
import {Context} from "./context.ts";
import type {APObject} from "./ap-object.ts";
import typia from "typia";
import {generateDeterministicUuid} from "../../lib/utils.ts";

export class Create implements Activity<'Create'>{
    public readonly id: string;
    public readonly type = 'Create';
    public readonly '@context' = [
        Context.Default,
    ];

    public readonly published: string;

    constructor(
        public readonly object: APObject<string>,
        public readonly actor: string,
        public readonly to: string,
    ) {
        this.published = new Date().toISOString();
        this.id = `${typia.assert(process.env.APP_URL)}/ap/activity/${generateDeterministicUuid(object.id, object.type, to, 'Create')}`;
    }
}
