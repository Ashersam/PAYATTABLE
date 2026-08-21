import pkg from "pg";
const { Pool } = pkg;

export const db = new Pool({
  user: "postgres",
  host: "localhost",
  database: "scanpay",
  password: "R8pt0r5792",
  port: 5433,
});