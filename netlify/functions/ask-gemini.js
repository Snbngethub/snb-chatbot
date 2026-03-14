exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        // Parse the user's message from the frontend
        const body = JSON.parse(event.body);
        const userMessage = body.prompt;

        if (!userMessage) {
            return { statusCode: 400, body: JSON.stringify({ error: "No message provided" }) };
        }

        // Securely grab the API key from Netlify's environment variables
        const apiKey = process.env.GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        // Send the request to Gemini
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
        
        // Extract the text reply from Gemini
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";

        // Send the reply back to your frontend website
        return {
            statusCode: 200,
            body: JSON.stringify({ reply: reply })
        };

    } catch (error) {
        console.error("Backend Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to communicate with Gemini" })
        };
    }
};