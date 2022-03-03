import "@babel/polyfill";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import webpack from "webpack";
import webpackDevMiddleware from "webpack-dev-middleware";
import Shopify, { ApiVersion } from "@shopify/shopify-api";
import verifyRequest from "./middlewares/verifyRequest";

dotenv.config();

const routes = require("./routes");
const port = parseInt(process.env.PORT, 10) || 8081;
const webpackConfig = require("../webpack.config.js");
const __DEV__ = process.env.NODE_ENV !== "production";
const sequelize = require("./handlers/database.js");

Shopify.Context.initialize({
  API_KEY: process.env.SHOPIFY_API_KEY,
  API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
  SCOPES: process.env.SCOPES.split(","),
  HOST_NAME: process.env.HOST.replace(/https:\/\//, ""),
  API_VERSION: ApiVersion.Unstable,
  IS_EMBEDDED_APP: true,
  // This should be replaced with your preferred storage strategy
  SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
});

// Storing the currently active shops in memory will force them to re-login when your server restarts. You should
// persist this object in your app.
const ACTIVE_SHOPIFY_SHOPS = {};
Shopify.Webhooks.Registry.addHandler("APP_UNINSTALLED", {
  path: "/webhooks",
  webhookHandler: async (topic, shop, body) =>
    delete ACTIVE_SHOPIFY_SHOPS[shop],
});

// Simple helper to replace values in an HTML file in the views folder. If you're using multiple server-side rendered
// pages, you might want to consider adding a proper view renderer to your project.
function renderView(file, vars) {
  let content = fs.readFileSync(path.join(__dirname, "views", `${file}.html`), {
    encoding: "utf-8",
  });

  Object.keys(vars).forEach((key) => {
    const regexp = new RegExp(`{{ ${key} }}`, "g");
    content = content.replace(regexp, vars[key] || "");
  });

  return content;
}

async function createAppServer() {
  const express = require("express");
  const app = express();
  const compiler = webpack(webpackConfig);
  const cookieParser = require("cookie-parser");
  app.use(cookieParser(Shopify.Context.API_SECRET_KEY));
  app.use(
    webpackDevMiddleware(compiler, {
      publicPath: webpackConfig.output.publicPath,
    })
  );

  //handle routes
  app.use("/", routes);

  app.post("/webhooks", async (req, res) => {
    try {
      await Shopify.Webhooks.Registry.process(req, res);
      console.log(`Webhook processed, returned status code 200`);
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`);
    }
  });

  app.post(
    "/graphql",
    verifyRequest({ isOnline: true, returnHeader: true }),
    async (req, res, next) => {
      await Shopify.Utils.graphqlProxy(req, res);
    }
  );

  if (!__DEV__) {
    app.use("/static", express.static(path.join(__dirname, "../dist")));
  }

  app.get("*", async (req, res) => {
    const shop = req.query.shop;

    // This shop hasn't been seen yet, go through OAuth to create a session
    if (ACTIVE_SHOPIFY_SHOPS[shop] === undefined) {
      res.redirect(`/auth?shop=${shop}`);
    } else {
      res.set("Content-Type", "text/html");
      if (__DEV__) {
        res.sendFile(path.resolve(webpackConfig.output.path, "index.html"));
      } else {
        res.sendFile(__dirname, "../dist/client/index.js");
      }
    }
  });

  //Initialize database
  try {
    await sequelize.authenticate();
    console.log("Database connection OK!");
  } catch (error) {
    console.log("Unable to connect to the database:");
    console.log(error.message);
    process.exit(1);
  }

  try {
    await sequelize.sync({ alter: true });
    console.log("Models synchronized!");
  } catch (error) {
    console.log("Failed to synchronize models:");
    console.log(error.message);
    process.exit(1);
  }

  //Start the node express app
  app.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
}

createAppServer();
