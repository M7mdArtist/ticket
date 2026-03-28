import {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import Ticket from '../database/models/Ticket.js';
import TicketConfig from '../database/models/TicketConfig.js'; // Added this
import TicketCategory from '../database/models/TicketCategory.js';

export default {
  customId: 'ticket_panel_select',
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      await interaction.message.edit({ components: interaction.message.components }).catch(() => null);

      const selectedCategoryName = interaction.values[0];
      const guild = interaction.guild;

      const categoryData = await TicketCategory.findOne({ where: { guildId: guild.id, name: selectedCategoryName } });
      const ticketConfig = await TicketConfig.findOne({
        where: { guildId: interaction.guild.id, type: 'Dynamic-Panel' },
      });

      if (!categoryData) return interaction.editReply({ content: '❌ Category not found.' });

      // 1. FETCH STAFF ROLES
      const staffRoles = JSON.parse(ticketConfig?.roles || '[]');

      // 2. BUILD PERMISSIONS ARRAY
      const permissions = [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
          ],
        },
        {
          id: interaction.client.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
        },
      ];

      // 👇 THE FIX: Add every staff role to the permissions list
      staffRoles.forEach(roleId => {
        permissions.push({
          id: roleId,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
          ],
        });
      });

      // 3. CREATE THE CHANNEL WITH STAFF ACCESS
      const channel = await guild.channels.create({
        name: `${categoryData.emoji || '🎫'}${selectedCategoryName.toLowerCase()}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: categoryData.openCategoryId,
        permissionOverwrites: permissions, // Use our dynamic list
      });

      // ... rest of your code (Ticket.create, Embed, Logging, etc.)
      const ticket = await Ticket.create({
        channelId: channel.id,
        guildId: guild.id,
        authorId: interaction.user.id,
        type: selectedCategoryName,
        resolved: false,
      });

      const ticketEmbed = new EmbedBuilder()
        .setTitle(`🎫 Ticket | ${selectedCategoryName}`)
        .setDescription(`Hello <@${interaction.user.id}>, your ticket has been created!`)
        .addFields(
          { name: '👤 Opened by', value: `<@${interaction.user.id}>`, inline: true },
          { name: '🆔 Ticket ID', value: `<#${channel.id}>`, inline: true },
          { name: '📂 Category', value: `${categoryData.emoji || ''} ${selectedCategoryName}`, inline: true },
          { name: '✅ Status', value: 'Opened', inline: true },
          { name: '🟡 Claimed by', value: 'Not claimed', inline: true },
          { name: '📅 Date Created', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
        )
        .setColor('#77B255');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close').setLabel('🔒 Close').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('claim').setLabel('🙋‍♂️ Claim').setStyle(ButtonStyle.Success),
      );

      const msg = await channel.send({
        content: `<@${interaction.user.id}> | Staff`,
        embeds: [ticketEmbed],
        components: [row],
      });
      await ticket.update({ ticketMsgId: msg.id });

      // Logging (If enabled)
      if (categoryData.logs && categoryData.logsChannelId) {
        const logChannel = await guild.channels.fetch(categoryData.logsChannelId).catch(() => null);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('📝 Ticket Created')
            .setColor('#77B255')
            .addFields(
              { name: '👤 User:', value: `<@${interaction.user.id}>`, inline: false },
              { name: '📂 Category:', value: selectedCategoryName, inline: true },
              { name: '🆔 Channel:', value: `<#${channel.id}>`, inline: true },
            );
          const logMsg = await logChannel.send({ embeds: [logEmbed] });
          await ticket.update({ logId: logMsg.id });
        }
      }

      await interaction.editReply({ content: `✅ Ticket created: <#${channel.id}>` });
    } catch (error) {
      console.error('❌ Ticket Open Error:', error);
      await interaction.editReply({ content: '❌ Something went wrong.' });
    }
  },
};
