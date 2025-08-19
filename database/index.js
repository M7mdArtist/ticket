import { Sequelize } from 'sequelize';
import config from '../src/config.js';

const db = new Sequelize(config.database.name, config.database.user, config.database.pass, {
  dialect: 'mysql',
  host: config.database.host,
});

export default db;
