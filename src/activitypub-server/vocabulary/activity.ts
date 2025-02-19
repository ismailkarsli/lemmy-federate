import type {APObject} from "./ap-object.ts";

export interface Activity<T extends string> extends APObject<T> {
    actor: string;
    object: APObject<string>;
}
