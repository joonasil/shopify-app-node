import Shopify, { ApiVersion } from "@shopify/shopify-api";
import fs from "fs";
import path from "path";

const shop = require("../handlers/shop");
const TOP_LEVEL_OAUTH_COOKIE = "shopify_top_level_oauth";
const USE_ONLINE_TOKENS = true;
const ACTIVE_SHOPIFY_SHOPS = {};

// Simple helper to replace values in an HTML file in the views folder. If you're using multiple server-side rendered
// pages, you might want to consider adding a proper view renderer to your project.
function renderView(file, vars) {
  let content = fs.readFileSync(
    path.join(__dirname, "../views", `${file}.html`),
    {
      encoding: "utf-8",
    }
  );

  Object.keys(vars).forEach((key) => {
    const regexp = new RegExp(`{{ ${key} }}`, "g");
    content = content.replace(regexp, vars[key] || "");
  });

  return content;
}

module.exports = (router) => {
  /**
   * Create top level auth cookie for admin front???
   */
  router.get("/auth/toplevel", async (req, res) => {
    console.log("Toplevel auth??");
    res.cookie(TOP_LEVEL_OAUTH_COOKIE, "1", {
      signed: true,
      httpOnly: true,
      /* sameSite: "strict", */
    });

    res.set("Content-Type", "text/html");

    res.send(
      renderView("top_level", {
        apiKey: Shopify.Context.API_KEY,
        hostName: Shopify.Context.HOST_NAME,
        shop: req.query.shop,
      })
    );
  });

  /**
   * Handle authentication when user installs the app
   */
  router.get("/auth", async (req, res) => {
    console.log("Online token auth");
    if (!req.signedCookies.shopify_top_level_oauth) {
      res.redirect(`/auth/toplevel?shop=${req.query.shop}`);
      return;
    }

    const redirectUrl = await Shopify.Auth.beginAuth(
      req,
      res,
      req.query.shop,
      "/auth/callback",
      USE_ONLINE_TOKENS
    );

    res.redirect(redirectUrl);
  });

  /**
   * Installation authentication callback
   */
  router.get("/auth/callback", async (req, res) => {
    try {
      const session = await Shopify.Auth.validateAuthCallback(
        req,
        res,
        req.query
      );

      const host = req.query.host;

      ACTIVE_SHOPIFY_SHOPS[session.shop] = session.scope;

      const response = await Shopify.Webhooks.Registry.register({
        shop: session.shop,
        accessToken: session.accessToken,
        topic: "APP_UNINSTALLED",
        path: "/webhooks",
      });

      if (!response["APP_UNINSTALLED"].success) {
        console.log(
          `Failed to register APP_UNINSTALLED webhook: ${response.result}`
        );
      }

      // Redirect to offline auth
      res.redirect(`/auth/offline?shop=${req.query.shop}`);
    } catch (e) {
      switch (true) {
        case e instanceof Shopify.Errors.InvalidOAuthError:
          res.status(400);
          res.send(e.message);
          break;
        case e instanceof Shopify.Errors.CookieNotFound:
        case e instanceof Shopify.Errors.SessionNotFound:
          // This is likely because the OAuth session cookie expired before the merchant approved the request
          res.redirect(`/auth?shop=${req.query.shop}`);
          break;
        default:
          res.status(500);
          res.send(e.message);
          break;
      }
    }
  });

  /**
   * Create offline auth token
   */
  router.get("/auth/offline", async (req, res) => {
    //First check if offline token exist for shop:

    const redirectUrl = await Shopify.Auth.beginAuth(
      req,
      res,
      req.query.shop,
      "/auth/offline/callback",
      false
    );

    res.redirect(redirectUrl);
  });

  /**
   * Offline auth token callback
   */
  router.get("/auth/offline/callback", async (req, res) => {
    console.log("Offline token callback!");
    try {
      const offline = await Shopify.Auth.validateAuthCallback(
        req,
        res,
        req.query
      );

      console.log("Offline token: " + JSON.stringify(offline));

      const host = req.query.host;
      ACTIVE_SHOPIFY_SHOPS[offline.shop] = offline.scope;

      // Redirect to app with shop parameter upon auth
      res.redirect(`/?shop=${offline.shop}&host=${host}`);
    } catch (e) {
      switch (true) {
        case e instanceof Shopify.Errors.InvalidOAuthError:
          res.status(400);
          res.send(e.message);
          break;
        case e instanceof Shopify.Errors.CookieNotFound:
        case e instanceof Shopify.Errors.SessionNotFound:
          // This is likely because the OAuth session cookie expired before the merchant approved the request
          res.redirect(`/auth?shop=${req.query.shop}`);
          break;
        default:
          res.status(500);
          res.send(e.message);
          break;
      }
    }
  });
};
