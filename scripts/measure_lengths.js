const fs = require('fs');
const readline = require('readline');

async function measure(path) {
    const fileStream = fs.createReadStream(path);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const totalLens = [];
    const promptLens = [];
    const responseLens = [];

    for await (const line of rl) {
        if (!line.trim()) continue;
        const rec = JSON.parse(line);
        const msgs = rec.messages || [];
        const system = msgs.find(m => m.role === 'system')?.content || '';
        const user = msgs.find(m => m.role === 'user')?.content || '';
        const assistant = msgs.find(m => m.role === 'assistant')?.content || '';

        const promptText = `<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n`;
        const responseText = `${assistant}<|im_end|>\n`;
        const fullText = promptText + responseText;

        // In Qwen, ~3.5 chars per token for code/text mix, or count words/chars
        // Let's record char length and approximate BPE token count (using whitespace + punct regex)
        // Qwen tokenizer regex splits on words, digits, punct
        const approxTokens = (s) => (s.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]+/gu) || []).length;

        promptLens.push(approxTokens(promptText));
        responseLens.push(approxTokens(responseText));
        totalLens.push(approxTokens(fullText));
    }

    function stats(arr) {
        arr.sort((a, b) => a - b);
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const p50 = arr[Math.floor(arr.length * 0.5)];
        const p95 = arr[Math.floor(arr.length * 0.95)];
        const p99 = arr[Math.floor(arr.length * 0.99)];
        const max = arr[arr.length - 1];
        return { mean: mean.toFixed(1), p50, p95, p99, max, count: arr.length };
    }

    console.log(`=== Stats for ${path} ===`);
    console.log('Prompt tokens (approx):', stats(promptLens));
    console.log('Response tokens (approx):', stats(responseLens));
    console.log('Total tokens (approx):', stats(totalLens));
}

async function run() {
    await measure('cpp-grader-data-v1-1/train_sft.jsonl');
    await measure('cpp-grader-data-v1-1/val_sft.jsonl');
}

run();

