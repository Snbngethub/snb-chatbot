exports.handler = async function(event, context) {
    // --- THE CORS VIP PASS (Allows Wix to connect) ---
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    // Browser pre-flight check
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers: headers, body: "OK" };
    }

    if (event.httpMethod !== "POST") {
        return { statusCode: 200, headers: headers, body: JSON.stringify({ reply: "Method Not Allowed" }) };
    }

    try {
        const body = JSON.parse(event.body);
        const userMessage = body.prompt;

        if (!userMessage) return { statusCode: 200, headers: headers, body: JSON.stringify({ reply: "Prompt is required" }) };

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return { statusCode: 200, headers: headers, body: JSON.stringify({ reply: "Error: Netlify GEMINI_API_KEY is missing." }) };
        }

        // --- FETCH THE BRAIN FROM FIREBASE ---
        let knowledgeBaseText = "";
        try {
            const firebaseUrl = `https://firestore.googleapis.com/v1/projects/snbnchatbot/databases/(default)/documents/snbn_data/brain`;
            const firestoreResponse = await fetch(firebaseUrl);
            const firestoreData = await firestoreResponse.json();
            
            if (firestoreData.fields) {
                for (const fieldName in firestoreData.fields) {
                    knowledgeBaseText += `${fieldName.replace(/_/g, ' ')}:\n${firestoreData.fields[fieldName].stringValue}\n\n`;
                }
            }
        } catch (dbError) {
            console.error("Could not fetch database:", dbError);
        }
        // -----------------------------------------------

        // AUTO-DETECT AVAILABLE MODEL
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const listResponse = await fetch(listUrl);
        const listData = await listResponse.json();
        
        let targetModelName = 'gemini-1.5-flash'; // fallback
        
        if (listData.models) {
            const availableModels = listData.models.map(m => m.name.replace('models/', ''));
            if (availableModels.includes('gemini-1.5-flash')) targetModelName = 'gemini-1.5-flash';
            else if (availableModels.includes('gemini-1.5-pro')) targetModelName = 'gemini-1.5-pro';
            else if (availableModels.includes('gemini-pro')) targetModelName = 'gemini-pro';
            else {
                const validModel = listData.models.find(m => 
                    m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')
                );
                if (validModel) targetModelName = validModel.name.replace('models/', '');
            }
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModelName}:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [{ text: `System Instruction: You are a helpful customer support assistant for Sisters & Brothers Network (SNBN).

Here is your official Knowledge Base. You MUST use this information to answer questions:
--- START KNOWLEDGE BASE ---
${knowledgeBaseText}
--- END KNOWLEDGE BASE ---

Only use the information provided in the Knowledge Base above. If a user asks a question not covered by the Knowledge Base, politely let them know you don't have that information and direct them to email info@snbnetwork.com. Keep your answers concise, helpful, and polite. Acknowledge this.` }]
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

        if (!response.ok) {
            return { statusCode: 200, headers: headers, body: JSON.stringify({ reply: `API Error (${targetModelName}): ${data.error?.message || response.statusText}` }) };
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";
        return { statusCode: 200, headers: headers, body: JSON.stringify({ reply: reply }) };

    } catch (error) {
        return { statusCode: 200, headers: headers, body: JSON.stringify({ reply: `Server Error: ${error.message}` }) };
    }
};
