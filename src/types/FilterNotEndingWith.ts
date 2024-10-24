export type FilterNotEndingWith<
	Set,
	Needle extends string,
> = Set extends `${infer _X}${Needle}` ? never : Set;
