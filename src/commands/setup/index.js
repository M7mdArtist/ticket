import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import TicketConfig from '../../../database/models/TicketConfig.js';
import reg from './utils/reg.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup the ticket system (server owner only)')
    .addChannelOption(option =>
      option
        .setName('category')
        .setDescription('The category ID for tickets')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true),
    )
    .addStringOption(option =>
      option.setName('type').setDescription('The type of the ticket (e.g., "Support")').setRequired(false),
    ),

  async execute(interaction) {
    // 1. Check Permissions
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({
        content: 'Only the server owner 👑 can use this command.',
        ephemeral: true,
      });
    }

    try {
      // Defer instantly to prevent interaction timeout
      await interaction.deferReply({ ephemeral: true });

      const categoryChannel = interaction.options.getChannel('category');
      const type = interaction.options.getString('type') || 'Ticket';

      // 2. Setup the UI
      const embed = new EmbedBuilder()
        .setTitle(`${type} System`)
        .setDescription(`Click the button below to open a ${type} ticket! 🎫`)
        .setColor('#DBD42B');

      const openButton = new ButtonBuilder().setCustomId('open').setLabel('Open Ticket').setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder().addComponents(openButton);

      // Send the panel to the channel
      const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

      // 3. Save Configuration to Database (Added the missing 'await' here!)
      await TicketConfig.create({
        messageId: msg.id,
        channelId: interaction.channel.id,
        guildId: interaction.guild.id,
        parentId: categoryChannel.id,
        deleteTicketsChannel: false,
        logs: false,
        type: type,
        roles: '[]', // Initialize with an empty array so JSON.parse doesn't break later
      });

      let replyMsg = `✅ **${type} System** deployed successfully!\n⏳ Registering **old tickets** in **${categoryChannel.name}**...`;
      await interaction.editReply({ content: replyMsg });

      // 4. Register Old Tickets (Pass the 'type' to the reg utility)
      await reg.execute(interaction, categoryChannel, type, replyMsg);
    } catch (err) {
      console.error('Setup error:', err);
      await interaction.editReply({ content: `❌ Error during setup: ${err.message}` }).catch(() => null);
    }
  },
};
