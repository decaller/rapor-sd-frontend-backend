export const GET = async ({ request }) => {
  try {
    const response = await fetch(`${import.meta.env.EXPRESS_API_URL}/api/rapor/status`, {
      headers: { 'x-api-key': import.meta.env.API_SECRET_KEY }
    });

    if (!response.ok) throw new Error("Failed to fetch logs");

    const logs = await response.json();
    return new Response(JSON.stringify(logs), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
