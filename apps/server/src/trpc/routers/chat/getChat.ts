import { DBChatSchema } from '@repo/db';
import { sql } from 'slonik';
import { z } from 'zod';
import { publicProcedure } from '../../trpc';

export const getChat = publicProcedure
    .input(z.object({ id: z.string().ulid() }))
    .query(async ({ input, ctx }) => {
        return await ctx.dbPool.one(sql.type(DBChatSchema)`
            SELECT
                id,
                "userID",
                "previewName",
                "createdAt",
                "updatedAt"
            FROM "Chat"
            WHERE id = ${input.id}
        `);
    });
