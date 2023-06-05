import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { env } from "~/env.mjs";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { posts, users } from "~/server/db";

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PostType } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export const postTypeSchema = z.object({
  type: z.enum([
    PostType.HOODIE,
    PostType.OUTFIT,
    PostType.PANTS,
    PostType.SHIRT,
    PostType.SHOES,
    PostType.WATCH,
  ]),
});

export const idSchema = z.object({
  id: z.string(),
});

export const postSchema = postTypeSchema.merge(idSchema);

export const postRouter = createTRPCRouter({
  createPost: protectedProcedure
    .input(postTypeSchema)
    .mutation(async ({ input, ctx }) => {
      const s3 = new S3Client({
        region: env.AWS_REGION,
        endpoint: env.AWS_ENDPOINT,
      });

      const imageId = `${ctx.session.user.id}-${Date.now()}`;

      let res: string;

      try {
        res = await getSignedUrl(
          s3,
          new PutObjectCommand({
            Bucket: "outfits",
            Key: `${ctx.session.user.id}/${imageId}.png`,
            ContentType: "image/png",
          }),
          {
            expiresIn: 30,
          }
        );
      } catch (error) {
        console.error(error);

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid image!",
        });
      }

      const post = await ctx.db.insert(posts).values({
        id: crypto.randomUUID(),
        image: imageId,
        type: input.type,
        userId: ctx.session.user.id,
      });

      if (!post.rowsAffected) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create post!",
        });
      }

      await ctx.db
        .update(users)
        .set({
          ...(input.type === PostType.OUTFIT && {
            outfitPostCount: sql`${users.outfitPostCount} + 1`,
          }),
          ...(input.type === PostType.HOODIE && {
            hoodiePostCount: sql`${users.hoodiePostCount} + 1`,
          }),
          ...(input.type === PostType.SHIRT && {
            shirtPostCount: sql`${users.shirtPostCount} + 1`,
          }),
          ...(input.type === PostType.PANTS && {
            pantsPostCount: sql`${users.pantsPostCount} + 1`,
          }),
          ...(input.type === PostType.SHOES && {
            shoesPostCount: sql`${users.shoesPostCount} + 1`,
          }),
          ...(input.type === PostType.WATCH && {
            watchPostCount: sql`${users.watchPostCount} + 1`,
          }),
          imageCount: sql`${users.imageCount} + 1`,
        })
        .where(eq(users.id, ctx.session.user.id));

      return {
        ...post,
        res,
      };
    }),

  deletePost: protectedProcedure
    .input(idSchema)
    .mutation(async ({ input, ctx }) => {
      const { id } = input;

      const s3 = new S3Client({
        region: env.AWS_REGION,
        endpoint: env.AWS_ENDPOINT,
      });

      const postResult = await ctx.db
        .select({
          id: posts.id,
          type: posts.type,
          image: posts.image,
        })
        .from(posts)
        .where(and(eq(posts.id, id), eq(posts.userId, ctx.session.user.id)))
        .then((res) => res[0]);

      if (!postResult)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid post!",
        });

      s3.send(
        new DeleteObjectCommand({
          Bucket: "outfits",
          Key: `${ctx.session.user.id}/${postResult.image}.png`,
        })
      );

      await ctx.db
        .update(users)
        .set({
          ...(postResult.type === PostType.OUTFIT && {
            outfitPostCount: sql`${users.outfitPostCount} - 1`,
          }),
          ...(postResult.type === PostType.HOODIE && {
            hoodiePostCount: sql`${users.hoodiePostCount} - 1`,
          }),
          ...(postResult.type === PostType.SHIRT && {
            shirtPostCount: sql`${users.shirtPostCount} - 1`,
          }),
          ...(postResult.type === PostType.PANTS && {
            pantsPostCount: sql`${users.pantsPostCount} - 1`,
          }),
          ...(postResult.type === PostType.SHOES && {
            shoesPostCount: sql`${users.shoesPostCount} - 1`,
          }),
          ...(postResult.type === PostType.WATCH && {
            watchPostCount: sql`${users.watchPostCount} - 1`,
          }),
          imageCount: sql`${users.imageCount} - 1`,
        })
        .where(eq(users.id, ctx.session.user.id));

      await ctx.db
        .delete(posts)
        .where(and(eq(posts.id, id), eq(posts.userId, ctx.session.user.id)));

      return true;
    }),

  getPostsAllTypes: publicProcedure
    .input(idSchema)
    .query(async ({ ctx, input }) => {
      const { id } = input;

      const postsResult = await ctx.db
        .select({
          id: posts.id,
          type: posts.type,
          image: posts.image,
          createdAt: posts.createdAt,
        })
        .from(posts)
        .where(eq(posts.userId, id))
        .limit(20)
        .orderBy(desc(posts.createdAt));

      return postsResult;
    }),
});
