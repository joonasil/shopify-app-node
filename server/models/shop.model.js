const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  sequelize.define(
    "Shop",
    {
      // Model attributes are defined here
      shop: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      token: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "shop",
      freezeTableName: true,
      timestamps: false,
      paranoid: false,
    }
  );
};
