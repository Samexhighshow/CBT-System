# CBT System - School Computer-Based Test Platform

A comprehensive, offline-capable school CBT system designed for Nigerian schools (JSS and SSS) with flexible subject management, trade subjects, and admin control.

## 🎯 Features

### Student Features
- ✅ Online registration during admin-controlled windows
- ✅ Dynamic subject assignment (based on class level and department)
- ✅ Offline exam taking with automatic sync
- ✅ Real-time answer saving and autosave
- ✅ Timed exams with countdown timer
- ✅ Results viewing when released by admin
- ✅ Student dashboard with exam and result history

### Admin Features
- ✅ Registration window management (open/close)
- ✅ Subject management (add/remove, mark compulsory/optional)
- ✅ Department management (SSS: Science, Commercial, Arts, etc.)
- ✅ Trade subjects for specialized courses
- ✅ Exam creation and scheduling
- ✅ Student registration monitoring
- ✅ Exam attempt tracking
- ✅ Result release management
- ✅ Analytics and reporting
- ✅ CSV/PDF export for records

### Technical Features
- 📱 Progressive Web App (PWA) for offline functionality
- 🔒 JWT-based authentication
- 📊 IndexedDB for local storage
- 🔄 Automatic sync when internet is available
- 🏫 Multi-school support
- 📈 Comprehensive audit logs
- 🌐 Responsive design

## 📁 Project Structure

```
CBT System/
├── backend/                    # Node.js Express API
│   ├── src/
│   │   ├── controllers/        # Business logic
│   │   ├── routes/             # API endpoints
│   │   ├── models/             # Database models (TODO)
│   │   ├── middleware/         # Auth, validation, error handling
│   │   ├── utils/              # Helpers, logger, constants
│   │   └── index.js            # Server entry point
│   ├── config/                 # Database config
│   ├── package.json            # Dependencies
│   └── .env.example            # Environment variables template
│
├── frontend/                   # React PWA
│   ├── src/
│   │   ├── pages/              # Page components
│   │   │   ├── StudentRegistration.js
│   │   │   ├── StudentLogin.js
│   │   │   ├── StudentDashboard.js
│   │   │   ├── ExamPortal.js
│   │   │   ├── AdminLogin.js
│   │   │   └── AdminDashboard.js
│   │   ├── components/         # Reusable components (TODO)
│   │   ├── services/           # API & offline DB services
│   │   ├── store/              # State management (TODO)
│   │   ├── utils/              # Helper functions (TODO)
│   │   ├── App.js              # Main app component
│   │   ├── App.css             # Global styles
│   │   └── index.js            # React entry point
│   ├── public/                 # Static files (TODO)
│   ├── package.json
│   └── .env.example
│
├── database/                   # Database setup
│   ├── schema.sql              # Complete MySQL schema
│   ├── migrations.js           # DB migration scripts (TODO)
│   └── seeds.js                # Sample data (TODO)
│
├── docs/                       # Documentation
│   ├── API.md                  # API documentation
│   ├── DATABASE.md             # Database schema details
│   ├── SETUP.md                # Setup instructions
│   └── ARCHITECTURE.md         # System architecture
│
└── README.md                   # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- MySQL 8.0+
- npm or yarn

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Create database:**
   ```bash
   mysql -u root -p < ../database/schema.sql
   ```

4. **Start server:**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure API URL (optional):**
   ```bash
   # Create .env file
   REACT_APP_API_URL=http://localhost:5000/api
   ```

3. **Start development server:**
   ```bash
   npm start
   ```

The app will open at `http://localhost:3000`

## 🗄️ Database Schema

### Key Tables

- **students** - Student records with class level and department
- **admins** - Admin/teacher accounts with roles
- **subjects** - Course subjects (JSS/SSS)
- **departments** - School departments (Science, Commercial, Arts)
- **trade_subjects** - Specialized trade courses
- **exams** - Exam configurations
- **exam_questions** - Question bank
- **exam_attempts** - Student exam submissions
- **student_answers** - Student answers to questions
- **registration_windows** - Admin-controlled registration periods

See `database/schema.sql` for complete schema.

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/admin/login` - Admin login
- `POST /api/auth/student/login` - Student login
- `POST /api/auth/refresh-token` - Refresh JWT token
- `POST /api/auth/logout` - Logout

### Students
- `POST /api/students/register` - Student registration
- `GET /api/students/registration-status` - Check registration window
- `GET /api/students/profile` - Get student profile
- `PUT /api/students/profile` - Update profile
- `GET /api/students/assigned-exams` - Get assigned exams
- `GET /api/students/results` - Get exam results

### Exams
- `POST /api/exams` - Create exam (admin)
- `GET /api/exams` - List exams (admin)
- `GET /api/exams/:id` - Get exam details
- `GET /api/exams/available/:studentId` - Get available exams
- `GET /api/exams/:id/questions/:studentId` - Get exam questions
- `PUT /api/exams/:id/release-results` - Release results (admin)

### Exam Attempts
- `POST /api/exam-attempts/start/:examId` - Start exam
- `POST /api/exam-attempts/:attemptId/save-answer` - Save answer
- `POST /api/exam-attempts/:attemptId/submit` - Submit exam
- `GET /api/exam-attempts/:id` - Get attempt details
- `GET /api/exam-attempts` - List all attempts (admin)

### Subjects
- `POST /api/subjects` - Create subject (admin)
- `GET /api/subjects` - List subjects
- `GET /api/subjects/class/:classLevel` - Get subjects by class
- `GET /api/subjects/department/:departmentId` - Get department subjects

### Departments
- `POST /api/departments` - Create department (admin)
- `GET /api/departments` - List departments
- `POST /api/departments/:id/subjects` - Add subject to department
- `POST /api/departments/:id/trade-subjects` - Add trade subject

### Admin Management
- `GET /api/admins/dashboard` - Dashboard stats
- `GET /api/admins/students` - List students
- `POST /api/admins/registration-windows` - Create registration window
- `GET /api/admins/registration-windows` - List registration windows

### Reports
- `GET /api/reports/students` - Student report
- `GET /api/reports/exams` - Exam report
- `GET /api/reports/results` - Results report
- `GET /api/reports/export/students` - Export students (CSV)
- `GET /api/reports/export/results` - Export results (CSV)

See `docs/API.md` for detailed endpoint documentation.

## 🔐 Authentication

The system uses JWT (JSON Web Tokens) for authentication:

1. **Login**: User provides credentials → Server returns access token + refresh token
2. **Protected Routes**: Client includes token in Authorization header
3. **Token Refresh**: Use refresh token to get new access token

**Token Claims:**
```json
{
  "id": "user-uuid",
  "email": "user@school.com",
  "role": "student|admin|teacher",
  "type": "user|refresh"
}
```

## 📦 Offline Support

### How It Works

1. **IndexedDB Storage**: Questions and exams cached locally when exam page loads
2. **Answer Autosave**: Answers automatically saved to local storage every few seconds
3. **Sync Queue**: Failed uploads queued for retry when internet returns
4. **Conflict Resolution**: Server version takes precedence on sync

### Offline Scenario
```
Student takes exam → Internet drops → Answers saved offline 
→ Internet returns → System automatically syncs → Server confirms
```

## 🎓 Registration Flow

1. **Admin Opens Registration Window** → Sets date/time range for specific class
2. **Student Accesses Portal** → Checks if registration is open
3. **Student Fills Form** → Personal info, class level, department (SSS), trade subjects
4. **System Assigns Subjects** → Based on class/department configuration
5. **Student ID Generated** → Unique identifier for login
6. **Data Synced to Server** → Stored in database

## 📝 Exam Flow

1. **Admin Creates Exam** → Assigns to class/department, adds questions
2. **System Assigns to Students** → Based on their registered subjects
3. **Student Starts Exam** → Timer starts, questions displayed
4. **Autosave Enabled** → Answers saved locally every few seconds
5. **Student Submits** → Score calculated, attempt recorded
6. **Results Held** → Until admin releases them
7. **Admin Releases Results** → Students can view scores

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=cbt_system
JWT_SECRET=your_secret_key_here
JWT_EXPIRY=7d
FRONTEND_URL=http://localhost:3000
```

**Frontend (.env)**
```
REACT_APP_API_URL=http://localhost:5000/api
```

## 📊 Subject Structure

### JSS (Junior Secondary School)
- All students get all compulsory JSS subjects
- Optional subjects can be added per student
- No departments required

### SSS (Senior Secondary School)
- Students choose a department (Science, Commercial, Arts)
- Compulsory subjects per department
- Optional subjects per department
- Trade subjects (1-3 multi-select per department)

### Example
```
Science Department (SSS)
├── Compulsory
│   ├── Mathematics
│   ├── English Language
│   ├── Physics
│   ├── Chemistry
│   └── Biology
├── Optional
│   ├── Further Mathematics
│   ├── Technical Drawing
│   └── Computer Science
└── Trade Subjects (choose max 2)
    ├── Welding
    ├── Electrical Installation
    └── Automotive Technology
```

## 🛠️ Development

### Running Tests
```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

### Building for Production

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
# Serve build/ folder with static server
```

### Logging

- Backend: Winston logger in `src/utils/logger.js`
- Logs saved to: `logs/combined.log` and `logs/error.log`
- Frontend: Browser console (use React DevTools)

## 🚨 Security Considerations

1. **Password Hashing**: bcryptjs for password hashing
2. **JWT Expiry**: Tokens expire after 7 days (configurable)
3. **CORS**: Configure trusted origins in production
4. **HTTPS**: Use HTTPS in production
5. **Admin Roles**: Super admin, admin, and teacher roles with permissions
6. **Input Validation**: Joi schema validation on all inputs
7. **SQL Injection**: Using parameterized queries

## 📱 Responsive Design

- Mobile-first approach
- Tablet optimization
- Desktop full-width layout
- Touch-friendly buttons and inputs

## 🤝 Contributing

Guidelines for contributing to this project:

1. Fork the repository
2. Create a feature branch
3. Commit changes with clear messages
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support & Troubleshooting

### Common Issues

**1. Database Connection Failed**
- Check MySQL is running: `mysql -u root -p`
- Verify credentials in `.env`
- Ensure database exists: `show databases;`

**2. Port Already in Use**
- Change PORT in `.env` (backend) or `PORT=3001 npm start` (frontend)

**3. CORS Errors**
- Update `FRONTEND_URL` in backend `.env`
- Check frontend `REACT_APP_API_URL` matches backend URL

**4. Offline Sync Not Working**
- Check browser supports IndexedDB
- Clear IndexedDB in DevTools → Application → Storage
- Ensure token is valid before going offline

## 📞 Contact

For questions or support, please contact the development team.

---

**Version**: 1.0.0  
**Last Updated**: November 2025
