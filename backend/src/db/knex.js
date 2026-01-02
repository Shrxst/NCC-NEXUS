import dotenv from "dotenv";
dotenv.config(); 

import knex from "knex";
import config from "../../knexfile.js";

const db = knex({
  client: "pg",
  connection: process.env.POSTGRES_URL,
});

export default db;
