import {
    getRedisSubscriber,
    subscriptionChannelTypes,
    subscriptionChannels,
} from '@/utils/redis';
import { type DBChatMessage, DBChatMessageSchema } from '@repo/db';
import { type DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { publicProcedure } from '../../trpc';

export const ListenNewMessagesSchema = z.object({
    chatID: z.string(),
    latestMessageSeenID: z.string().optional(),
});

export const listenNewMessages = publicProcedure
    .input(ListenNewMessagesSchema)
    .subscription(async function* ({ input, ctx }) {
        const channelName = subscriptionChannels.chatMessages(input.chatID);

        if (input.latestMessageSeenID) {
            const messages = await getMessagesSinceLatestSeen(
                input.chatID,
                input.latestMessageSeenID,
                ctx.dbPool,
            );
            for (const message of messages) {
                yield message;
            }
        }

        const redisSubscriber = getRedisSubscriber();
        await redisSubscriber.subscribe(channelName);

        try {
            for await (const message of createRedisMessageGenerator(
                redisSubscriber,
            )) {
                yield message;
            }
        } finally {
            await redisSubscriber.unsubscribe(channelName);
            redisSubscriber.quit();
        }
    });

async function* createRedisMessageGenerator(
    subClient: ReturnType<typeof getRedisSubscriber>,
) {
    while (true) {
        yield new Promise<DBChatMessage>((resolve, reject) => {
            subClient.once('message', (_, message) => {
                // We should only be subscribed to one channel
                resolve(
                    subscriptionChannelTypes.chatMessages.parse(message)
                        .message,
                );
            });
            subClient.once('error', reject);
        });
    }
}

async function getMessagesSinceLatestSeen(
    chatID: string,
    latestMessageSeenID: string,
    pool: DatabasePool,
): Promise<readonly DBChatMessage[]> {
    return pool.any(sql.type(DBChatMessageSchema)`
        SELECT *
        FROM "ChatMessage"
        WHERE id > ${latestMessageSeenID}
            AND "chatID" = ${chatID}
        ORDER BY id ASC
    `);
}
