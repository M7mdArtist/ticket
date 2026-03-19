import {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import Ticket from '../../database/models/Ticket.js';
import TicketCategory from '../../database/models/TicketCategory.js';

export default {
  customId: 'ticket_panel_select',
  async execute(interaction) {
    try {
      // 1. Acknowledge the interaction privately
      await interaction.deferReply({ ephemeral: true });

      // 2. THE UI RESET: Clear the selection on the dropdown menu
      // This allows the user to click the same option again immediately.
      await interaction.message
        .edit({
          components: interaction.message.components,
        })
        .catch(() => null);

      const selectedCategoryName = interaction.values[0];
      const guild = interaction.guild;

      // 3. Fetch specific Category Data from DB
      const categoryData = await TicketCategory.findOne({
        where: { guildId: guild.id, name: selectedCategoryName },
      });

      if (!categoryData) {
        return interaction.editReply({
          content: `❌ Error: Category **${selectedCategoryName}** was not found. Please re-run \`/category add\`.`,
        });
      }

      // 4. DATABASE CHECK: Prevent duplicate active tickets
      const activeTicket = await Ticket.findOne({
        where: {
          guildId: guild.id,
          authorId: interaction.user.id,
          type: selectedCategoryName,
          resolved: false,
        },
      });

      if (activeTicket) {
        return interaction.editReply({
          content: `❌ You already have an active **${selectedCategoryName}** ticket here: <#${activeTicket.channelId}>`,
        });
      }

      // 5. CREATE THE TICKET CHANNEL
      const channel = await guild.channels.create({
        name: `${categoryData.emoji || '🎫'}${selectedCategoryName.toLowerCase()}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: categoryData.openCategoryId,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
        ],
      });

      // 6. SAVE RECORD TO DATABASE
      const ticket = await Ticket.create({
        channelId: channel.id,
        guildId: guild.id,
        authorId: interaction.user.id,
        type: selectedCategoryName,
        resolved: false,
      });

      // 7. BUILD THE PREMIUM WELCOME EMBED
      const ticketEmbed = new EmbedBuilder()
        .setTitle(`🎫 Ticket | ${selectedCategoryName}`)
        .setDescription(
          `Hello <@${interaction.user.id}>, your ticket has been created! Our staff will be with you shortly.`,
        )
        .addFields(
          { name: '👤 Opened by', value: `<@${interaction.user.id}>`, inline: true },
          { name: '🆔 Ticket ID', value: `<#${channel.id}>`, inline: true },
          { name: '📂 Category', value: `${categoryData.emoji || ''} ${selectedCategoryName}`, inline: true },
          { name: '✅ Status', value: 'Opened', inline: true },
          { name: '🟡 Claimed by', value: 'Not claimed', inline: true },
          { name: '📅 Date Created', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
          {
            name: '📋 Instructions',
            value:
              '```yaml\n• Describe your issue clearly\n• Provide screenshots if possible\n• Be patient for staff to reply```\n' +
              '• Click the **Close** button below to lock this ticket.\n' +
              '• To see who can help you, use `/role list`',
          },
        )
        .setColor('#77B255')
        .setFooter({ text: 'Ticket System • Use buttons below to manage' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close').setLabel('🔒 Close').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('claim').setLabel('🙋‍♂️ Claim').setStyle(ButtonStyle.Success),
      );

      const msg = await channel.send({
        content: `<@${interaction.user.id}> | Staff`,
        embeds: [ticketEmbed],
        components: [row],
      });

      // Store the main message ID for future edits (Claims/Closure)
      await ticket.update({ ticketMsgId: msg.id });

      // 8. SEND DYNAMIC LOG MESSAGE
      if (categoryData.logs && categoryData.logsChannelId) {
        const logChannel = await guild.channels.fetch(categoryData.logsChannelId).catch(() => null);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('📝 Ticket Created')
            .setColor('#77B255')
            .addFields(
              { name: '👤 User:', value: `<@${interaction.user.id}> (${interaction.user.id})`, inline: false },
              { name: '📂 Category:', value: selectedCategoryName, inline: true },
              { name: '🆔 Channel:', value: `<#${channel.id}>`, inline: true },
              { name: '✅ Status:', value: 'Opened', inline: true },
              { name: '🟡 Claimed by:', value: 'Not claimed', inline: false },
            )
            .setTimestamp();

          const logMsg = await logChannel.send({ embeds: [logEmbed] });
          // Save the log message ID so claim.js and close.js can edit it
          await ticket.update({ logId: logMsg.id });
        }
      }

      // 9. FINAL SUCCESS RESPONSE
      await interaction.editReply({ content: `✅ Ticket created: <#${channel.id}>` });
    } catch (error) {
      console.error('❌ Ticket Open Error:', error);
      await interaction.editReply({
        content: '❌ Something went wrong while opening your ticket. Please contact an admin.',
      });
    }
  },
};
