import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import mysql from 'mysql2/promise';
import config from '../config.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

async function sendUpdateMessage() {
  try {
    const db = await mysql.createConnection({
      host: config.database.host,
      user: config.database.user,
      password: config.database.pass,
      database: config.database.name,
    });

    // ✅ Get all guilds & channels from DB
    const [rows] = await db.execute('SELECT guildId, channelId FROM TicketConfigs');

    // fallback channel if DB has nothing
    const fallbackChannelId = '1409495052526420089';

    await client.login(config.bot.token);

    client.once('ready', async () => {
      console.log(`Logged in as ${client.user.tag}`);

      const updateEmbed = new EmbedBuilder()
        .setTitle('🚀 Bot Update Completed!')
        .setDescription(
          `Hello everyone,\n\n` +
            `The update has been **successfully applied** 🎉\n\n` +
            `⚠️ **Important:**\n` +
            `All previously opened tickets have **lost their functions** (cannot be claimed, unclaimed, closed, or have transcripts created).\n\n` +
            `🛠️ **What you need to do now:**\n` +
            `- Re-setup the bot using:\n` +
            `   • \`/role\` (add, remove, list)\n` +
            `   • \`/setup\`\n` +
            `   • \`/logs set\`\n` +
            `   • \`/delete set\`\n\n` +
            `🐞 **If you find any bugs or issues, please contact the developer directly.**\n\n` +
            `➡️ DM <@607616907033444363> for help.`
        )
        .setColor(0xff0000) // 🔴 red for urgency
        .setFooter({ text: 'Thank you for using our bot 💙' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('💬 Contact Developer')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.com/users/607616907033444363')
      );

      for (const { guildId, channelId } of rows) {
        try {
          const guild = await client.guilds.fetch(guildId).catch(() => null);
          if (!guild) {
            console.warn(`⚠️ Guild ${guildId} not found, skipping...`);
            continue;
          }

          const channel = await guild.channels.fetch(channelId || fallbackChannelId).catch(() => null);
          if (!channel) {
            console.warn(`⚠️ Channel not found in guild ${guildId}, skipping...`);
            continue;
          }

          const ownerId = guild.ownerId;

          await channel.send({ content: `<@${ownerId}>`, embeds: [updateEmbed], components: [row] });
          console.log(`✅ Update message sent to guild: ${guild.name} (${guildId})`);
        } catch (err) {
          console.error(`❌ Error sending message to guild ${guildId}:`, err);
        }
      }

      await db.end();
      client.destroy();
      process.exit(0);
    });
  } catch (error) {
    console.error('Error sending update message:', error);
    process.exit(1);
  }
}

sendUpdateMessage();
