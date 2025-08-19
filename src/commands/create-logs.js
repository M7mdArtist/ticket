import { SlashCommandBuilder, ChannelType, PermissionsBitField } from 'discord.js';
import TicketConfig from '../../database/models/TicketConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('create-logs')
    .setDescription('Creates a logs channel')
    .addChannelOption(option =>
      option
        .setName('category')
        .setDescription('Chose the category to create the logs channel')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    ),

  async execute(interaction, client) {
    try {
      const ticketConfig = await TicketConfig.findOne({ where: { logs: false, guildId: interaction.guild.id } });
      const categoryId = interaction.options.getChannel('category').id;

      if (!ticketConfig) {
        interaction.reply({
          content: 'there is already a logs or system is not configured',
          ephemeral: true,
        });
        return;
      }

      const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles'));
      const isAllowed = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

      if (isAllowed) {
        if (ticketConfig) {
          const logsChannel = await interaction.guild.channels.create({
            name: 'ticket-logs',
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: [
              {
                id: interaction.guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
              },
            ],
          });

          await ticketConfig.update({
            logs: true,
            logsChannelId: logsChannel.id,
          });

          interaction.reply({
            content: `Created a logs channel <#${logsChannel.id}>`,
            ephemeral: true,
          });
        }
      } else {
        interaction.reply({
          content: 'you are not allowed to use this command',
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error('error while creating logs channel', error);
    }
  },
};
