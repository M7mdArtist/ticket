import { DataTypes, Model } from 'sequelize';

export default class TicketConfig extends Model {
  static init(sequelize) {
    return super.init(
      {
        messageId: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        channelId: {
          type: DataTypes.STRING,
        },
        guildId: {
          type: DataTypes.STRING,
        },
        deleteTicketsChannel: {
          type: DataTypes.BOOLEAN,
        },
        deleteTicketsChannelId: {
          type: DataTypes.STRING,
        },
        roles: {
          type: DataTypes.STRING,
        },
        parentId: {
          type: DataTypes.STRING,
        },
        logs: {
          type: DataTypes.BOOLEAN,
        },
        logsChannelId: {
          type: DataTypes.STRING,
        },
      },
      {
        tableName: 'TicketConfigs',
        sequelize,
      }
    );
  }
}
