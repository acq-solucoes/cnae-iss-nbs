const OPENAI_KEY = import.meta.env.VITE_OPENAI_KEY;

/**
 * Usa a OpenAI para interpretar o texto e sugerir códigos CNAE
 */
export async function interpretActivity(text) {
    if (!text || text.length < 3) return [];

    const prompt = `Você é um especialista tributário e contador brasileiro. 
O usuário descreveu a atividade econômica da seguinte forma: "${text}".
Seu objetivo é identificar os 3 códigos CNAE (Subclasse) mais prováveis.

Regras:
1. Analise o sentido semântico da frase.
2. Retorne APENAS um array JSON puro (sem markdown) no seguinte formato:
[{"cnae": "6201501", "motivo": "Breve explicação técnica por que este código se aplica"}]

Retorne apenas o JSON.`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo", // Modelo rápido e eficiente para esta tarefa
                messages: [{ role: "user", content: prompt }],
                temperature: 0.3
            })
        });

        if (!response.ok) throw new Error("Erro na API da OpenAI");

        const data = await response.json();
        const content = data.choices[0].message.content.trim();

        // Tenta limpar possíveis marcações de markdown se a IA retornar
        const jsonStr = content.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Erro OpenAI:", e);
        return [];
    }
}
