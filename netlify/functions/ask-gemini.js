exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 200, body: JSON.stringify({ reply: "Method Not Allowed" }) };
    }

    try {
        const body = JSON.parse(event.body);
        const userMessage = body.prompt;

        if (!userMessage) return { statusCode: 200, body: JSON.stringify({ reply: "Prompt is required" }) };

        // 1. Get the API Key
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return { statusCode: 200, body: JSON.stringify({ reply: "Error: Netlify GEMINI_API_KEY is missing." }) };
        }

        // 2. Connect to the PUBLIC Gemini 1.5 model
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: userMessage }] }],
                systemInstruction: { 
                    parts: [{ 
                        text: "You are a helpful, friendly customer support assistant for Sisters & Brothers Network (SNBNetwork), a platform to find trusted, verified businesses all in one place. Keep your answers concise, helpful, and polite." 
                    }] 
                }
            })
        });

        const data = await response.json();

        // 3. If Google API rejects it, show the exact error in the chat
        if (!response.ok) {
            return { statusCode: 200, body: JSON.stringify({ reply: `API Error: ${data.error?.message || response.statusText}` }) };
        }

        // 4. Send successful reply to frontend
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";
        return { statusCode: 200, body: JSON.stringify({ reply: reply }) };

    } catch (error) {
        // If the server crashes, show the crash report in the chat
        return { statusCode: 200, body: JSON.stringify({ reply: `Server Error: ${error.message}` }) };
    }
};
