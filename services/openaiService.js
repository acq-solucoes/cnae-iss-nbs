const OPENAI_KEY = import.meta.env.VITE_OPENAI_KEY;

/**
 * Usa a OpenAI para interpretar o texto e sugerir códigos CNAE
 */
export async function interpretActivity(text) {
    if (!text || text.length < 3) return [];

    const prompt = `Você é um Assistente Tributário Inteligente de elite.
O usuário descreveu uma atividade econômica ou intenção de negócio: "${text}".
Seu objetivo é identificar os 3 códigos CNAE mais prováveis que se enquadram legalmente nesta descrição.

Regras de Resposta:
1. Analise o sentido semântico e jurídico da frase.
2. Seja preciso e evite generalismos se a descrição for detalhada.
3. Retorne APENAS um array JSON puro (sem markdown) no seguinte formato:
[{"codigo": "6201501", "justificativa": "Explicação técnica sucinta e contábil", "confianca": 95}]

Retorne apenas o array JSON.`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini", // Modelo superior ao 3.5, mantendo custo-benefício
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1 // Mais determinístico
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Erro na API da OpenAI");
        }

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
