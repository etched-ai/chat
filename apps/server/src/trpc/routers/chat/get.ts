import { type DBChat, DBChatSchema } from '@repo/db';
import { sql } from 'slonik';
import { z } from 'zod';
import { authedProcedure } from '../../trpc';

export const get = authedProcedure
    .input(z.object({ id: z.string().ulid() }))
    .query(async ({ input, ctx }) => {
        return (await ctx.dbPool.one(sql.type(DBChatSchema)`
            SELECT
                id,
                "userID",
                "previewName",
                "createdAt",
                "updatedAt"
            FROM "Chat"
            WHERE id = ${input.id}
        `)) as DBChat;
    });
