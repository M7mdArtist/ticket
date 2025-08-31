import { DataTypes, Model } from 'sequelize';

export default class Ticket extends Model {
  static init(sequelize) {
    return super.init(
      {
        ticketId: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        channelId: {
          type: DataTypes.STRING,
        },
        guildId: {
          type: DataTypes.STRING,
        },
        resolved: {
          type: DataTypes.BOOLEAN,
        },
        ticketMsgId: {
          type: DataTypes.STRING,
        },
        authorId: {
          type: DataTypes.STRING,
        },
        claimed: {
          type: DataTypes.BOOLEAN,
        },
        claimerId: {
          type: DataTypes.STRING,
        },
        logId: {
          type: DataTypes.STRING,
        },
        closeReq: {
          type: DataTypes.BOOLEAN,
        },
      },
      {
        tableName: 'Tickets',
        sequelize,
      }
    );
  }
}
