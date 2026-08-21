import axios from "axios";

let accessToken = null;
let expiry = null;
let isFetching = false;

export const getAirwallexToken = async () => {
  // ✅ reuse valid token
  if (accessToken && expiry && Date.now() < expiry) {
    return accessToken;
  }

  // ✅ prevent duplicate calls
  if (isFetching) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!isFetching) {
          clearInterval(interval);
          resolve(accessToken);
        }
      }, 50);
    });
  }

  try {
    isFetching = true;

    const res = await axios.post(
      `${process.env.AIRWALLEX_BASE_URL}/api/v1/authentication/login`,
      {},
      {
        headers: {
          "x-client-id": process.env.AIRWALLEX_CLIENT_ID,
          "x-api-key": process.env.AIRWALLEX_API_KEY,
          "x-login-as": process.env.CONNECTED_ACCOUNT_ID,
        },
      }
    );

    accessToken = res.data.token;

    // expire slightly early (safe buffer)
    expiry = Date.now() + 25 * 60 * 1000;

    return accessToken;
  } catch (err) {
    console.error("❌ Airwallex Auth Error", err.response?.data || err.message);
    throw err;
  } finally {
    isFetching = false;
  }
};