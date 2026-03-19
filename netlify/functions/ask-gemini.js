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

        // 2. AUTO-DETECT AVAILABLE MODEL (Bulletproof Fix)
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const listResponse = await fetch(listUrl);
        const listData = await listResponse.json();
        
        let targetModelName = 'gemini-1.5-flash'; // fallback
        
        if (listData.models) {
            const availableModels = listData.models.map(m => m.name.replace('models/', ''));
            // Check what models your specific API key has access to
            if (availableModels.includes('gemini-1.5-flash')) targetModelName = 'gemini-1.5-flash';
            else if (availableModels.includes('gemini-1.5-pro')) targetModelName = 'gemini-1.5-pro';
            else if (availableModels.includes('gemini-pro')) targetModelName = 'gemini-pro';
            else {
                // Just grab the first model Google allows this key to use
                const validModel = listData.models.find(m => 
                    m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')
                );
                if (validModel) targetModelName = validModel.name.replace('models/', '');
            }
        }

        // 3. Connect to the auto-detected model
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModelName}:generateContent?key=${apiKey}`;

        // 4. Send request using universal pre-prompt format (Fixes the JSON Payload errors entirely)
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [{ text: "System Instruction: You are a helpful, friendly customer support assistant for Sisters & Brothers Network (SNBNetwork), a platform to find trusted, verified businesses all in one place. Keep your answers concise, helpful, and polite. Acknowledge this." }]
                    },
                    {
                        role: "model",
                        parts: [{ text: "I understand! I am ready to be a friendly and helpful customer support assistant for the Sisters & Brothers Network." }]
                    },
                    {
                        role: "user",
                        parts: [{ text: userMessage }]
                    }
                ]
            })
        });

        const data = await response.json();

        // 5. If Google API rejects it, show the exact error in the chat
        if (!response.ok) {
            return { statusCode: 200, body: JSON.stringify({ reply: `API Error (${targetModelName}): ${data.error?.message || response.statusText}` }) };
        }

        // 6. Send successful reply to frontend
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";
        return { statusCode: 200, body: JSON.stringify({ reply: reply }) };

    } catch (error) {
        // If the server crashes, show the crash report in the chat
        return { statusCode: 200, body: JSON.stringify({ reply: `Server Error: ${error.message}` }) };
    }
};
