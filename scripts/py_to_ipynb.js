const fs = require('fs');

function pyToIpynb(pyPath, ipynbPath) {
    const content = fs.readFileSync(pyPath, 'utf8');
    const lines = content.split('\n');

    const cells = [];
    let currentCellType = 'code';
    let currentLines = [];

    function flushCell() {
        if (currentLines.length === 0) return;
        // Trim leading and trailing empty lines from cell
        while (currentLines.length > 0 && currentLines[0].trim() === '') currentLines.shift();
        while (currentLines.length > 0 && currentLines[currentLines.length - 1].trim() === '') currentLines.pop();
        if (currentLines.length === 0) return;

        // If markdown, strip '# ' from lines if appropriate
        let source;
        if (currentCellType === 'markdown') {
            source = currentLines.map((l, i) => {
                let clean = l.startsWith('# ') ? l.slice(2) : (l.startsWith('#') ? l.slice(1) : l);
                return (i < currentLines.length - 1) ? clean + '\n' : clean;
            });
        } else {
            source = currentLines.map((l, i) => (i < currentLines.length - 1 ? l + '\n' : l));
        }

        cells.push({
            cell_type: currentCellType,
            execution_count: null,
            metadata: {},
            outputs: currentCellType === 'code' ? [] : undefined,
            source: source
        });
        currentLines = [];
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('# %% [markdown]')) {
            flushCell();
            currentCellType = 'markdown';
        } else if (line.startsWith('# %%')) {
            flushCell();
            currentCellType = 'code';
        } else {
            currentLines.push(line);
        }
    }
    flushCell();

    const notebook = {
        cells: cells,
        metadata: {
            kernelspec: {
                display_name: "Python 3",
                language: "python",
                name: "python3"
            },
            language_info: {
                name: "python"
            }
        },
        nbformat: 4,
        nbformat_minor: 5
    };

    fs.writeFileSync(ipynbPath, JSON.stringify(notebook, null, 1), 'utf8');
    console.log(`Converted ${pyPath} -> ${ipynbPath} (${cells.length} cells)`);
}

module.exports = { pyToIpynb };

if (require.main === module) {
    pyToIpynb('cpp-grader-code/nb1_data.py', 'notebooks/nb1_data.ipynb');
    pyToIpynb('cpp-grader-code/n0_audit.py', 'notebooks/n0_audit.ipynb');
}

