const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('notebooks/nb3_infer.ipynb', 'utf8'));

// List all top-level functions defined across cells
const defined = new Set([
  'load_records_jsonl', 'GradingRecord', 'validate_grading_output',
  'add_line_numbers', 'build_exec_section', 'build_grading_messages',
  'build_gold_output', 'resolve_data_dir', '_resolve_best_adapter',
  '_bnb_cfg', 'load_base_model', 'load_finetuned_model',
  '_apply_template', 'generate_batch', 'postprocess_grading',
  'strip_line_number', 'has_absence_marker',
  'run_inference_one', 'run_batch_inference',
  'compute_metrics', '_graded', '_final_pred',
  'coverage_accuracy', 'per_mutation_breakdown', 'per_question_breakdown',
  '_fmt', 'print_results_table', 'print_confusion_matrix', 'print_examples',
  'exec_baseline', '_resolve_real_data_path', '_read_excel_quiz',
  '_parse_rubric_txt', '_as_obj', '_run_test_cases_real', 'load_real_data', '_in_split'
]);

for (let idx = 25; idx < nb.cells.length; idx++) {
  const c = nb.cells[idx];
  if (c.cell_type !== 'code') continue;
  const src = Array.isArray(c.source) ? c.source.join('') : c.source;
  console.log(`\n--- Cell ${idx} ---`);
  // Find all function calls
  const matches = src.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g);
  for (const m of matches) {
    const fn = m[1];
    if (['if', 'for', 'while', 'with', 'assert', 'return', 'import', 'except', 'class', 'lambda',
         'print', 'len', 'range', 'enumerate', 'zip', 'round', 'min', 'max', 'sum',
         'isinstance', 'issubclass', 'set', 'list', 'dict', 'tuple', 'str', 'int', 'float', 'bool',
         'sorted', 'any', 'all', 'open', 'hasattr', 'getattr', 'setattr', 'delattr',
         'abs', 'type', 'repr', 'map', 'filter', 'next', 'iter', 'callable',
         'append', 'extend', 'get', 'items', 'keys', 'values', 'pop', 'split', 'strip', 'join', 'replace',
         'lower', 'upper', 'startswith', 'endswith', 'encode', 'decode', 'update', 'read', 'write',
         'dumps', 'loads', 'dump', 'load', 'sample', 'format', 'iterrows', 'findall', 'find', 'attrib',
         'to_excel', 'to_csv', 'close', 'collect', 'empty_cache'].includes(fn)) continue;
    if (!defined.has(fn)) {
      console.log(`  Unregistered call: ${fn}`);
    }
  }
}
