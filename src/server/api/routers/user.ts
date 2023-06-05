import { eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "~/env.mjs";
import {
  editProfileSchema,
  getProfileSchema,
  userSchema,
} from "~/schemas/user.schema";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { users } from "~/server/db";

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Prisma, User } from "@prisma/client";
import { TRPCError } from "@trpc/server";

const badUsernames = ["login", "settings", "onboarding"];

export const userRouter = createTRPCRouter({
  profileExists: publicProcedure
    .input(getProfileSchema)
    .query(async ({ input, ctx }) => {
      const { username } = input;

      const userResult = await ctx.db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.username, username))
        .then((res) => res[0] ?? null);

      return !!userResult;
    }),

  getMe: protectedProcedure.query(async ({ ctx }) => {
    const userResult = await ctx.db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        image: users.image,
        onboarded: users.onboarded,
      })
      .from(users)
      .where(eq(users.id, ctx.session.user.id))
      .then((res) => res[0] ?? null);

    if (!userResult) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    if (!userResult.onboarded) {
      await ctx.db
        .update(users)
        .set({ onboarded: true })
        .where(eq(users.id, ctx.session.user.id));
    }

    return userResult;
  }),

  getProfile: publicProcedure
    .input(getProfileSchema)
    .query(async ({ input, ctx }) => {
      const { username } = input;

      const userResult = await ctx.db
        .select({
          id: users.id,
          username: users.username,
          name: users.name,
          image: users.image,
          hoodiePostCount: users.hoodiePostCount,
          outfitPostCount: users.outfitPostCount,
          shirtPostCount: users.shirtPostCount,
          shoesPostCount: users.shoesPostCount,
          pantsPostCount: users.pantsPostCount,
          watchPostCount: users.watchPostCount,
          imageCount: users.imageCount,
          likeCount: users.likeCount,
        })
        .from(users)
        .where(eq(users.username, username))
        .then((res) => res[0] ?? null);

      if (!userResult) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return userResult;
    }),

  editProfile: protectedProcedure
    .input(editProfileSchema)
    .mutation(async ({ input, ctx }) => {
      const { name, username } = input;

      if (
        username &&
        (badUsernames.includes(username) ||
          username.startsWith("api/") ||
          username.length < 3)
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid username",
        });

      try {
        await ctx.db
          .update(users)
          .set({
            ...(name ? { name } : {}),
            ...(username ? { username } : {}),
          })
          .where(eq(users.id, ctx.session.user.id));

        return { username };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2002") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Email or username already exists",
            });
          }
        }
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong",
      });
    }),

  setImage: protectedProcedure.mutation(async ({ input, ctx }) => {
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

    s3.send(
      new DeleteObjectCommand({
        Bucket: "outfits",
        Key: `${ctx.session.user.id}/${ctx.session.user.image}.png`,
      })
    );

    await ctx.db
      .update(users)
      .set({ image: imageId })
      .where(eq(users.id, ctx.session.user.id));

    return res;
  }),

  deleteImage: protectedProcedure.mutation(async ({ ctx }) => {
    const s3 = new S3Client({
      region: env.AWS_REGION,
      endpoint: env.AWS_ENDPOINT,
    });

    await ctx.db
      .update(users)
      .set({ image: null })
      .where(eq(users.id, ctx.session.user.id));

    s3.send(
      new DeleteObjectCommand({
        Bucket: "outfits",
        Key: `${ctx.session.user.id}/${ctx.session.user.image}.png`,
      })
    );

    return true;
  }),
});
