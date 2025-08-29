import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import mysql from 'mysql2/promise';
import config from '../config.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

async function sendUpdateMessage() {
  try {
    const connection = await mysql.createConnection({
      host: config.database.host,
      user: config.database.user,
      password: config.database.pass,
      database: config.database.name,
    });

    const [rows] = await connection.execute('SELECT channelId FROM TicketConfigs LIMIT 1');
    if (!rows.length) {
      console.log('No channel ID found in database.');
      return process.exit();
    }

    const channelId = rows[0].channelId; // <-- correct column

    await client.login(config.bot.token);
    client.once('ready', async () => {
      console.log(`Logged in as ${client.user.tag}`);

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        console.log('Channel not found or bot has no access.');
        return process.exit();
      }

      const updateEmbed = new EmbedBuilder()
        .setTitle('🎉 Ticket Bot Updated!')
        .setDescription(
          `The **Ticket Bot** has just been updated! Use the following commands to configure it:\n` +
            `\`/setup\` - Run this first to set up the bot\n` +
            `\`/delete set\` - Set your delete channel (if you have one)\n` +
            `\`/logs set\` - Set your logs channel (if you have one)`
        )
        .addFields(
          {
            name: '🆕 New Features',
            value: `• Added new slash command! Use \`/ticket transfer\` to transfer it to other admin!`,
          },
          {
            name: '🐞 Bugs & Suggestions',
            value: `If you found bugs or have new feature ideas, DM <@607616907033444363>.`,
          }
        )
        .setColor(0x00ff99)
        .setTimestamp()
        .setFooter({ text: 'Ticket Bot Update' });

      await channel.send({ embeds: [updateEmbed] });
      console.log('Update message sent!');

      await client.destroy();
      await connection.end();
      process.exit();
    });
  } catch (error) {
    console.error('Error sending update message:', error);
    process.exit(1);
  }
}

sendUpdateMessage();
