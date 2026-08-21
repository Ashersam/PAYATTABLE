import { getRaptorToken } from "../services/raptor.service.js";

export const testRaptorToken = async (req, res) => {
  try {
    const result = await getRaptorToken();

    res.json({
      success: true,
      token_type: result.tokenType,
      has_token: !!result.accessToken,
    });
  } catch (err) {
    console.error("❌ Raptor token error:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};