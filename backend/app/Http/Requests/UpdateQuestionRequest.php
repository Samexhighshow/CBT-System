<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use App\Models\Exam;

class UpdateQuestionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'exam_id' => ['required', 'integer', 'exists:exams,id'],
            'question_text' => ['required', 'string', 'min:10', 'max:5000'],
            'question_type' => ['required', 'in:multiple_choice_single,multiple_choice_multiple,true_false,short_answer,essay,fill_blank,matching,ordering,image_based,audio_based,passage,case_study,calculation,practical'],
            'marks' => ['required', 'numeric', 'min:0.5', 'max:100'],
            
            // Optional fields based on question type
            'max_words' => ['nullable', 'integer', 'min:10', 'max:5000'],
            'marking_rubric' => ['nullable', 'string', 'max:2000'],
            'image_url' => ['nullable', 'url'],
            'audio_url' => ['nullable', 'url'],
            'passage_text' => ['nullable', 'string', 'min:50'],
            'case_study_text' => ['nullable', 'string', 'min:50'],
            'formula' => ['nullable', 'string', 'max:500'],
            'correct_answer' => ['nullable', 'string', 'max:1000'],
            'scenario_text' => ['nullable', 'string', 'min:50'],
            
            // Array fields
            'options' => ['nullable', 'array'],
            'options.*.option_text' => ['required_with:options', 'string', 'min:1', 'max:1000'],
            'options.*.is_correct' => ['required_with:options', 'boolean'],
            
            'blank_answers' => ['nullable', 'array'],
            'blank_answers.*' => ['required_with:blank_answers', 'string', 'min:1', 'max:1000'],
            
            'matching_pairs' => ['nullable', 'array'],
            'matching_pairs.*.left' => ['required_with:matching_pairs', 'string', 'min:1', 'max:1000'],
            'matching_pairs.*.right' => ['required_with:matching_pairs', 'string', 'min:1', 'max:1000'],
            
            'ordering_items' => ['nullable', 'array'],
            'ordering_items.*' => ['required_with:ordering_items', 'string', 'min:1', 'max:1000'],
        ];
    }

    /**
     * Custom messages for validation errors
     */
    public function messages(): array
    {
        return [
            'exam_id.required' => 'Exam is required',
            'exam_id.exists' => 'The selected exam does not exist',
            'question_text.required' => 'Question text is required',
            'question_text.min' => 'Question must be at least 10 characters',
            'question_type.required' => 'Question type is required',
            'question_type.in' => 'Invalid question type selected',
            'marks.required' => 'Marks value is required',
            'marks.min' => 'Marks must be at least 0.5',
            'marks.max' => 'Marks cannot exceed 100',
            'options.*.option_text.required_with' => 'All options must have text',
            'blank_answers.*.required_with' => 'All blank answers are required',
            'matching_pairs.*.left.required_with' => 'All matching pairs must have left items',
            'matching_pairs.*.right.required_with' => 'All matching pairs must have right items',
            'ordering_items.*.required_with' => 'All ordering items are required',
        ];
    }

    /**
     * Perform additional validation after the basic rules pass
     */
    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            // Check if exam is closed
            $exam = Exam::find($this->exam_id);
            if ($exam && $exam->status === 'closed') {
                $validator->errors()->add('exam_id', 'Cannot edit questions for a closed exam');
            }

            // Check if marks exceed exam total marks
            if ($exam && $this->marks > $exam->total_marks) {
                $validator->errors()->add('marks', "Marks cannot exceed exam total marks ({$exam->total_marks})");
            }

            // Validate MCQ (single answer) - must have at least 2 options and exactly 1 correct
            if ($this->question_type === 'multiple_choice_single') {
                $options = $this->get('options', []);
                if (count($options) < 2) {
                    $validator->errors()->add('options', 'Multiple choice questions must have at least 2 options');
                }
                
                $correctCount = collect($options)->where('is_correct', true)->count();
                if ($correctCount !== 1) {
                    $validator->errors()->add('options', 'Multiple choice (single answer) must have exactly 1 correct option');
                }
            }

            // Validate MCQ (multiple answers) - must have at least 2 options and at least 1 correct
            if ($this->question_type === 'multiple_choice_multiple') {
                $options = $this->get('options', []);
                if (count($options) < 2) {
                    $validator->errors()->add('options', 'Multiple choice questions must have at least 2 options');
                }
                
                $correctCount = collect($options)->where('is_correct', true)->count();
                if ($correctCount < 1) {
                    $validator->errors()->add('options', 'Multiple choice (multiple answers) must have at least 1 correct option');
                }
            }

            // Validate True/False - must have exactly 2 options
            if ($this->question_type === 'true_false') {
                if (!in_array($this->correct_answer, ['true', 'false'])) {
                    $validator->errors()->add('correct_answer', 'True/False answer must be either "true" or "false"');
                }
            }

            // Validate Matching - must have equal pairs
            if ($this->question_type === 'matching') {
                $pairs = $this->get('matching_pairs', []);
                if (count($pairs) < 2) {
                    $validator->errors()->add('matching_pairs', 'Matching questions must have at least 2 pairs');
                }
                
                // Check for empty pairs
                foreach ($pairs as $pair) {
                    if (empty($pair['left']) || empty($pair['right'])) {
                        $validator->errors()->add('matching_pairs', 'All matching pairs must be complete (both left and right items required)');
                        break;
                    }
                }
            }

            // Validate Fill in the Blank - must have blanks indicated with _____
            if ($this->question_type === 'fill_blank') {
                $questionText = $this->question_text;
                $blankCount = substr_count($questionText, '_____');
                $answerCount = count($this->get('blank_answers', []));
                
                if ($blankCount === 0) {
                    $validator->errors()->add('question_text', 'Fill-in-the-blank questions must contain at least one blank (indicated by _____)');
                }
                
                if ($blankCount !== $answerCount) {
                    $validator->errors()->add('blank_answers', "Number of blanks ({$blankCount}) must match number of answers ({$answerCount})");
                }
            }

            // Validate Ordering - must have at least 2 items
            if ($this->question_type === 'ordering') {
                $items = $this->get('ordering_items', []);
                if (count($items) < 2) {
                    $validator->errors()->add('ordering_items', 'Ordering questions must have at least 2 items');
                }
            }

            // Validate Image-based - must have image URL
            if ($this->question_type === 'image_based' && empty($this->image_url)) {
                $validator->errors()->add('image_url', 'Image URL is required for image-based questions');
            }

            // Validate Audio-based - must have audio URL
            if ($this->question_type === 'audio_based' && empty($this->audio_url)) {
                $validator->errors()->add('audio_url', 'Audio URL is required for audio-based questions');
            }

            // Validate Passage - must have passage text
            if ($this->question_type === 'passage' && empty($this->passage_text)) {
                $validator->errors()->add('passage_text', 'Passage text is required for passage-based questions');
            }

            // Validate Case Study - must have case study text
            if ($this->question_type === 'case_study' && empty($this->case_study_text)) {
                $validator->errors()->add('case_study_text', 'Case study text is required for case study questions');
            }

            // Validate Calculation - must have correct answer
            if ($this->question_type === 'calculation' && empty($this->correct_answer)) {
                $validator->errors()->add('correct_answer', 'Correct answer is required for calculation questions');
            }

            // Validate Practical - must have scenario text
            if ($this->question_type === 'practical' && empty($this->scenario_text)) {
                $validator->errors()->add('scenario_text', 'Scenario description is required for practical questions');
            }

            // Validate Short Answer and Essay - must have max_words
            if (in_array($this->question_type, ['short_answer', 'essay']) && empty($this->max_words)) {
                $validator->errors()->add('max_words', ucfirst(str_replace('_', ' ', $this->question_type)) . ' questions must have maximum words specified');
            }
        });
    }
}
