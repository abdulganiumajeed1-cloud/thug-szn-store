exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const reference = event.queryStringParameters?.reference;
  if (!reference) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing reference." }) };
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });

    const data = await response.json();
    if (!response.ok || !data.status) {
      return { statusCode: 502, body: JSON.stringify({ error: data.message || "Verification failed." }) };
    }

    const tx = data.data;
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paid: tx.status === "success",
        status: tx.status,
        reference: tx.reference,
        amountGHS: Number(tx.amount || 0) / 100,
        currency: tx.currency,
        customer: tx.customer?.email || "",
        metadata: tx.metadata || null,
      }),
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: "Unable to verify payment." }) };
  }
};
