const fs = require('fs');
const readline = require('readline');

async function main() {
    const transcriptPath = 'C:/Users/HP/.gemini/antigravity-ide/brain/c48f5ddf-66f2-41f4-8ad4-72be5b4af418/.system_generated/logs/transcript.jsonl';
    
    if (!fs.existsSync(transcriptPath)) {
        console.error('Transcript file does not exist at:', transcriptPath);
        return;
    }

    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let lineNumber = 0;
    const queries = ['mit', 'minus', 'perlengkapan', '11.400.000', '17.970.000'];

    console.log('Searching transcript for queries:', queries);

    for await (const line of rl) {
        lineNumber++;
        const lowerLine = line.toLowerCase();
        
        // Check if any query matches
        const matches = queries.filter(q => lowerLine.includes(q.toLowerCase()));
        if (matches.length > 0) {
            try {
                const obj = JSON.parse(line);
                // Print a simplified version of the step
                console.log(`\n[Line ${lineNumber}] Source: ${obj.source}, Type: ${obj.type}, Matches: ${matches.join(', ')}`);
                if (obj.content) {
                    console.log(`Content snippet: ${obj.content.substring(0, 300)}...`);
                }
                if (obj.tool_calls) {
                    console.log(`Tool calls:`, JSON.stringify(obj.tool_calls).substring(0, 200) + '...');
                }
            } catch (err) {
                // Fallback if not valid JSON
                console.log(`[Line ${lineNumber}] (non-json) matches: ${line.substring(0, 200)}...`);
            }
        }
    }
}

main();
