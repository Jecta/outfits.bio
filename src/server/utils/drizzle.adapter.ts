import type { Adapter, AdapterUser } from "next-auth/adapters";
import type { DbClient, Schema } from "../db";
import { and, eq } from "drizzle-orm";

export function PlanetScaleAdapter(
  client: DbClient,
  { users, sessions, verificationTokens, accounts }: Schema
): Adapter {
  return {
    createUser: async (data) => {
      const id = crypto.randomUUID();

      await client.insert(users).values({ ...data, id });

      return (
        client
          .select()
          .from(users)
          .where(eq(users.id, id))
          .then((res) => res[0]!) ?? null
      );
    },
    getUser: async (data) => {
      return (
        client
          .select()
          .from(users)
          .where(eq(users.id, data))
          .then((res) => res[0] ?? null) ?? null
      );
    },
    getUserByEmail: async (data) => {
      return (
        client
          .select()
          .from(users)
          .where(eq(users.email, data))
          .then((res) => res[0] ?? null) ?? null
      );
    },
    createSession: async (data) => {
      await client.insert(sessions).values(data);

      return (
        client
          .select()
          .from(sessions)
          .where(eq(sessions.sessionToken, data.sessionToken))
          .then((res) => res[0]!) ?? null
      );
    },
    getSessionAndUser: async (data) => {
      return (
        client
          .select({
            session: sessions,
            user: users,
          })
          .from(sessions)
          .where(eq(sessions.sessionToken, data))
          .innerJoin(users, eq(users.id, sessions.userId))
          .then((res) => res[0] ?? null) ?? null
      );
    },
    updateUser: async (data) => {
      if (!data.id) {
        throw new Error("No user id.");
      }

      await client.update(users).set(data).where(eq(users.id, data.id));

      return client
        .select()
        .from(users)
        .where(eq(users.id, data.id))
        .then((res) => res[0]!);
    },
    updateSession: async (data) => {
      await client
        .update(sessions)
        .set(data)
        .where(eq(sessions.sessionToken, data.sessionToken));

      return client
        .select()
        .from(sessions)
        .where(eq(sessions.sessionToken, data.sessionToken))
        .then((res) => res[0]);
    },
    linkAccount: async (rawAccount) => {
      await client
        .insert(accounts)
        .values(rawAccount)
        .then((res) => res.rows[0]);
    },
    getUserByAccount: async (account) => {
      const dbAccount = await client
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.providerAccountId, account.providerAccountId),
            eq(accounts.provider, account.provider)
          )
        )
        .leftJoin(users, eq(accounts.userId, users.id))
        .then((res) => res[0]);

      return dbAccount?.users ?? null;
    },
    deleteSession: async (sessionToken) => {
      await client
        .delete(sessions)
        .where(eq(sessions.sessionToken, sessionToken));
    },
    createVerificationToken: async (token) => {
      await client.insert(verificationTokens).values(token);

      return client
        .select()
        .from(verificationTokens)
        .where(eq(verificationTokens.identifier, token.identifier))
        .then((res) => res[0]);
    },
    useVerificationToken: async (token) => {
      try {
        const deletedToken =
          (await client
            .select()
            .from(verificationTokens)
            .where(
              and(
                eq(verificationTokens.identifier, token.identifier),
                eq(verificationTokens.token, token.token)
              )
            )
            .then((res) => res[0])) ?? null;

        await client
          .delete(verificationTokens)
          .where(
            and(
              eq(verificationTokens.identifier, token.identifier),
              eq(verificationTokens.token, token.token)
            )
          );

        return deletedToken;
      } catch (err) {
        throw new Error("No verification token found.");
      }
    },
    deleteUser: async (id) => {
      await Promise.all([
        client.delete(users).where(eq(users.id, id)),
        client.delete(sessions).where(eq(sessions.userId, id)),
        client.delete(accounts).where(eq(accounts.userId, id)),
      ]);

      return null;
    },
    unlinkAccount: async (account) => {
      await client
        .delete(accounts)
        .where(
          and(
            eq(accounts.providerAccountId, account.providerAccountId),
            eq(accounts.provider, account.provider)
          )
        );

      return undefined;
    },
  };
}