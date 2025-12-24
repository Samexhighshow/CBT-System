<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BankQuestion;
use App\Models\BankQuestionOption;
use App\Models\BankQuestionTag;
use App\Models\BankQuestionVersion;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;

class BankQuestionController extends Controller
{
    private array $types = ['multiple_choice','multiple_select','true_false','short_answer','long_answer','file_upload'];
    private array $difficulties = ['Easy','Medium','Hard'];
    private array $statuses = ['Draft','Pending Review','Active','Inactive','Archived'];

    public function index(Request $request)
    {
        $query = BankQuestion::query()->with(['subject','tags','options'])
            ->when($request->filled('q'), fn($q) => $q->where('question_text', 'like', '%'.$request->q.'%'))
            ->when($request->filled('subject_id'), fn($q) => $q->where('subject_id', $request->integer('subject_id')))
            ->when($request->filled('class_level'), fn($q) => $q->where('class_level', $request->get('class_level')))
            ->when($request->filled('question_type'), fn($q) => $q->where('question_type', $request->get('question_type')))
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->get('status')))
            ->when($request->filled('difficulty'), fn($q) => $q->where('difficulty', $request->get('difficulty')))
            ->when($request->filled('tag_id'), function ($q) use ($request) {
                $q->whereHas('tags', fn($tq) => $tq->where('bank_question_tags.id', $request->integer('tag_id')));
            })
            ->orderByDesc('created_at');

        $perPage = (int) ($request->get('per_page', 10));
        $data = $query->paginate($perPage);

        return response()->json($data);
    }

    public function stats()
    {
        $total = BankQuestion::count();
        $byStatus = BankQuestion::select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')->pluck('count','status');
        $byType = BankQuestion::select('question_type', DB::raw('COUNT(*) as count'))
            ->groupBy('question_type')->pluck('count','question_type');

        return response()->json([
            'total' => $total,
            'byStatus' => $byStatus,
            'byType' => $byType,
        ]);
    }

    public function show($id)
    {
        $question = BankQuestion::with(['subject', 'options','tags','versions'])->findOrFail($id);
        return response()->json($question);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'question_text' => ['required','string','max:2000'],
            'question_type' => ['required', Rule::in($this->types)],
            'marks' => ['required','integer','min:1'],
            'difficulty' => ['required', Rule::in($this->difficulties)],
            'subject_id' => ['nullable','integer','exists:subjects,id'],
            'class_level' => ['nullable','string','max:100'],
            'instructions' => ['nullable','string'],
            'status' => ['nullable', Rule::in($this->statuses)],
            'tags' => ['array'],
            'tags.*' => ['integer','exists:bank_question_tags,id'],
            'options' => ['array'],
            'options.*.option_text' => ['required_with:options','string'],
            'options.*.is_correct' => ['boolean'],
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $status = $validated['status'] ?? 'Draft';
            $question = BankQuestion::create([
                'question_text' => $validated['question_text'],
                'question_type' => $validated['question_type'],
                'marks' => $validated['marks'],
                'difficulty' => $validated['difficulty'],
                'subject_id' => $validated['subject_id'] ?? null,
                'class_level' => $validated['class_level'] ?? null,
                'instructions' => $validated['instructions'] ?? null,
                'status' => $status,
                'created_by' => optional($request->user())->id,
            ]);

            $options = $validated['options'] ?? [];
            $this->validateOptionsForType($validated['question_type'], $options);
            if (!empty($options)) {
                foreach (array_values($options) as $i => $opt) {
                    BankQuestionOption::create([
                        'bank_question_id' => $question->id,
                        'option_text' => $opt['option_text'],
                        'is_correct' => (bool)($opt['is_correct'] ?? false),
                        'sort_order' => $opt['sort_order'] ?? $i,
                    ]);
                }
            }

            if (!empty($validated['tags'])) {
                $question->tags()->sync($validated['tags']);
            }

            // create initial version record
            BankQuestionVersion::create([
                'bank_question_id' => $question->id,
                'version_number' => 1,
                'question_text' => $question->question_text,
                'question_type' => $question->question_type,
                'marks' => $question->marks,
                'difficulty' => $question->difficulty,
                'instructions' => $question->instructions,
                'created_by' => optional($request->user())->id,
                'change_notes' => 'Initial version',
            ]);

            return response()->json($question->load(['options','tags']), 201);
        });
    }

    public function update(Request $request, $id)
    {
        $question = BankQuestion::findOrFail($id);

        $validated = $request->validate([
            'question_text' => ['sometimes','string','max:2000'],
            'question_type' => ['sometimes', Rule::in($this->types)],
            'marks' => ['sometimes','integer','min:1'],
            'difficulty' => ['sometimes', Rule::in($this->difficulties)],
            'subject_id' => ['nullable','integer','exists:subjects,id'],
            'class_level' => ['nullable','string','max:100'],
            'instructions' => ['nullable','string'],
            'status' => ['sometimes', Rule::in($this->statuses)],
            'tags' => ['array'],
            'tags.*' => ['integer','exists:bank_question_tags,id'],
            'options' => ['array'],
            'options.*.option_text' => ['required_with:options','string'],
            'options.*.is_correct' => ['boolean'],
            'change_notes' => ['nullable','string','max:255'],
        ]);

        return DB::transaction(function () use ($validated, $question, $request) {
            $original = $question->replicate();

            $question->fill($validated);
            $question->save();

            if (array_key_exists('tags', $validated)) {
                $question->tags()->sync($validated['tags'] ?? []);
            }

            if (array_key_exists('options', $validated)) {
                $this->validateOptionsForType($question->question_type, $validated['options'] ?? []);
                $question->options()->delete();
                foreach (array_values($validated['options'] ?? []) as $i => $opt) {
                    BankQuestionOption::create([
                        'bank_question_id' => $question->id,
                        'option_text' => $opt['option_text'],
                        'is_correct' => (bool)($opt['is_correct'] ?? false),
                        'sort_order' => $opt['sort_order'] ?? $i,
                    ]);
                }
            }

            // create new version if core fields changed
            $changed = $question->getChanges();
            if (array_intersect(array_keys($changed), ['question_text','question_type','marks','difficulty','instructions'])) {
                $latest = $question->versions()->max('version_number') ?? 1;
                BankQuestionVersion::create([
                    'bank_question_id' => $question->id,
                    'version_number' => $latest + 1,
                    'question_text' => $question->question_text,
                    'question_type' => $question->question_type,
                    'marks' => $question->marks,
                    'difficulty' => $question->difficulty,
                    'instructions' => $question->instructions,
                    'created_by' => optional($request->user())->id,
                    'change_notes' => $request->get('change_notes', 'Updated'),
                ]);
            }

            return response()->json($question->load(['options','tags','versions']));
        });
    }

    public function destroy($id)
    {
        $q = BankQuestion::findOrFail($id);
        // Hard guard: prevent deleting Active or Archived questions
        if (in_array($q->status, ['Active','Archived'])) {
            return response()->json([
                'message' => 'Delete blocked. Active/Archived questions cannot be deleted. Use archive or set status to Inactive.',
                'code' => 'DELETE_BLOCKED'
            ], 409);
        }

        $q->delete();
        \App\Models\ActivityLog::logActivity('Deleted bank question', $q, 'deleted');
        return response()->json(['message' => 'Deleted']);
    }

    public function duplicate($id)
    {
        $original = BankQuestion::with(['options', 'tags'])->findOrFail($id);
        
        return DB::transaction(function () use ($original) {
            $copy = $original->replicate();
            $copy->question_text = $original->question_text . ' (Copy)';
            $copy->status = 'Draft';
            $copy->save();

            foreach ($original->options as $opt) {
                BankQuestionOption::create([
                    'bank_question_id' => $copy->id,
                    'option_text' => $opt->option_text,
                    'is_correct' => $opt->is_correct,
                    'sort_order' => $opt->sort_order,
                ]);
            }

            if ($original->tags->isNotEmpty()) {
                $copy->tags()->sync($original->tags->pluck('id'));
            }

            BankQuestionVersion::create([
                'bank_question_id' => $copy->id,
                'version_number' => 1,
                'question_text' => $copy->question_text,
                'question_type' => $copy->question_type,
                'marks' => $copy->marks,
                'difficulty' => $copy->difficulty,
                'instructions' => $copy->instructions,
                'created_by' => $copy->created_by,
                'change_notes' => 'Duplicated from question #' . $original->id,
            ]);

            return response()->json($copy->load(['options', 'tags']), 201);
        });
    }

    public function export(Request $request)
    {
        $query = BankQuestion::query()->with(['subject', 'tags'])
            ->when($request->filled('subject_id'), fn($q) => $q->where('subject_id', $request->integer('subject_id')))
            ->when($request->filled('class_level'), fn($q) => $q->where('class_level', $request->get('class_level')))
            ->when($request->filled('question_type'), fn($q) => $q->where('question_type', $request->get('question_type')))
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->get('status')))
            ->when($request->filled('difficulty'), fn($q) => $q->where('difficulty', $request->get('difficulty')))
            ->orderByDesc('created_at');

        $questions = $query->get();

        $csv = "ID,Question Text,Type,Marks,Difficulty,Status,Subject,Class Level,Tags\n";
        foreach ($questions as $q) {
            $tags = $q->tags->pluck('name')->join('; ');
            $csv .= sprintf(
                "%d,\"%s\",\"%s\",%d,\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"\n",
                $q->id,
                str_replace('"', '""', $q->question_text),
                $q->question_type,
                $q->marks,
                $q->difficulty,
                $q->status,
                $q->subject->name ?? '',
                $q->class_level ?? '',
                str_replace('"', '""', $tags)
            );
        }

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="bank-questions-' . now()->format('Y-m-d') . '.csv"',
        ]);
    }

    public function bulkStatus(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required','array','min:1'],
            'ids.*' => ['integer','exists:bank_questions,id'],
            'status' => ['required', Rule::in($this->statuses)],
        ]);
        BankQuestion::whereIn('id', $validated['ids'])->update(['status' => $validated['status']]);
        return response()->json(['updated' => count($validated['ids'])]);
    }

    public function bulkDelete(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required','array','min:1'],
            'ids.*' => ['integer','exists:bank_questions,id'],
        ]);
        // Block deletion of Active/Archived
        $blocked = BankQuestion::whereIn('id', $validated['ids'])
            ->whereIn('status', ['Active','Archived'])
            ->pluck('id');

        $toDelete = collect($validated['ids'])->diff($blocked)->all();
        if (!empty($toDelete)) {
            BankQuestion::whereIn('id', $toDelete)->delete();
        }

        if ($blocked->isNotEmpty()) {
            return response()->json([
                'deleted' => count($toDelete),
                'blocked' => $blocked,
                'message' => 'Some questions could not be deleted because they are Active/Archived.'
            ], 207); // multi-status
        }

        return response()->json(['deleted' => count($toDelete)]);
    }

    public function tagsIndex(Request $request)
    {
        $q = BankQuestionTag::query()
            ->when($request->filled('q'), fn($qq) => $qq->where('name','like','%'.$request->q.'%'))
            ->orderBy('name');
        return response()->json($q->paginate((int)$request->get('per_page', 20)));
    }

    public function tagsStore(Request $request)
    {
        $data = $request->validate([
            'name' => ['required','string','max:100','unique:bank_question_tags,name'],
            'description' => ['nullable','string'],
        ]);
        $tag = BankQuestionTag::create($data);
        return response()->json($tag, 201);
    }

    public function tagsUpdate(Request $request, $id)
    {
        $tag = BankQuestionTag::findOrFail($id);
        $data = $request->validate([
            'name' => ['sometimes','string','max:100', Rule::unique('bank_question_tags','name')->ignore($tag->id)],
            'description' => ['nullable','string'],
        ]);
        $tag->fill($data)->save();
        return response()->json($tag);
    }

    public function tagsDestroy($id)
    {
        $tag = BankQuestionTag::findOrFail($id);
        $tag->delete();
        return response()->json(['message' => 'Deleted']);
    }

    private function validateOptionsForType(string $type, array $options): void
    {
        if (in_array($type, ['multiple_choice','multiple_select'])) {
            if (count($options) < 2) {
                abort(422, 'At least two options are required.');
            }
            $hasCorrect = collect($options)->contains(fn($o) => !empty($o['is_correct']));
            if (!$hasCorrect) {
                abort(422, 'At least one option must be marked correct.');
            }
        } elseif ($type === 'true_false') {
            // If provided, ensure two options with one correct
            if (!empty($options)) {
                if (count($options) !== 2) {
                    abort(422, 'True/False must have exactly two options.');
                }
                $correctCount = collect($options)->where('is_correct', true)->count();
                if ($correctCount !== 1) {
                    abort(422, 'Exactly one True/False option must be correct.');
                }
            }
        } else {
            // Other types should not have options
            if (!empty($options)) {
                abort(422, 'This question type does not accept options.');
            }
        }
    }

    /**
     * Import bank questions from CSV/Excel with per-row validation and partial success.
     */
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt,xlsx,xls',
        ]);

        $file = $request->file('file');
        $ext = strtolower($file->getClientOriginalExtension());
        $rows = [];

        if (in_array($ext, ['csv','txt'])) {
            $path = $file->getRealPath();
            $rows = array_map('str_getcsv', file($path));
        } else {
            // Try PhpSpreadsheet if available
            if (class_exists('PhpOffice\\PhpSpreadsheet\\IOFactory')) {
                $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($file->getRealPath());
                $sheet = $spreadsheet->getActiveSheet();
                foreach ($sheet->toArray(null, true, true, true) as $row) {
                    $rows[] = array_values($row);
                }
            } else {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Excel import requires phpoffice/phpspreadsheet. Please upload CSV or install the package.',
                ], 422);
            }
        }

        if (empty($rows)) {
            return response()->json(['status' => 'error', 'message' => 'Empty file'], 422);
        }

        $header = array_map('trim', $rows[0] ?? []);
        $expectedMinimal = ['question_text','question_type','marks','difficulty'];
        foreach ($expectedMinimal as $col) {
            if (!in_array($col, $header)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Invalid header. Missing column: '.$col,
                ], 422);
            }
        }

        // Map header indexes
        $idx = array_flip($header);
        $inserted = 0;
        $invalid = [];

        foreach (array_slice($rows, 1) as $i => $row) {
            $line = $i + 2;

            $questionText = trim($row[$idx['question_text']] ?? '');
            $questionType = trim($row[$idx['question_type']] ?? '');
            $marks = (int) ($row[$idx['marks']] ?? 0);
            $difficulty = trim($row[$idx['difficulty']] ?? 'Medium');
            $subjectId = isset($idx['subject_id']) ? (int) ($row[$idx['subject_id']] ?? 0) : null;
            $classLevel = isset($idx['class_level']) ? trim($row[$idx['class_level']] ?? '') : null;

            // Collect options 1..10 if present
            $options = [];
            for ($n=1; $n<=10; $n++) {
                $key = 'option_'.$n;
                if (isset($idx[$key])) {
                    $text = trim($row[$idx[$key]] ?? '');
                    if ($text !== '') {
                        $options[] = ['option_text' => $text, 'is_correct' => false, 'sort_order' => count($options)];
                    }
                }
            }

            // Correct options can be indices (e.g., "1|3") or texts (e.g., "Paris|London")
            $correctRaw = isset($idx['correct_options']) ? trim((string)($row[$idx['correct_options']] ?? '')) : '';
            if ($correctRaw !== '') {
                $parts = array_map('trim', explode('|', $correctRaw));
                foreach ($parts as $p) {
                    if (ctype_digit($p) && isset($options[((int)$p)-1])) {
                        $options[((int)$p)-1]['is_correct'] = true;
                    } else {
                        // match by text
                        foreach ($options as &$opt) {
                            if (strcasecmp($opt['option_text'], $p) === 0) {
                                $opt['is_correct'] = true;
                            }
                        }
                        unset($opt);
                    }
                }
            }

            // Row validation
            $errors = [];
            if ($questionText === '') $errors[] = 'Question text required';
            if (!in_array($questionType, $this->types)) $errors[] = 'Invalid question type';
            if ($marks < 1) $errors[] = 'Marks must be >= 1';
            if (!in_array($difficulty, $this->difficulties)) $errors[] = 'Invalid difficulty';

            // Type-specific option validation
            try {
                $this->validateOptionsForType($questionType, $options);
            } catch (\Throwable $e) {
                $errors[] = $e->getMessage();
            }

            if (!empty($errors)) {
                $invalid[] = ['line' => $line, 'errors' => $errors];
                continue;
            }

            // Duplicate detection (soft warning only)
            $similar = BankQuestion::select('id','question_text')->get()->first(function($q) use ($questionText) {
                similar_text($q->question_text, $questionText, $percent);
                return $percent >= 85;
            });

            DB::beginTransaction();
            try {
                $question = BankQuestion::create([
                    'question_text' => $questionText,
                    'question_type' => $questionType,
                    'marks' => $marks,
                    'difficulty' => $difficulty,
                    'subject_id' => $subjectId ?: null,
                    'class_level' => $classLevel ?: null,
                    'status' => 'Draft',
                    'created_by' => optional($request->user())->id,
                ]);

                foreach ($options as $i2 => $opt) {
                    BankQuestionOption::create([
                        'bank_question_id' => $question->id,
                        'option_text' => $opt['option_text'],
                        'is_correct' => (bool)($opt['is_correct'] ?? false),
                        'sort_order' => $i2,
                    ]);
                }

                BankQuestionVersion::create([
                    'bank_question_id' => $question->id,
                    'version_number' => 1,
                    'question_text' => $question->question_text,
                    'question_type' => $question->question_type,
                    'marks' => $question->marks,
                    'difficulty' => $question->difficulty,
                    'instructions' => $question->instructions,
                    'created_by' => optional($request->user())->id,
                    'change_notes' => 'Imported from file',
                ]);

                \App\Models\ActivityLog::logActivity('Imported bank question', $question, 'created', [
                    'similar_to' => $similar ? $similar->id : null,
                    'line' => $line,
                ]);

                DB::commit();
                $inserted++;
            } catch (\Throwable $e) {
                DB::rollBack();
                $invalid[] = ['line' => $line, 'errors' => [$e->getMessage()]];
            }
        }

        // Build error CSV string for download
        $errorCsv = "line,errors\n";
        foreach ($invalid as $err) {
            $errorCsv .= $err['line'] . ',"' . str_replace('"','""', implode(' | ', $err['errors'])) . "\"\n";
        }

        return response()->json([
            'status' => 'ok',
            'inserted' => $inserted,
            'failed' => count($invalid),
            'total' => ($inserted + count($invalid)),
            'errors' => $invalid,
            'error_report_csv' => $errorCsv,
        ]);
    }

    /** List versions for a question */
    public function versions($id)
    {
        $q = BankQuestion::findOrFail($id);
        return response()->json($q->versions()->orderByDesc('version_number')->get());
    }

    /** Compare two versions and return field differences */
    public function compareVersions(Request $request, $id)
    {
        $from = (int) $request->get('from');
        $to = (int) $request->get('to');
        $q = BankQuestion::findOrFail($id);
        $v1 = $q->versions()->where('version_number', $from)->firstOrFail();
        $v2 = $q->versions()->where('version_number', $to)->firstOrFail();

        $fields = ['question_text','question_type','marks','difficulty','instructions'];
        $diff = [];
        foreach ($fields as $f) {
            if ($v1->$f !== $v2->$f) {
                $diff[$f] = ['from' => $v1->$f, 'to' => $v2->$f];
            }
        }
        return response()->json(['diff' => $diff]);
    }

    /** Revert to a specific version (creates a new version snapshot) */
    public function revertVersion(Request $request, $id, $version)
    {
        $q = BankQuestion::findOrFail($id);
        $v = $q->versions()->where('version_number', (int)$version)->firstOrFail();

        return DB::transaction(function () use ($q, $v, $request) {
            $q->question_text = $v->question_text;
            $q->question_type = $v->question_type;
            $q->marks = $v->marks;
            $q->difficulty = $v->difficulty;
            $q->instructions = $v->instructions;
            $q->save();

            $latest = $q->versions()->max('version_number') ?? 1;
            BankQuestionVersion::create([
                'bank_question_id' => $q->id,
                'version_number' => $latest + 1,
                'question_text' => $q->question_text,
                'question_type' => $q->question_type,
                'marks' => $q->marks,
                'difficulty' => $q->difficulty,
                'instructions' => $q->instructions,
                'created_by' => optional($request->user())->id,
                'change_notes' => 'Reverted to version '.$v->version_number,
            ]);

            \App\Models\ActivityLog::logActivity('Reverted bank question version', $q, 'updated', [
                'reverted_to' => $v->version_number,
            ]);

            return response()->json($q->load('versions'));
        });
    }

    /** Archive a question (soft alternative to delete) */
    public function archive($id)
    {
        $q = BankQuestion::findOrFail($id);
        $q->status = 'Archived';
        $q->save();
        \App\Models\ActivityLog::logActivity('Archived bank question', $q, 'archived');
        return response()->json(['message' => 'Archived']);
    }

    /** Submit a Draft question for review */
    public function submitForReview($id)
    {
        $q = BankQuestion::findOrFail($id);
        if ($q->status !== 'Draft') {
            return response()->json(['message' => 'Only Draft questions can be submitted for review'], 422);
        }
        $q->status = 'Pending Review';
        $q->save();
        \App\Models\ActivityLog::logActivity('Submitted question for review', $q, 'submitted');
        return response()->json(['message' => 'Submitted']);
    }

    /** Approve a question (Pending Review -> Active) */
    public function approve($id)
    {
        $q = BankQuestion::findOrFail($id);
        if ($q->status !== 'Pending Review') {
            return response()->json(['message' => 'Only Pending Review questions can be approved'], 422);
        }
        $q->status = 'Active';
        $q->save();
        \App\Models\ActivityLog::logActivity('Approved bank question', $q, 'approved');
        return response()->json(['message' => 'Approved']);
    }
}
