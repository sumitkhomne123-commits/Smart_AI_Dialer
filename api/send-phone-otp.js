export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const { phone, countryCode, otp } = body || {};
  if (!phone || !otp) {
    return res.status(400).json({ error: "Phone number and OTP code are required." });
  }

  const cleanPhone = String(phone).replace(/\D/g, "");
  let liveDispatched = false;
  let provider = "OTP.dev Global SMS";
  let failureReason = "";

  // 1. Fast2SMS (India Direct SIM Cellular Gateway - Primary)
  const fast2smsKey = (
    process.env.FAST2SMS_API_KEY ||
    "1ZEmvG8hsadYpb5D3FNPiX9MR0xIHQByqocgCjKWOneVLw6USknGRZpa2F1tvVOfwT4BDuXmiJ7HlsyI"
  ).trim();

  if (fast2smsKey) {
    try {
      // Attempt 1: route = 'otp'
      const fRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: fast2smsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: "otp",
          variables_values: String(otp),
          numbers: cleanPhone,
        }),
      });
      const fJson = await fRes.json().catch(() => null);
      console.log("[Fast2SMS OTP Route Response]:", fJson);
      if (fJson && (fJson.return === true || fJson.status_code === 200)) {
        liveDispatched = true;
        provider = "Fast2SMS India Cellular Gateway";
        failureReason = "";
      } else {
        // Attempt 2: route = 'q' (Quick SMS fallback)
        const qRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            authorization: fast2smsKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            route: "q",
            message: `Your Smart AI Dialer verification OTP is ${otp}. Valid for 10 minutes.`,
            language: "english",
            flash: 0,
            numbers: cleanPhone,
          }),
        });
        const qJson = await qRes.json().catch(() => null);
        console.log("[Fast2SMS Q Route Response]:", qJson);
        if (qJson && (qJson.return === true || qJson.status_code === 200)) {
          liveDispatched = true;
          provider = "Fast2SMS India Cellular Gateway";
          failureReason = "";
        } else {
          failureReason = fJson?.message || qJson?.message || "Fast2SMS dispatch failed";
        }
      }
    } catch (err) {
      console.error("[Fast2SMS Error]:", err);
      failureReason = err.message || "Fast2SMS error";
    }
  }

  // 2. OTP.dev Global SMS Gateway (Secondary Gateway)
  if (!liveDispatched) {
    const otpDevKey = (process.env.OTP_DEV_KEY || "b76ad11ef66e89dc6482b7078ac1bce3").trim();
    const otpDevSender = (process.env.OTP_DEV_SENDER || "3612d841-3d1a-49bc-a6e1-5e13e54eb6a0").trim();
    const otpDevTemplate = (process.env.OTP_DEV_TEMPLATE || "c2c25ca9-d8da-4430-8ffc-3ef096c773d8").trim();

    if (otpDevKey) {
      try {
        const dialCode = (countryCode || "+91").replace(/\+/g, "");
        const fullPhone = `${dialCode}${cleanPhone}`;
        const oRes = await fetch("https://api.otp.dev/v1/verifications", {
          method: "POST",
          headers: {
            "X-OTP-Key": otpDevKey,
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            data: {
              channel: "sms",
              sender: otpDevSender,
              phone: fullPhone,
              template: otpDevTemplate,
              code: String(otp),
              code_length: String(otp).length,
            },
          }),
        });
        const oJson = await oRes.json().catch(() => null);
        console.log("[OTP.dev SMS Response]:", oRes.status, oJson);
        if (oRes.status === 200 || oRes.status === 201 || oJson?.data?.message_id) {
          liveDispatched = true;
          provider = "OTP.dev Global SMS Gateway";
          failureReason = "";
        }
      } catch (err) {
        console.error("[OTP.dev Error]:", err);
      }
    }
  }

  // 2. Twilio Global SMS Gateway
  if (!liveDispatched && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    try {
      const auth = "Basic " + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
      const bodyParams = new URLSearchParams();
      bodyParams.append("To", `${countryCode || "+91"}${cleanPhone}`);
      bodyParams.append("From", process.env.TWILIO_PHONE_NUMBER);
      bodyParams.append("Body", `Your Tata AI Dialer login verification code is ${otp}. Valid for 10 minutes.`);

      const twRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: auth,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: bodyParams.toString(),
        }
      );
      const twJson = await twRes.json().catch(() => null);
      if (twJson && twJson.sid) {
        liveDispatched = true;
        provider = "Twilio Global Carrier";
      }
    } catch (err) {
      console.error("[Twilio Error]:", err);
    }
  }

  return res.status(200).json({
    success: true,
    liveDispatched,
    provider,
    otp,
    phone: cleanPhone,
    failureReason,
    message: liveDispatched
      ? `Real SMS dispatched via ${provider} to ${cleanPhone}.`
      : failureReason || `SMS verification code generated.`,
  });
}
