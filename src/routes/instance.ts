import { TRPCError } from "@trpc/server";
import * as z from "zod/v4";
import { resetSubscriptions } from "../lib/federation-utils.ts";
import { MbinClient } from "../lib/mbin.ts";
import { InstanceSchema, prisma } from "../lib/prisma.ts";
import { isGenericAP } from "../lib/utils.ts";
import { protectedProcedure, publicProcedure, router } from "../trpc.ts";

const FindArgsSchema = z.object({
	take: z.number().min(1).max(100).optional(),
	skip: z.number().min(0).optional(),
	enabledOnly: z.boolean().optional(),
});

export const instanceRouter = router({
	get: protectedProcedure.query(async ({ ctx }) => {
		const instance = await prisma.instance.findFirst({
			where: {
				host: ctx.user.instance,
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
				where: { host: ctx.user.instance, id: input.id },
			});
			if (!instance) throw new TRPCError({ code: "NOT_FOUND" });
			const isGeneric = isGenericAP(instance.software);
			const updated = await prisma.instance.update({
				where: {
					host: ctx.user.instance,
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
			const skip = input?.skip
				? Number.parseInt(input.skip.toString())
				: undefined;
			const take = input?.take
				? Number.parseInt(input.take.toString())
				: undefined;
			const [instances, total] = await prisma.$transaction([
				prisma.instance.findMany({
					select: {
						id: true,
						host: true,
						enabled: true,
						auto_add: true,
						software: true,
					},
					skip,
					take,
					orderBy: [{ enabled: "desc" }, { id: "asc" }],
					where: input?.enabledOnly ? { enabled: true } : undefined,
				}),
				prisma.instance.count(),
			]);
			return {
				instances,
				total,
			};
		}),
	createOauthClient: protectedProcedure.mutation(async ({ ctx }) => {
		const instance = await prisma.instance.findFirst({
			where: { host: ctx.user.instance },
			omit: { client_id: false, client_secret: false },
		});
		if (!instance) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Instance not found",
			});
		}
		if (instance.software !== "mbin") {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Only Mbin instances can create OAuth client",
			});
		}

		const oauthClient = await MbinClient.getMbinOauthClient(instance.host);
		await prisma.instance.update({
			where: { id: instance.id },
			data: {
				client_id: oauthClient.identifier,
				client_secret: oauthClient.secret,
			},
		});

		return { message: "OAuth client successfuly created." };
	}),
	resetSubscriptions: protectedProcedure.query(async ({ ctx }) => {
		const instance = await prisma.instance.findFirst({
			where: {
				host: ctx.user.instance,
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
						host: ctx.user.instance,
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
						host: ctx.user.instance,
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
						host: ctx.user.instance,
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
						host: ctx.user.instance,
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
