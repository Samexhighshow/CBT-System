<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BankQuestion;
use App\Models\BankQuestionOption;
use App\Models\BankQuestionTag;
use App\Models\BankQuestionVersion;
use App\Models\Subject;
use App\Models\SchoolClass;
use App\Services\RoleScopeService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;

class BankQuestionController extends Controller
{
    public function __construct(
        private readonly RoleScopeService $roleScopeService
    ) {
    }

    private array $types = ['multiple_choice','multiple_select','true_false','short_answer','long_answer','file_upload'];
    private array $difficulties = ['Easy','Medium','Hard'];
    private array $statuses = ['Draft','Pending Review','Active','Inactive','Archived'];

    public function index(Request $request)
    {
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = strtolower((string) $request->get('sort_order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $allowedSortColumns = ['id', 'question_text', 'marks', 'difficulty', 'status', 'created_at'];
        if (!in_array($sortBy, $allowedSortColumns, true)) {
            $sortBy = 'created_at';
        }

        $includeInactive = filter_var($request->get('include_inactive', false), FILTER_VALIDATE_BOOLEAN);

        $query = BankQuestion::query()->with(['subject','tags','options'])
            ->when($request->filled('q'), fn($q) => $q->where('question_text', 'like', '%'.$request->q.'%'))
            ->when($request->filled('subject_id'), fn($q) => $q->where('subject_id', $request->integer('subject_id')))
            ->when($request->filled('class_level'), fn($q) => $q->where('class_level', $request->get('class_level')))
            ->when($request->filled('question_type'), fn($q) => $q->where('question_type', $request->get('question_type')))
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->get('status')))
            ->when($request->filled('difficulty'), fn($q) => $q->where('difficulty', $request->get('difficulty')))
            ->when($request->filled('exclude_exam_id'), function ($q) use ($request) {
                $examId = (int) $request->get('exclude_exam_id');
                $q->whereNotIn('id', function ($subQuery) use ($examId) {
                    $subQuery->from('exam_questions')
                        ->select('bank_question_id')
                        ->where('exam_id', $examId)
                        ->whereNotNull('bank_question_id');
                });
            })
            ->when(!$includeInactive && !$request->filled('status'), fn($q) => $q->where('status', '!=', 'Inactive'))
            ->when($request->filled('tag_id'), function ($q) use ($request) {
                $q->whereHas('tags', fn($tq) => $tq->where('bank_question_tags.id', $request->integer('tag_id')));
            })
            ->orderBy($sortBy, $sortOrder)
            ->when($sortBy !== 'id', fn($q) => $q->orderBy('id', 'desc'));

        if ($this->roleScopeService->isScopedActor($request->user())) {
            $user = $request->user();
            $subjectIds = $this->roleScopeService->scopedSubjectIds($user);
            $classLevels = $this->roleScopeService->scopedClassLevels($user);

            if (empty($subjectIds) && empty($classLevels)) {
                $query->whereRaw('1 = 0');
            } else {
                $query->where(function ($q) use ($subjectIds, $classLevels) {
                    if (!empty($subjectIds)) {
                        $q->orWhereIn('subject_id', $subjectIds);
                    }
                    if (!empty($classLevels)) {
                        $q->orWhereIn('class_level', $classLevels)
                            ->orWhereIn('class_level', array_map('strtoupper', $classLevels));
                    }
                });
            }
        }

        $perPage = max(1, min(200, (int) ($request->get('per_page', 10))));
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
        if (!$this->roleScopeService->canManageBankQuestion(request()->user(), $question)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

        return response()->json($question);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'question_text' => ['required','string','max:2000'],
            'question_type' => ['required', Rule::in($this->types)],
            'marks' => ['required','integer','min:1'],
            'difficulty' => ['required', Rule::in($this->difficulties)],
            'subject_id' => ['required','integer','exists:subjects,id'],
            'class_level' => ['required','string','max:100'],
            'instructions' => ['nullable','string'],
            'status' => ['nullable', Rule::in($this->statuses)],
            'tags' => ['array'],
            'tags.*' => ['integer','exists:bank_question_tags,id'],
            'options' => ['array'],
            'options.*.option_text' => ['required_with:options','string'],
            'options.*.is_correct' => ['boolean'],
        ]);

        $subject = Subject::find($validated['subject_id']);
        $subjectClassLevel = $subject?->class_level ?? $subject?->schoolClass?->name;
        if ($subjectClassLevel && strcasecmp($subjectClassLevel, $validated['class_level']) !== 0) {
            return response()->json([
                'message' => 'Subject does not match the selected class level',
                'errors' => ['class_level' => ["Subject '{$subject->name}' is not available for class '{$validated['class_level']}'."]],
            ], 422);
        }

        if (
            !$this->roleScopeService->canAccessSubjectClass(
                $request->user(),
                (int) $validated['subject_id'],
                (string) $validated['class_level']
            )
        ) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

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

        if (!$this->roleScopeService->canManageBankQuestion($request->user(), $question)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

        $validated = $request->validate([
            'question_text' => ['sometimes','string','max:2000'],
            'question_type' => ['sometimes', Rule::in($this->types)],
            'marks' => ['sometimes','integer','min:1'],
            'difficulty' => ['sometimes', Rule::in($this->difficulties)],
            'subject_id' => ['sometimes','integer','exists:subjects,id'],
            'class_level' => ['sometimes','string','max:100'],
            'instructions' => ['nullable','string'],
            'status' => ['sometimes', Rule::in($this->statuses)],
            'tags' => ['array'],
            'tags.*' => ['integer','exists:bank_question_tags,id'],
            'options' => ['array'],
            'options.*.option_text' => ['required_with:options','string'],
            'options.*.is_correct' => ['boolean'],
            'change_notes' => ['nullable','string','max:255'],
        ]);

        if (array_key_exists('subject_id', $validated) || array_key_exists('class_level', $validated)) {
            $subjectId = $validated['subject_id'] ?? $question->subject_id;
            $classLevel = $validated['class_level'] ?? $question->class_level;
            $subject = Subject::find($subjectId);
            $subjectClassLevel = $subject?->class_level ?? $subject?->schoolClass?->name;
            if ($subjectClassLevel && $classLevel && strcasecmp($subjectClassLevel, $classLevel) !== 0) {
                return response()->json([
                    'message' => 'Subject does not match the selected class level',
                    'errors' => ['class_level' => ["Subject '{$subject->name}' is not available for class '{$classLevel}'."]],
                ], 422);
            }
        }

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
        if (!$this->roleScopeService->canManageBankQuestion(request()->user(), $q)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

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
        if (!$this->roleScopeService->canManageBankQuestion(request()->user(), $original)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }
        
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
        $target = BankQuestion::whereIn('id', $validated['ids'])->get();
        foreach ($target as $question) {
            if (!$this->roleScopeService->canManageBankQuestion($request->user(), $question)) {
                return response()->json(['message' => 'Forbidden: one or more questions are outside your role scope.'], 403);
            }
        }

        BankQuestion::whereIn('id', $validated['ids'])->update(['status' => $validated['status']]);
        return response()->json(['updated' => count($validated['ids'])]);
    }

    public function bulkDelete(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required','array','min:1'],
            'ids.*' => ['integer','exists:bank_questions,id'],
        ]);
        $target = BankQuestion::whereIn('id', $validated['ids'])->get();
        foreach ($target as $question) {
            if (!$this->roleScopeService->canManageBankQuestion($request->user(), $question)) {
                return response()->json(['message' => 'Forbidden: one or more questions are outside your role scope.'], 403);
            }
        }

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
            'default_subject_id' => 'nullable|integer|exists:subjects,id',
            'default_class_level' => 'nullable|string|max:100',
        ]);

        $file = $request->file('file');
        $ext = strtolower($file->getClientOriginalExtension());
        $rows = [];
        $defaultSubjectId = (int) ($request->input('default_subject_id') ?? 0);
        $defaultClassLevel = trim((string) ($request->input('default_class_level') ?? ''));

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

        $header = array_map(
            fn ($h) => strtolower(trim((string) $h)),
            $rows[0] ?? []
        );

        // Map header indexes (case-insensitive)
        $idx = [];
        foreach ($header as $position => $name) {
            if ($name !== '') {
                $idx[$name] = $position;
            }
        }

        $findIndex = function (array $candidates) use ($idx): ?int {
            foreach ($candidates as $candidate) {
                if (array_key_exists($candidate, $idx)) {
                    return $idx[$candidate];
                }
            }

            return null;
        };

        $questionTextIdx = $findIndex(['question_text', 'question']);
        $questionTypeIdx = $findIndex(['question_type', 'type']);
        $marksIdx = $findIndex(['marks', 'mark']);
        $difficultyIdx = $findIndex(['difficulty', 'difficulty_level']);
        $subjectIdIdx = $findIndex(['subject_id']);
        $subjectNameIdx = $findIndex(['subject_name', 'subject', 'subject_code']);
        $classLevelIdx = $findIndex(['class_level', 'class', 'class_name']);
        $classIdIdx = $findIndex(['class_id']);
        $instructionsIdx = $findIndex(['instructions', 'marking_rubric']);
        $statusIdx = $findIndex(['status']);
        $correctOptionsIdx = $findIndex(['correct_options', 'correct_option']);

        if ($questionTextIdx === null || $questionTypeIdx === null || $marksIdx === null) {
            $missing = [];
            if ($questionTextIdx === null) {
                $missing[] = 'question_text';
            }
            if ($questionTypeIdx === null) {
                $missing[] = 'question_type';
            }
            if ($marksIdx === null) {
                $missing[] = 'marks';
            }

            return response()->json([
                'status' => 'error',
                'message' => 'Invalid header. Missing required column(s): ' . implode(', ', $missing),
            ], 422);
        }

        $inserted = 0;
        $invalid = [];

        foreach (array_slice($rows, 1) as $i => $row) {
            $line = $i + 2;

            $questionText = trim((string) ($row[$questionTextIdx] ?? ''));
            $rawType = trim((string) ($row[$questionTypeIdx] ?? ''));
            $questionType = $this->normalizeImportQuestionType($rawType);
            $marks = (int) ($row[$marksIdx] ?? 0);
            $difficultyRaw = $difficultyIdx !== null ? trim((string) ($row[$difficultyIdx] ?? '')) : '';
            $difficulty = $this->normalizeImportDifficulty($difficultyRaw !== '' ? $difficultyRaw : 'Medium');

            $classLevel = $classLevelIdx !== null ? trim((string) ($row[$classLevelIdx] ?? '')) : '';
            if ($classLevel === '' && $classIdIdx !== null) {
                $classId = (int) ($row[$classIdIdx] ?? 0);
                if ($classId > 0) {
                    $classLevel = (string) (SchoolClass::find($classId)?->name ?? '');
                }
            }
            if ($classLevel === '' && $defaultClassLevel !== '') {
                $classLevel = $defaultClassLevel;
            }

            $rowSubjectIdentifier = '';
            if ($subjectIdIdx !== null) {
                $rowSubjectIdentifier = trim((string) ($row[$subjectIdIdx] ?? ''));
            }
            if ($rowSubjectIdentifier === '' && $subjectNameIdx !== null) {
                $rowSubjectIdentifier = trim((string) ($row[$subjectNameIdx] ?? ''));
            }

            $subject = null;
            if ($rowSubjectIdentifier !== '') {
                $subject = $this->resolveImportSubject($rowSubjectIdentifier, $classLevel);
                if (!$subject && $defaultSubjectId > 0) {
                    $subject = Subject::find($defaultSubjectId);
                }
            } elseif ($defaultSubjectId > 0) {
                $subject = Subject::find($defaultSubjectId);
            }

            $subjectId = (int) ($subject?->id ?? 0);
            if ($classLevel === '' && $subject) {
                $classLevel = (string) ($subject->class_level ?? $subject->schoolClass?->name ?? '');
            }

            $instructions = $instructionsIdx !== null ? trim((string) ($row[$instructionsIdx] ?? '')) : '';
            $instructions = $instructions !== '' ? $instructions : null;
            $statusRaw = $statusIdx !== null ? trim((string) ($row[$statusIdx] ?? '')) : '';
            $status = $this->normalizeImportStatus($statusRaw);

            // Collect options 1..10 if present
            $options = [];
            for ($n = 1; $n <= 10; $n++) {
                $key = 'option_'.$n;
                if (isset($idx[$key])) {
                    $text = trim((string) ($row[$idx[$key]] ?? ''));
                    if ($text !== '') {
                        $options[] = ['option_text' => $text, 'is_correct' => false, 'sort_order' => count($options)];
                    }
                }
            }

            // Correct options can be indices (e.g., "1|3") or texts (e.g., "Paris|London")
            $correctRaw = $correctOptionsIdx !== null ? trim((string) ($row[$correctOptionsIdx] ?? '')) : '';
            if ($correctRaw !== '') {
                $parts = array_map('trim', explode('|', $correctRaw));
                foreach ($parts as $p) {
                    if (ctype_digit($p) && isset($options[((int) $p) - 1])) {
                        $options[((int) $p) - 1]['is_correct'] = true;
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
            if ($questionText === '') {
                $errors[] = 'Question text required';
            }
            if (!in_array($questionType, $this->types, true)) {
                $errors[] = 'Invalid question type';
            }
            if ($marks < 1) {
                $errors[] = 'Marks must be >= 1';
            }
            if (!in_array($difficulty, $this->difficulties, true)) {
                $errors[] = 'Invalid difficulty';
            }
            if ($rowSubjectIdentifier !== '' && !$subject) {
                $errors[] = "Subject not found: {$rowSubjectIdentifier}";
            } elseif ($subjectId <= 0) {
                $errors[] = 'Subject is required (use subject_id or subject_name, or choose a subject filter before import)';
            }
            if ($classLevel === '') {
                $errors[] = 'Class level is required';
            }

            $subjectClassLevel = (string) ($subject?->class_level ?? $subject?->schoolClass?->name ?? '');
            if ($subjectClassLevel !== '' && $classLevel !== '' && !$this->classLevelsMatch($subjectClassLevel, $classLevel)) {
                $errors[] = "Subject '{$subject->name}' is not available for class '{$classLevel}'";
            }

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
                    'subject_id' => $subjectId,
                    'class_level' => $classLevel,
                    'instructions' => $instructions,
                    'status' => $status,
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

    private function normalizeImportQuestionType(string $value): string
    {
        $normalized = strtolower(trim($value));
        $map = [
            'mcq' => 'multiple_choice',
            'multiple_choice_single' => 'multiple_choice',
            'single_choice' => 'multiple_choice',
            'multiple_choice' => 'multiple_choice',
            'multiple_select' => 'multiple_select',
            'multiple_choice_multiple' => 'multiple_select',
            'true_false' => 'true_false',
            'true/false' => 'true_false',
            'truefalse' => 'true_false',
            'short' => 'short_answer',
            'short_answer' => 'short_answer',
            'essay' => 'long_answer',
            'long' => 'long_answer',
            'long_answer' => 'long_answer',
            'file' => 'file_upload',
            'file_upload' => 'file_upload',
        ];

        return $map[$normalized] ?? $normalized;
    }

    private function normalizeImportDifficulty(string $value): string
    {
        $normalized = strtolower(trim($value));
        return match ($normalized) {
            'easy' => 'Easy',
            'medium' => 'Medium',
            'hard' => 'Hard',
            default => $value !== '' ? ucfirst($value) : 'Medium',
        };
    }

    private function normalizeImportStatus(string $value): string
    {
        $normalized = strtolower(trim($value));
        return match ($normalized) {
            'draft' => 'Draft',
            'pending review', 'pending_review' => 'Pending Review',
            'active' => 'Active',
            'inactive' => 'Inactive',
            'archived' => 'Archived',
            default => 'Draft',
        };
    }

    private function resolveImportSubject(string $identifier, string $classLevel = ''): ?Subject
    {
        $value = trim($identifier);
        if ($value === '') {
            return null;
        }

        if (ctype_digit($value)) {
            return Subject::find((int) $value);
        }

        $lookup = strtolower($value);
        $candidates = Subject::query()
            ->with('schoolClass:id,name')
            ->where(function ($q) use ($lookup) {
                $q->whereRaw('LOWER(name) = ?', [$lookup])
                    ->orWhereRaw('LOWER(code) = ?', [$lookup]);
            })
            ->orderBy('id')
            ->get();

        if ($candidates->isEmpty()) {
            return null;
        }

        if ($classLevel === '') {
            return $candidates->first();
        }

        $target = $this->normalizeClassLevelForCompare($classLevel);
        return $candidates->first(function (Subject $subject) use ($target) {
            $subjectLevel = (string) ($subject->class_level ?? $subject->schoolClass?->name ?? '');
            return $this->normalizeClassLevelForCompare($subjectLevel) === $target;
        }) ?? $candidates->first();
    }

    private function classLevelsMatch(string $left, string $right): bool
    {
        return $this->normalizeClassLevelForCompare($left) === $this->normalizeClassLevelForCompare($right);
    }

    private function normalizeClassLevelForCompare(string $value): string
    {
        $normalized = strtoupper(str_replace([' ', '-', '_'], '', trim($value)));

        if ($normalized === '') {
            return '';
        }

        if (str_starts_with($normalized, 'JSS')) {
            return 'JSS';
        }

        if (str_starts_with($normalized, 'SSS') || str_starts_with($normalized, 'SS')) {
            return 'SSS';
        }

        return $normalized;
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
