const express = require("express");
const router = express.Router();

router.use(function (err, req, res, next) {
  if (err.name === "UnauthorizedError") {
    res.status(401).send("Unauthorized");
  }
});

let routings = [require("./auth")];

for (const routing of routings) {
  routing(router);
}

module.exports = router;
