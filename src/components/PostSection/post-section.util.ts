import { AppRouter } from "~/server/api/root";
import { Post, PostType } from "~/server/db";
import { api } from "~/utils/api.util";
import { handleErrors } from "~/utils/handle-errors.util";

import { inferRouterOutputs } from "@trpc/server";

type RouterOutput = inferRouterOutputs<AppRouter>;
// TODO: Find a better way to grab a type from the second param of ctx.post.getPostsAllTypes.setData
type PartialPost = Omit<Omit<Post, "userId">, "updatedAt">;
type Context = ReturnType<(typeof api)["useContext"]>;

export interface PostSectionProps {
  profileData?: RouterOutput["user"]["getProfile"];
  postsData?: RouterOutput["post"]["getPostsAllTypes"];
  type: PostType;
}

/**
 * This isn't SOLID, I'm sorry Uncle Bob :(
 * @param type PostType
 * @returns string
 */
export const getPostTypeName = (type: PostType): string => {
  switch (type) {
    case PostType.OUTFIT:
      return "Outfits";
    case PostType.HOODIE:
      return "Hoodies";
    case PostType.SHIRT:
      return "Shirts";
    case PostType.PANTS:
      return "Pants";
    case PostType.SHOES:
      return "Shoes";
    case PostType.WATCH:
      return "Watches";
  }
};

/**
 * This isn't SOLID, I'm sorry Uncle Bob :(
 * @param type PostType
 * @param profileData RouterOutput["user"]["getProfile"]
 * @returns number
 */
export const getPostTypeCount = (
  type: PostType,
  profileData?: RouterOutput["user"]["getProfile"]
): number => {
  switch (type) {
    case PostType.OUTFIT:
      return profileData?.outfitPostCount ?? 0;
    case PostType.HOODIE:
      return profileData?.hoodiePostCount ?? 0;
    case PostType.SHIRT:
      return profileData?.shirtPostCount ?? 0;
    case PostType.PANTS:
      return profileData?.pantsPostCount ?? 0;
    case PostType.SHOES:
      return profileData?.shoesPostCount ?? 0;
    case PostType.WATCH:
      return profileData?.watchPostCount ?? 0;
  }
};

/**
 * Optimistically updates the previously fetched array of posts using the updateData function
 * @param ctx Context (from api.useContext)
 * @param updateData (old: PartialPost[] | undefined) => PartialPost[] | undefined
 * @param userId string
 * @returns { prevData: PartialPost[] | undefined }
 */
export const onMutate = async (
  ctx: Context,
  updateData: (old: PartialPost[] | undefined) => PartialPost[] | undefined,
  userId?: string
): Promise<{ prevData: PartialPost[] | undefined }> => {
  await ctx.post.getPostsAllTypes.invalidate();

  const prevData = ctx.post.getPostsAllTypes.getData();

  ctx.post.getPostsAllTypes.setData({ id: userId ?? "" }, updateData);

  return { prevData };
};

/**
 * Rolls back the optimistic update if the mutation fails
 * @param ctx Context (from api.useContext)
 * @param err any
 * @param context { prevData: PartialPost[] | undefined }
 * @param message string
 * @param userId string
 * @returns void
 */
export const onError = async (
  ctx: Context,
  err: any,
  context: any,
  message: string,
  userId?: string
) => {
  ctx.post.getPostsAllTypes.setData({ id: userId ?? "" }, context!.prevData);
  handleErrors({ e: err, message });
};

/**
 * Refetches the posts if the mutation succeeds
 * @param ctx Context (from api.useContext)
 * @param username string
 * @returns void
 */
export const onSettled = async (ctx: Context, username?: string | null) => {
  ctx.post.getPostsAllTypes.invalidate();
  ctx.user.getProfile.invalidate({ username: username ?? "" });
};
