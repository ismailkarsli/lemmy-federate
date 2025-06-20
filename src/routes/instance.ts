import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import * as z from "zod/v4";
import { resetSubscriptions } from "../lib/federation-utils.ts";
import { InstanceSchema, prisma } from "../lib/prisma.ts";
import { isGenericAP } from "../lib/utils.ts";
import { protectedProcedure, publicProcedure, router } from "../trpc.ts";

const FindArgsSchema = z.object({
	search: z.string().optional(),
	take: z.number().min(1).max(100).optional(),
	skip: z.number().min(0).optional(),
	enabledOnly: z.boolean().optional(),
	software: z.string().nullable().optional(),
});

export const instanceRouter = router({
	get: protectedProcedure.query(async ({ ctx }) => {
		const instance = await prisma.instance.findFirst({
			where: {
				host: ctx.instance.sub,
			},
			include: {
				allowed: { select: { id: true, host: true } },
				blocked: { select: { id: true, host: true } },
			},
			omit: { client_id: false, client_secret: false },
		});

		return instance;
	}),
	update: protectedProcedure
		.input(InstanceSchema)
		.mutation(async ({ input, ctx }) => {
			const instance = await prisma.instance.findFirst({
				where: { host: ctx.instance.sub, id: input.id },
			});
			if (!instance) throw new TRPCError({ code: "NOT_FOUND" });
			const isGeneric = isGenericAP(instance.software);
			const updated = await prisma.instance.update({
				where: {
					host: ctx.instance.sub,
					id: input.id,
				},
				data: {
					enabled: input.enabled,
					nsfw: input.nsfw,
					auto_add: input.auto_add,
					fediseer: input.fediseer,
					client_id: input.client_id || null,
					client_secret: input.client_secret || null,
					mode: input.mode,
					software: input.software,
					cross_software: input.cross_software,
					...(isGeneric
						? {
								auto_add: false,
								cross_software: true,
								mode: "SEED",
								nsfw: "BLOCK",
								fediseer: "NONE",
							}
						: {}),
				},
				omit: { client_id: false, client_secret: false },
			});

			if (input.enabled === false) {
				await prisma.community.deleteMany({
					where: {
						instance,
					},
				});
			}

			// soft reset subscriptions to re-check with up to date settings.
			resetSubscriptions(updated, { soft: true });

			return updated;
		}),
	find: publicProcedure
		.input(z.optional(FindArgsSchema))
		.query(async ({ input }) => {
			const where: Prisma.InstanceWhereInput = {};
			if (input?.enabledOnly) {
				where.enabled = true;
			}
			if (input?.search) {
				where.host = { contains: input.search };
			}
			if (input?.software) {
				where.software = input.software || undefined;
			}
			const [instances, total, softwares] = await prisma.$transaction([
				prisma.instance.findMany({
					select: {
						id: true,
						host: true,
						enabled: true,
						auto_add: true,
						software: true,
					},
					skip: input?.skip,
					take: input?.take,
					orderBy: [{ enabled: "desc" }, { id: "asc" }],
					where,
				}),
				prisma.instance.count(),
				prisma.instance.findMany({
					distinct: ["software"],
					select: { software: true },
				}),
			]);
			return {
				instances,
				total,
				softwares: softwares.map((s) => s.software),
			};
		}),
	resetSubscriptions: protectedProcedure.query(async ({ ctx }) => {
		const instance = await prisma.instance.findFirst({
			where: {
				host: ctx.instance.sub,
			},
			omit: { client_id: false, client_secret: false },
		});

		if (!instance) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Instance not found",
			});
		}

		resetSubscriptions(instance);

		return {
			message: "Started resetting subscriptions. This may take a while.",
		};
	}),
	allowed: router({
		add: protectedProcedure
			.input(z.object({ instanceId: z.number() }))
			.mutation(async ({ ctx, input }) => {
				const instance = await prisma.instance.update({
					where: {
						host: ctx.instance.sub,
					},
					data: {
						allowed: {
							connect: {
								id: input.instanceId,
							},
						},
					},
					omit: { client_id: false, client_secret: false },
				});

				// soft reset subscriptions to re-check with up to date settings.
				resetSubscriptions(instance, { soft: true });

				return {
					message: "Instance added to allowed list",
				};
			}),
		delete: protectedProcedure
			.input(z.object({ instanceId: z.number() }))
			.mutation(async ({ ctx, input }) => {
				const instance = await prisma.instance.update({
					where: {
						host: ctx.instance.sub,
					},
					data: {
						allowed: {
							disconnect: {
								id: input.instanceId,
							},
						},
					},
					omit: { client_id: false, client_secret: false },
				});

				// soft reset subscriptions to re-check with up to date settings.
				resetSubscriptions(instance, { soft: true });

				return {
					message: "Instance removed from allowed list",
				};
			}),
	}),
	blocked: router({
		add: protectedProcedure
			.input(z.object({ instanceId: z.number() }))
			.mutation(async ({ ctx, input }) => {
				const instance = await prisma.instance.update({
					where: {
						host: ctx.instance.sub,
					},
					data: {
						blocked: {
							connect: {
								id: input.instanceId,
							},
						},
					},
					omit: { client_id: false, client_secret: false },
				});

				// soft reset subscriptions to re-check with up to date settings.
				resetSubscriptions(instance, { soft: true });

				return {
					message: "Instance added to blocked list",
				};
			}),
		delete: protectedProcedure
			.input(z.object({ instanceId: z.number() }))
			.mutation(async ({ ctx, input }) => {
				const instance = await prisma.instance.update({
					where: {
						host: ctx.instance.sub,
					},
					data: {
						blocked: {
							disconnect: {
								id: input.instanceId,
							},
						},
					},
					omit: { client_id: false, client_secret: false },
				});

				// soft reset subscriptions to re-check with up to date settings.
				resetSubscriptions(instance, { soft: true });

				return {
					message: "Instance removed from blocked list",
				};
			}),
	}),
});
