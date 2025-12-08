# Backend Pagination Implementation

## Overview
Comprehensive pagination has been implemented across all major data endpoints to improve performance and user experience when dealing with large datasets.

## Standardized Response Format

All paginated endpoints now return a consistent JSON structure:

```json
{
  "data": [],              // Array of items for current page
  "current_page": 1,       // Current page number
  "last_page": 10,         // Total number of pages
  "per_page": 15,          // Items per page
  "total": 150,            // Total number of items
  "next_page": 2,          // Next page number (null if on last page)
  "prev_page": null        // Previous page number (null if on first page)
}
```

## Query Parameters

All endpoints support these query parameters:

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 15)

Example: `GET /api/students?page=2&limit=25`

## Updated Controllers

### 1. StudentController
**Endpoint:** `GET /api/students`

**Filters:**
- `search` - Search by name, email, or registration number
- `department_id` - Filter by department
- `class_level` - Filter by class level (e.g., SS1, SS2)
- `status` - Filter by student status

**Example:**
```
GET /api/students?page=1&limit=20&class_level=SS2&search=john
```

### 2. ClassController
**Endpoint:** `GET /api/classes`

**Filters:**
- `search` - Search by name or code
- `department_id` - Filter by department
- `is_active` - Filter by active status (default: true)

**Example:**
```
GET /api/classes?page=1&limit=10&is_active=1
```

### 3. DepartmentController
**Endpoint:** `GET /api/departments`

**Filters:**
- `search` - Search by name or code

**Example:**
```
GET /api/departments?page=1&limit=10
```

### 4. SubjectController
**Endpoint:** `GET /api/subjects`

**Filters:**
- `search` - Search by name or code
- `department_id` - Filter by department

**Example:**
```
GET /api/subjects?page=1&limit=20&department_id=3
```

### 5. QuestionController
**Endpoint:** `GET /api/questions`

**Filters:**
- `exam_id` - Filter by exam
- `question_type` - Filter by question type
- `search` - Search in question text

**Example:**
```
GET /api/questions?page=1&limit=50&exam_id=5
```

### 6. ExamController
**Endpoint:** `GET /api/exams`

**Filters:**
- `published` - Filter by published status
- `department` - Filter by department name

**Example:**
```
GET /api/exams?page=1&limit=15&published=1
```

### 7. ResultController

#### Get Student Results
**Endpoint:** `GET /api/results/student/{studentId}`

**Example:**
```
GET /api/results/student/123?page=1&limit=10
```

#### Get Exam Results
**Endpoint:** `GET /api/results/exam/{examId}`

**Example:**
```
GET /api/results/exam/5?page=1&limit=20
```

### 8. HallController
**Endpoint:** `GET /api/halls`

**Filters:**
- `active_only` - Filter active halls only
- `search` - Search by hall name

**Example:**
```
GET /api/halls?page=1&limit=10&active_only=1
```

### 9. UserController
**Endpoint:** `GET /api/users`

**Filters:**
- `only_applicants` - Show only users without roles

**Example:**
```
GET /api/users?page=1&limit=20
```

### 10. ActivityLogController
**Endpoint:** `GET /api/activity-logs`

**Filters:**
- `log_name` - Filter by log name
- `event` - Filter by event type
- `causer_id` - Filter by user who caused the action
- `from_date` - Filter from date
- `to_date` - Filter to date

**Example:**
```
GET /api/activity-logs?page=1&limit=50&event=created&from_date=2025-01-01
```

## Frontend Integration

### Basic Usage

```javascript
// Fetch paginated data
const fetchStudents = async (page = 1, limit = 15) => {
  const response = await axios.get(`/api/students`, {
    params: { page, limit }
  });
  
  const { 
    data,           // Students array
    current_page, 
    last_page, 
    per_page, 
    total,
    next_page,
    prev_page
  } = response.data;
  
  return response.data;
};
```

### React Component Example

```typescript
interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  next_page: number | null;
  prev_page: number | null;
}

const StudentList: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const response = await axios.get<PaginatedResponse<Student>>(
        '/api/students',
        { params: { page, limit: 20 } }
      );
      
      setStudents(response.data.data);
      setTotalPages(response.data.last_page);
      setTotal(response.data.total);
    };
    
    fetchData();
  }, [page]);

  return (
    <div>
      <div>Showing {students.length} of {total} students</div>
      {/* Render students */}
      
      <button 
        disabled={page === 1} 
        onClick={() => setPage(page - 1)}
      >
        Previous
      </button>
      
      <span>Page {page} of {totalPages}</span>
      
      <button 
        disabled={page === totalPages} 
        onClick={() => setPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
};
```

## Performance Benefits

1. **Reduced Memory Usage**: Loading only required data instead of entire datasets
2. **Faster Response Times**: Smaller payloads mean faster network transfer
3. **Better User Experience**: Progressive loading prevents UI freezing
4. **Scalability**: System can handle growing datasets without degradation

## Default Settings

- **Default Page**: 1
- **Default Limit**: 15 items per page
- **Maximum Recommended Limit**: 100 items per page

## Testing

Test pagination with curl:

```bash
# Get first page with default limit (15)
curl http://127.0.0.1:8000/api/students

# Get second page with 25 items
curl http://127.0.0.1:8000/api/students?page=2&limit=25

# Get students filtered by class with pagination
curl http://127.0.0.1:8000/api/students?page=1&limit=10&class_level=SS2

# Get exams with search and pagination
curl http://127.0.0.1:8000/api/exams?page=1&limit=20&search=mathematics
```

## Migration Notes

### Breaking Changes
- All list endpoints now return paginated responses instead of flat arrays
- Frontend code must be updated to handle the new response structure
- Extract the `data` property to get the actual items array

### Backward Compatibility
To maintain compatibility, you can:
1. Check if response has `data` property (paginated)
2. If not, treat response as array (legacy)

```javascript
const fetchData = async () => {
  const response = await axios.get('/api/students');
  
  // Handle both formats
  const students = response.data.data 
    ? response.data.data  // Paginated
    : response.data;      // Legacy
};
```

## Future Improvements

1. **Cursor-based Pagination**: For real-time data feeds
2. **Custom Sort Orders**: Add `sort_by` and `sort_order` parameters
3. **Field Selection**: Add `fields` parameter to return only needed columns
4. **Response Caching**: Cache frequently accessed pages
5. **Rate Limiting**: Implement per-endpoint rate limits

## Implementation Date
December 2025

## Version
v1.0.0
