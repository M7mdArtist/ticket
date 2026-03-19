import { DataTypes, Model } from 'sequelize';

export default class TicketCategory extends Model {
  static init(sequelize) {
    return super.init(
      {
        guildId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false, // e.g., "General Support"
        },
        description: {
          type: DataTypes.STRING,
          allowNull: true, // e.g., "Click here if you need help"
        },
        emoji: {
          type: DataTypes.STRING,
          allowNull: true, // e.g., "🟢"
        },
        openCategoryId: {
          type: DataTypes.STRING,
          allowNull: false, // Where the ticket opens
        },
        closedCategoryId: {
          type: DataTypes.STRING,
          allowNull: true, // Where the ticket goes when closed
        },
        staffRoles: {
          type: DataTypes.STRING,
          defaultValue: '[]', // Roles allowed to answer this specific type
        },
        logs: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
        logsChannelId: {
          type: DataTypes.STRING,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'TicketCategories',
      },
    );
  }
}
