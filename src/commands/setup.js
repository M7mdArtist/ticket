import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import TicketConfig from '../../database/models/TicketConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup the ticket system (server owner only)')
    .addChannelOption(option =>
      option
        .setName('category')
        .setDescription('The category ID for tickets')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    ),
  // .addStringOption(option =>
  //   option.setName('roles').setDescription('Comma-separated role IDs that have access to tickets').setRequired(true)
  // ),

  async execute(interaction, client) {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({
        content: 'Only server owner👑 can use this command',
        ephemeral: true,
      });
    }

    try {
      const categoryId = interaction.options.getChannel('category').id;
      // const roles = interaction.options.getString('roles').split(/,\s*/);

      await interaction.deferReply({ ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle('Ticket')
        .setDescription('Click the button to open a ticket!🎫')
        .setColor('#DBD42B');

      const openButton = new ButtonBuilder().setCustomId('open').setLabel('Open Ticket').setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder().addComponents(openButton);

      const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

      const categoryChannel = client.channels.cache.get(categoryId);

      if (!categoryChannel) {
        throw new Error('Invalid category ID');
      }

      const ticketConfig = TicketConfig.create({
        messageId: msg.id,
        channelId: interaction.channel.id,
        guildId: interaction.guild.id,
        // roles: JSON.stringify(roles),
        parentId: categoryChannel.id,
        deleteTicketsChannel: false,
        logs: false,
      });

      // for (const roleId of roles) {
      //   if (!interaction.guild.roles.cache.get(roleId)) {
      //     console.log(`Role ${roleId} does not exist`);
      //     throw new Error(`Role ${roleId} does not exist`);
      //   }
      // }

      // const roleObjects = [];
      // for (const roleId of roles) {
      //   const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
      //   if (!role) throw new Error(`Role ${roleId} not found`);
      //   roleObjects.push(role);
      // }

      // const ticketConfig = await TicketConfig.create({
      //   messageId: msg.id,
      //   channelId: interaction.channel.id,
      //   guildId: interaction.guild.id,
      //   // roles: JSON.stringify(roles),
      //   parentId: categoryChannel.id,
      //   deleteTicketsChannel: false,
      //   logs: false,
      // });
      console.log(ticketConfig);

      // await fetchMsg.react('🎫');
      await interaction.editReply({ content: 'Ticket system setup complete!\n **Do Not forget to use /addrole**' });
    } catch (err) {
      console.error('Setup error:', err);
      interaction.editReply({ content: `Error during setup: ${err.message}` });
    }
  },
};
