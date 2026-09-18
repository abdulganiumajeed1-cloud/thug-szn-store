const PRODUCTS = {
  "1": { name: "THUG SZN Logo T-Shirt", priceUSD: 35 },
  "2": { name: "Built Different T-Shirt", priceUSD: 40 },
  "3": { name: "Short-Sleeve Jersey", priceUSD: 55 },
  "4": { name: "Graphic Statue T-Shirt", priceUSD: 45 },
  "5": { name: "Raglan Polo Long Sleeve", priceUSD: 65 },
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { email, name, phone, country, address, cart, callbackUrl } = body;

    if (!email || !name || !phone || !country || !address || !Array.isArray(cart) || !cart.length) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing checkout information." }) };
    }

    const rate = Number(process.env.USD_TO_GHS_RATE);
    if (!Number.isFinite(rate) || rate <= 0) {
      return { statusCode: 500, body: JSON.stringify({ error: "USD_TO_GHS_RATE is not configured in Netlify." }) };
    }

    let totalUSD = 0;
    const items = [];

    for (const item of cart) {
      const product = PRODUCTS[item.productId];
      const quantity = Number(item.quantity);
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid cart." }) };
      }

      const lineUSD = product.priceUSD * quantity;
      totalUSD += lineUSD;
      items.push({
        productId: item.productId,
        name: product.name,
        size: String(item.size || ""),
        quantity,
        unitPriceUSD: product.priceUSD,
        lineTotalUSD: lineUSD,
      });
    }

    const amountGHS = Math.round(totalUSD * rate * 100); // Paystack expects pesewas.
    const reference = `TS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: String(amountGHS),
        currency: "GHS",
        reference,
        callback_url: callbackUrl,
        metadata: JSON.stringify({
          brand: "THUG SZN",
          customer_name: name,
          phone,
          country,
          address,
          total_usd: totalUSD,
          usd_to_ghs_rate: rate,
          total_ghs: amountGHS / 100,
          items,
        }),
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.status) {
      return { statusCode: 502, body: JSON.stringify({ error: data.message || "Paystack initialization failed." }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorization_url: data.data.authorization_url,
        reference: data.data.reference,
        totalUSD,
        totalGHS: amountGHS / 100,
        rate,
      }),
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: "Unable to start payment." }) };
  }
};
