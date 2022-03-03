const { Sequelize } = require("sequelize");

//Creating the sequelize instance
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    logQueryParameters: true,
    logging: false,
    benchmark: true,
    dialectOptions: { decimalNumbers: true },
  }
);

const modelDefiners = [require("../models/shop.model")];

// We define all models according to their files.
for (const modelDefiner of modelDefiners) {
  modelDefiner(sequelize);
}

// We export the sequelize connection instance to be used around our app.
module.exports = sequelize;
