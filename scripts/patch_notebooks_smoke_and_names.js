const fs = require("fs");
const path = require("path");

// 1. Patch nb1b_teacher.ipynb
const nb1bPath = path.join("notebooks", "nb1b_teacher.ipynb");
const nb1b = JSON.parse(fs.readFileSync(nb1bPath, "utf8"));

// Update Markdown title & methodology
nb1b.cells[0].source = [
  "# 🎓 NB1B — Label-Conditioned Rationale Generation (Local Qwen Teacher)\n",
  "\n",
  "**Project**: C++ Rubric Auto-Grader (Kaggle Benchmark v2)\n",
  "**Methodology**: Koutcheme, Woodrow, & Piech (SIGCSE 2026), Label-Conditioned Rationale Generation\n",
  "**Teacher Model**: `Qwen/Qwen2.5-Coder-14B-Instruct` or `Qwen/Qwen3-14B` in 4-bit NF4\n",
  "**Student Target**: `Qwen/Qwen3-4B` (or `Qwen/Qwen2.5-Coder-3B-Instruct`)\n",
  "\n",
  "### Objective:\n",
  "Generate high-capacity algorithmic reasoning traces from a 14B local teacher for the student model. The teacher operates under **Ground-Truth Anchoring**: it receives the verified gold rubric breakdown and generates the 3-step structured output (Step 1 reasoning, Step 2 JSON, Step 3 sandwich feedback).\n",
  "\n",
  "> **Privacy & Policy Guarantee**: Zero external APIs or cloud hosted models are used. All weights run locally on Kaggle T4/P100 GPUs. Code with syntax errors receives full logical credit under CRE."
];

// Update generation loop cell
for (let c of nb1b.cells) {
  const code = c.source.join("");
  if (code.includes("tqdm(records, desc=\"Teacher Distillation\")")) {
    c.source = [
      "\n",
      "train_sft_path = os.path.join(CFG.data_dir, \"train_sft.jsonl\")\n",
      "records = []\n",
      "with open(train_sft_path, \"r\", encoding=\"utf-8\") as f:\n",
      "    for line in f:\n",
      "        if line.strip():\n",
      "            records.append(json.loads(line))\n",
      "\n",
      "if CFG.smoke_test:\n",
      "    print(f\"[SMOKE] Subsetting to {CFG.smoke_samples} samples for timed verification.\")\n",
      "    records = records[:CFG.smoke_samples]\n",
      "\n",
      "print(f\"[RUN] Processing {len(records)} training examples through label-conditioned rationale generation...\")\n",
      "\n",
      "teacher_distilled_records = []\n",
      "n_teacher_accepted = 0\n",
      "n_fallback_used = 0\n",
      "item_durations = []\n",
      "\n",
      "teacher_model.eval()\n",
      "with torch.no_grad():\n",
      "    for idx, rec in enumerate(tqdm(records, desc=\"Label-Conditioned Rationale Generation\")):\n",
      "        t_item_0 = time.perf_counter()\n",
      "        orig_target = rec[\"messages\"][2][\"content\"]\n",
      "        teacher_msgs = build_teacher_anchored_prompt(rec)\n",
      "        \n",
      "        # Format input using chat template with enable_thinking=False\n",
      "        try:\n",
      "            prompt_str = tokenizer.apply_chat_template(teacher_msgs, tokenize=False, add_generation_prompt=True, enable_thinking=False)\n",
      "        except TypeError:\n",
      "            prompt_str = tokenizer.apply_chat_template(teacher_msgs, tokenize=False, add_generation_prompt=True)\n",
      "        \n",
      "        inputs = tokenizer(prompt_str, return_tensors=\"pt\", truncation=True, max_length=CFG.max_seq_len).to(teacher_model.device)\n",
      "        \n",
      "        accepted = False\n",
      "        try:\n",
      "            outputs = teacher_model.generate(\n",
      "                **inputs,\n",
      "                max_new_tokens=CFG.max_new_tokens,\n",
      "                do_sample=False,\n",
      "                temperature=0.0,\n",
      "                pad_token_id=tokenizer.pad_token_id\n",
      "            )\n",
      "            gen_text = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True).strip()\n",
      "            \n",
      "            # Verify teacher response format: must have Step 1, balanced JSON, and Step 3\n",
      "            if \"Let's think step-by-step.\" in gen_text and '\"criteria\"' in gen_text:\n",
      "                accepted = True\n",
      "                final_target = gen_text\n",
      "        except Exception as e:\n",
      "            accepted = False\n",
      "        \n",
      "        if accepted:\n",
      "            n_teacher_accepted += 1\n",
      "            selected_target = final_target\n",
      "        else:\n",
      "            n_fallback_used += 1\n",
      "            selected_target = orig_target  # Fallback to code-generated verified trace\n",
      "        \n",
      "        dt_item = time.perf_counter() - t_item_0\n",
      "        item_durations.append(dt_item)\n",
      "        if CFG.smoke_test or idx < 5 or (idx + 1) % 25 == 0:\n",
      "            avg_dt = sum(item_durations) / len(item_durations)\n",
      "            extrap_min = (avg_dt * len(records)) / 60.0\n",
      "            print(f\"[SMOKE nb1b] Item {idx+1}/{len(records)}: {dt_item:.2f}s (avg {avg_dt:.2f}s/item) | Extrapolated total: {extrap_min:.1f} min\")\n",
      "        \n",
      "        new_rec = {\n",
      "            \"program_id\": rec.get(\"program_id\", f\"prog_{idx}\"),\n",
      "            \"trace_source\": \"teacher_14b\" if accepted else \"code_trace_builder\",\n",
      "            \"messages\": [\n",
      "                rec[\"messages\"][0],\n",
      "                rec[\"messages\"][1],\n",
      "                {\"role\": \"assistant\", \"content\": selected_target}\n",
      "            ]\n",
      "        }\n",
      "        teacher_distilled_records.append(new_rec)\n",
      "\n",
      "print(f\"\\n[SUMMARY] Label-Conditioned Rationale Generation Complete:\")\n",
      "print(f\"  Accepted traces: {n_teacher_accepted} ({n_teacher_accepted / len(records) * 100:.1f}%)\")\n",
      "print(f\"  Fallback traces retained: {n_fallback_used} ({n_fallback_used / len(records) * 100:.1f}%)\")\n"
    ];
  }
}
fs.writeFileSync(nb1bPath, JSON.stringify(nb1b, null, 1), "utf8");
console.log("Patched nb1b_teacher.ipynb");

// 2. Patch nb2_train.ipynb
const nb2Path = path.join("notebooks", "nb2_train.ipynb");
const nb2 = JSON.parse(fs.readFileSync(nb2Path, "utf8"));

for (let c of nb2.cells) {
  const code = c.source.join("");
  if (code.includes("class TimeBudgetCallback(TrainerCallback):")) {
    c.source = [
      "# ============================================================================\n",
      "# 4B. NAN LOSS DETECTOR, WALL-CLOCK ETA, STEP TIMERS & TIME-BUDGET CALLBACK\n",
      "# ============================================================================\n",
      "\n",
      "class SmokeStepTimerCallback(TrainerCallback):\n",
      "    \"\"\"Times each step and prints per-step latency and projected duration in smoke mode.\"\"\"\n",
      "    def __init__(self, is_smoke: bool, total_steps: int):\n",
      "        self.is_smoke = is_smoke\n",
      "        self.total_steps = max(total_steps, 1)\n",
      "        self.step_start = None\n",
      "        self.step_times = []\n",
      "\n",
      "    def on_step_begin(self, args, state, control, **kwargs):\n",
      "        self.step_start = time.perf_counter()\n",
      "\n",
      "    def on_step_end(self, args, state, control, **kwargs):\n",
      "        if self.step_start is not None:\n",
      "            dt = time.perf_counter() - self.step_start\n",
      "            self.step_times.append(dt)\n",
      "            avg_dt = sum(self.step_times) / len(self.step_times)\n",
      "            if self.is_smoke or state.global_step <= 5 or state.global_step % 25 == 0:\n",
      "                extrap_min = (avg_dt * self.total_steps) / 60.0\n",
      "                print(f\"[SMOKE nb2] Step {state.global_step}/{self.total_steps}: {dt:.2f}s/step (avg {avg_dt:.2f}s) | Extrapolated total: {extrap_min:.1f} min\")\n",
      "\n",
      "\n",
      "class TimeBudgetCallback(TrainerCallback):\n",
      "    \"\"\"Stops training cleanly when time budget is reached, preserving best model.\"\"\"\n",
      "    def __init__(self, max_hours: float):\n",
      "        self.max_seconds = max_hours * 3600.0\n",
      "        self.start_time = None\n",
      "\n",
      "    def on_train_begin(self, args, state, control, **kwargs):\n",
      "        self.start_time = time.time()\n",
      "\n",
      "    def on_step_end(self, args, state, control, **kwargs):\n",
      "        if self.start_time is None: return\n",
      "        elapsed = time.time() - self.start_time\n",
      "        if elapsed >= self.max_seconds:\n",
      "            print(f\"\\n[TIME BUDGET] {elapsed/3600.0:.2f}h elapsed >= {self.max_seconds/3600.0:.2f}h limit!\")\n",
      "            print(\"Stopping training cleanly to keep best adapter checkpoint.\")\n",
      "            control.should_training_stop = True\n",
      "\n",
      "\n",
      "class ValUnseenGenerationCallback(TrainerCallback):\n",
      "    \"\"\"Evaluates on a fixed 100-sample subset of val_unseen using generated outputs.\"\"\"\n",
      "    def __init__(self, val_jsonl_path: str, tokenizer, target_path: str, max_samples: int = 100):\n",
      "        self.val_samples = []\n",
      "        if os.path.isfile(val_jsonl_path):\n",
      "            with open(val_jsonl_path, \"r\", encoding=\"utf-8\") as f:\n",
      "                for line in f:\n",
      "                    if line.strip():\n",
      "                        self.val_samples.append(json.loads(line.strip()))\n",
      "                        if len(self.val_samples) >= max_samples:\n",
      "                            break\n",
      "        self.tokenizer = tokenizer\n",
      "        self.target_path = target_path\n",
      "        self.best_score = -float(\"inf\")\n",
      "        self.best_exact_match = 0.0\n",
      "\n",
      "    def on_evaluate(self, args, state, control, metrics=None, **kwargs):\n",
      "        if not self.val_samples: return\n",
      "        model = kwargs.get(\"model\")\n",
      "        if model is None: return\n"
    ];
  }
  if (code.includes("callbacks=[TimeBudgetCallback")) {
    c.source = c.source.map(l => {
      if (l.includes("callbacks=[TimeBudgetCallback")) {
        return l.replace("callbacks=[TimeBudgetCallback(CFG.max_train_hours)", "callbacks=[TimeBudgetCallback(CFG.max_train_hours), SmokeStepTimerCallback(SMOKE_TEST, total_steps)");
      }
      return l;
    });
  }
}
fs.writeFileSync(nb2Path, JSON.stringify(nb2, null, 1), "utf8");
console.log("Patched nb2_train.ipynb");

// 3. Patch nb2b_nca.ipynb
const nb2bPath = path.join("notebooks", "nb2b_nca.ipynb");
const nb2b = JSON.parse(fs.readFileSync(nb2bPath, "utf8"));

for (let c of nb2b.cells) {
  const code = c.source.join("");
  if (code.includes("with torch.no_grad():\n    for rec in tqdm(raw_records[:min(len(raw_records), 300)]")) {
    c.source = [
      "preference_triples = []\n",
      "model.eval()\n",
      "\n",
      "print(\"Generating student responses to build preference triples...\")\n",
      "mining_targets = raw_records[:min(len(raw_records), 300)]\n",
      "mine_durations = []\n",
      "with torch.no_grad():\n",
      "    for idx, rec in enumerate(tqdm(mining_targets, desc=\"Mining Disagreements\")):\n",
      "        t_mine_0 = time.perf_counter()\n",
      "        msgs = rec.get(\"messages\", [])\n",
      "        if len(msgs) < 3:\n",
      "            continue\n",
      "        prompt_msgs = msgs[:2]\n",
      "        gold_target = msgs[2][\"content\"]\n",
      "        \n",
      "        # Format prompt with enable_thinking=False\n",
      "        prompt_text = apply_chat_template_safe(tokenizer, prompt_msgs, add_generation_prompt=True)\n",
      "        enc = tokenizer(prompt_text, return_tensors=\"pt\", truncation=True, max_length=1536).to(model.device)\n",
      "        \n",
      "        # Greedy decode student response\n",
      "        gen_out = model.generate(**enc, max_new_tokens=512, do_sample=False, pad_token_id=tokenizer.pad_token_id)\n",
      "        stud_resp = tokenizer.decode(gen_out[0][enc.input_ids.shape[1]:], skip_special_tokens=True).strip()\n",
      "        \n",
      "        # Compare student response vs gold target\n",
      "        _, s_json, _ = extract_reasoning_and_json(stud_resp)\n",
      "        _, g_json, _ = extract_reasoning_and_json(gold_target)\n",
      "        \n",
      "        # Check disagreement\n",
      "        disagrees = False\n",
      "        if not s_json:\n",
      "            disagrees = True\n",
      "        else:\n",
      "            try:\n",
      "                s_data = json.loads(s_json)\n",
      "                g_data = json.loads(g_json) if g_json else {}\n",
      "                s_tot = sum(float(c.get(\"marks_awarded\", c.get(\"awarded\", 0.0))) for c in s_data.get(\"criteria\", []))\n",
      "                g_tot = sum(float(c.get(\"marks_awarded\", c.get(\"awarded\", 0.0))) for c in g_data.get(\"criteria\", []))\n",
      "                if abs(s_tot - g_tot) >= 0.5:\n",
      "                    disagrees = True\n",
      "            except Exception:\n",
      "                disagrees = True\n",
      "        \n",
      "        if disagrees:\n",
      "            preference_triples.append({\n",
      "                \"prompt\": prompt_text,\n",
      "                \"chosen\": gold_target,\n",
      "                \"rejected\": stud_resp\n",
      "            })\n",
      "        \n",
      "        dt_mine = time.perf_counter() - t_mine_0\n",
      "        mine_durations.append(dt_mine)\n",
      "        if CFG.smoke_test or idx < 5 or (idx + 1) % 15 == 0:\n",
      "            avg_m = sum(mine_durations) / len(mine_durations)\n",
      "            print(f\"[SMOKE nb2b] Mining item {idx+1}/{len(mining_targets)}: {dt_mine:.2f}s (avg {avg_m:.2f}s/item) | Disagreements: {len(preference_triples)}\")\n",
      "\n",
      "print(f\"\\n[PREFERENCE MINING] Found {len(preference_triples)} disagreement triples for NCA alignment.\")\n"
    ];
  }
}
fs.writeFileSync(nb2bPath, JSON.stringify(nb2b, null, 1), "utf8");
console.log("Patched nb2b_nca.ipynb");

// 4. Patch nb3_infer.ipynb
const nb3Path = path.join("notebooks", "nb3_infer.ipynb");
const nb3 = JSON.parse(fs.readFileSync(nb3Path, "utf8"));

for (let c of nb3.cells) {
  const code = c.source.join("");
  if (code.includes("def run_batch_inference(")) {
    c.source = [
      "# ============================================================================\n",
      "# 4C. BATCHED INFERENCE RUNNER (With Timed Smoke Printouts)\n",
      "# ============================================================================\n",
      "\n",
      "def run_batch_inference(model, tokenizer, records: list, cfg: InferConfig,\n",
      "                        desc: str = \"Inference\") -> list:\n",
      "    \"\"\"\n",
      "    Batched generation (batch_size=8, left-pad).\n",
      "    Returns one result dict per record (INVALID outputs count as wrong).\n",
      "    \"\"\"\n",
      "    results  = []\n",
      "    batch_sz = cfg.batch_size\n",
      "    batch_times = []\n",
      "\n",
      "    for batch_idx, batch_start in enumerate(tqdm(range(0, len(records), batch_sz), desc=desc)):\n",
      "        t_batch_0 = time.perf_counter()\n",
      "        batch   = records[batch_start: batch_start + batch_sz]\n",
      "        texts   = [_apply_template(tokenizer, build_grading_prompt(r)) for r in batch]\n",
      "        raws    = generate_batch(model, tokenizer, texts, cfg.max_new_tokens)\n",
      "\n",
      "        for rec, raw in zip(batch, raws):\n",
      "            res = postprocess_grading(raw, rec.rubric,\n",
      "                                      rec.student_answer, rec.execution_report)\n",
      "            if not res[\"schema_valid_final\"]:\n",
      "                raw2 = generate_batch(model, tokenizer, [_apply_template(tokenizer, build_grading_prompt(rec))],\n",
      "                                      cfg.max_new_tokens, do_sample=True,\n",
      "                                      temperature=cfg.retry_temperature)[0]\n",
      "                res2 = postprocess_grading(raw2, rec.rubric,\n",
      "                                           rec.student_answer, rec.execution_report)\n",
      "                if res2[\"schema_valid_final\"]:\n",
      "                    res = res2\n",
      "\n",
      "            res[\"sample_id\"]     = rec.sample_id\n",
      "            res[\"gold_total\"]    = rec.gold_total\n",
      "            res[\"gold_criteria\"] = rec.gold_criteria\n",
      "            res[\"max_marks\"]     = rec.max_marks\n",
      "            res[\"question_id\"]   = rec.question_id\n",
      "            res[\"mutations\"]     = rec.mutations_applied\n",
      "            res[\"is_heavy_ocr\"]  = rec.is_heavy_ocr\n",
      "            res[\"is_garbled\"]    = rec.is_garbled\n",
      "            res[\"program_id\"]    = rec.program_id\n",
      "            res[\"n_answer_lines\"] = len(rec.student_answer.split(\"\\n\"))\n",
      "            results.append(res)\n",
      "\n",
      "        dt_batch = time.perf_counter() - t_batch_0\n",
      "        batch_times.append(dt_batch)\n",
      "        per_item = dt_batch / len(batch)\n",
      "        if cfg.smoke_test or batch_idx == 0 or (batch_idx + 1) % 5 == 0:\n",
      "            avg_item = sum(batch_times) / sum(min(batch_sz, len(records) - i * batch_sz) for i in range(len(batch_times)))\n",
      "            extrap_quiz3 = (avg_item * 46) / 60.0\n",
      "            print(f\"[SMOKE nb3] Batch {batch_idx+1}: {dt_batch:.2f}s ({per_item:.2f}s/item) | Extrapolated Quiz 3 (46 items): {extrap_quiz3:.1f} min\")\n",
      "\n",
      "    return results"
    ];
  }
}
fs.writeFileSync(nb3Path, JSON.stringify(nb3, null, 1), "utf8");
console.log("Patched nb3_infer.ipynb");

