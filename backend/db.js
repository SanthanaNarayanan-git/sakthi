const sql = require("mssql");

require('dotenv').config();

const config = {
  user: process.env.DB_USER || "appuser",
  password: process.env.DB_PASSWORD || "AppUser@123",
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_DATABASE || "FormDb",
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

sql.connect(config)
  .then(() => console.log("✅ MSSQL Connected"))
  .catch(err => console.error("❌ DB Error:", err));

module.exports = sql;
