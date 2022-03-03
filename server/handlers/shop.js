const { async } = require("regenerator-runtime");
const db = require("./database");

module.exports = {
  install,
  uninstall,
  getOfflineToken,
};

/**
 * Install new Shopify shop to the app.
 *
 * @param {string} shop The url of the shop
 * @throws {} Some sequelize error
 * @returns {bool} true if shop was successfully added to database
 */
async function install(shop) {
  try {
    await db.models.shop.create({ shop: shop, token: null });
    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Uninstall the app from the given shop
 *
 * @param {string} shop The shop URL
 * @throws {} Some sequelize error
 * @returns {bool} true if shop was successfully added to database
 */
async function uninstall(shop) {
  try {
    await db.models.shop.destroy({
      where: {
        shop: shop,
      },
    });
    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Get the offline OAuth token for the given shop
 *
 * @param {string} shop The shop URL
 * @returns {string} OAuth token
 */
async function getOfflineToken(shop) {
  try {
    const shop_obj = await db.models.shop.findOne({
      where: {
        shop: shop,
      },
    });
    return shop_obj.token;
  } catch (error) {
    throw error;
  }
}
