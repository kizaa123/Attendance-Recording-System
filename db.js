const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const root = __dirname;
const dbFile = path.join(root, "data", "attendify.db");
const legacyJson = path.join(root, "data", "attendance.json");

let db;

function seedState() {
  return {
    activeClassId: "bsc-cs",
    classes: [
      { id: "bsc-cs", code: "BSc CS", name: "BSc Computer Science", department: "Computer Science" },
      { id: "bsc-it", code: "BSc IT", name: "BSc Information Technology", department: "Information Technology" }
    ],
    students: [
      { id: "s1", classId: "bsc-cs", name: "Elena Rostova", index: "CS2024-0012", email: "e.rostova@student.ac.edu", photo: "", source: "lecturer" },
      { id: "s2", classId: "bsc-cs", name: "Marcus Adebayo", index: "CS2024-0089", email: "m.adebayo@student.ac.edu", photo: "", source: "lecturer" },
      { id: "s3", classId: "bsc-cs", name: "Julian Lawrence", index: "CS2024-0104", email: "j.lawrence@student.ac.edu", photo: "", source: "link" },
      { id: "s4", classId: "bsc-cs", name: "Mei Ling Chen", index: "CS2024-0122", email: "m.chen@student.ac.edu", photo: "", source: "link" },
      { id: "s5", classId: "bsc-cs", name: "Siddharth Kumar", index: "CS2024-0138", email: "s.kumar@student.ac.edu", photo: "", source: "lecturer" },
      { id: "s6", classId: "bsc-cs", name: "Ananya Banerjee", index: "CS2024-0152", email: "a.banerjee@student.ac.edu", photo: "", source: "link" }
    ],
    sessions: {},
    semester: { totalWeeks: 15, currentWeek: 8 },
    courses: []
  };
}

function openDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  db = new DatabaseSync(dbFile);
  db.exec("PRAGMA foreign_keys = ON");
  initSchema();
  migrateLegacyJsonIfNeeded();
  seedIfEmpty();
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT ''
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_code ON classes(code COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      index_number TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      photo TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'lecturer',
      qr_public_id TEXT,
      created_at TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_students_class_index
      ON students(class_id, index_number COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      session_date TEXT NOT NULL,
      lecture_name TEXT NOT NULL DEFAULT '',
      week_number INTEGER,
      course_id TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      scanned_at TEXT NOT NULL,
      UNIQUE(session_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS attendance_session_classes (
      session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      PRIMARY KEY (session_id, class_id)
    );

    CREATE TABLE IF NOT EXISTS programme_courses (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_programme_courses_code
      ON programme_courses(class_id, code COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS ta_tokens (
      token TEXT PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      lecture_name TEXT NOT NULL DEFAULT '',
      week_number INTEGER NOT NULL DEFAULT 1,
      course_id TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ta_tokens_session ON ta_tokens(session_id);
  `);
  migrateSchemaUpgrades();
}

function migrateSchemaUpgrades() {
  const cols = db.prepare("PRAGMA table_info(classes)").all().map(function (c) {
    return c.name;
  });
  if (cols.indexOf("department") === -1) {
    db.exec("ALTER TABLE classes ADD COLUMN department TEXT NOT NULL DEFAULT ''");
  }
  const studentCols = db.prepare("PRAGMA table_info(students)").all().map(function (c) {
    return c.name;
  });
  if (studentCols.indexOf("qr_public_id") === -1) {
    db.exec("ALTER TABLE students ADD COLUMN qr_public_id TEXT");
  }
  db.exec("DROP INDEX IF EXISTS idx_students_qr_public_id");
  db.exec("CREATE INDEX IF NOT EXISTS idx_students_qr_public_lookup ON students(qr_public_id)");

  if (setting("migrateQrDeptScope", "") !== "1") {
    reassignQrByDepartmentScope();
    setSetting("migrateQrDeptScope", "1");
  }

  db.prepare(
    "UPDATE classes SET department = ? WHERE (department IS NULL OR department = '') AND code LIKE 'CS%'"
  ).run("Computer Science");

  const sessionCols = db.prepare("PRAGMA table_info(attendance_sessions)").all().map(function (c) {
    return c.name;
  });
  if (sessionCols.indexOf("lecture_name") === -1) {
    db.exec("ALTER TABLE attendance_sessions ADD COLUMN lecture_name TEXT NOT NULL DEFAULT ''");
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_session_lecture ON attendance_sessions(class_id, session_date, lecture_name)"
    );
  }
  const sessionCols2 = db.prepare("PRAGMA table_info(attendance_sessions)").all().map(function (c) {
    return c.name;
  });
  if (sessionCols2.indexOf("week_number") === -1) {
    db.exec("ALTER TABLE attendance_sessions ADD COLUMN week_number INTEGER");
    const week = Number(setting("semester.currentWeek", "1")) || 1;
    db.prepare("UPDATE attendance_sessions SET week_number = ? WHERE week_number IS NULL").run(week);
  }

  const sessions = db
    .prepare(
      "SELECT id, class_id FROM attendance_sessions WHERE id NOT IN (SELECT session_id FROM attendance_session_classes)"
    )
    .all();
  const linkStmt = db.prepare(
    "INSERT OR IGNORE INTO attendance_session_classes (session_id, class_id) VALUES (?, ?)"
  );
  sessions.forEach(function (s) {
    linkStmt.run(s.id, s.class_id);
  });

  const sessionCols3 = db.prepare("PRAGMA table_info(attendance_sessions)").all().map(function (c) {
    return c.name;
  });
  if (sessionCols3.indexOf("course_id") === -1) {
    db.exec("ALTER TABLE attendance_sessions ADD COLUMN course_id TEXT REFERENCES programme_courses(id) ON DELETE SET NULL");
  }

  const sessionCols4 = db.prepare("PRAGMA table_info(attendance_sessions)").all().map(function (c) {
    return c.name;
  });
  if (sessionCols4.indexOf("closed_at") === -1) {
    db.exec("ALTER TABLE attendance_sessions ADD COLUMN closed_at TEXT");
  }

  if (setting("semesterWeeks15", "") !== "1") {
    setSetting("semester.totalWeeks", "15");
    setSetting("semesterWeeks15", "1");
  }

  migrateAttendanceSessionsMultiPerDay();
}

function migrateAttendanceSessionsMultiPerDay() {
  if (setting("migrateSessionMultiPerDay", "") === "1") return;

  const tableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'attendance_sessions'").get();
  const needsRebuild =
    tableSql && tableSql.sql && tableSql.sql.indexOf("UNIQUE(class_id, session_date)") !== -1;

  if (!needsRebuild) {
    db.exec("DROP INDEX IF EXISTS idx_attendance_session_lecture");
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_session_unique ON attendance_sessions(class_id, session_date, lecture_name, week_number)"
    );
    setSetting("migrateSessionMultiPerDay", "1");
    return;
  }

  db.exec("BEGIN");
  try {
    db.exec(`
      CREATE TABLE attendance_sessions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        session_date TEXT NOT NULL,
        lecture_name TEXT NOT NULL DEFAULT '',
        week_number INTEGER,
        course_id TEXT REFERENCES programme_courses(id) ON DELETE SET NULL
      );
    `);
    const cols = db.prepare("PRAGMA table_info(attendance_sessions)").all().map(function (c) {
      return c.name;
    });
    const hasLecture = cols.indexOf("lecture_name") !== -1;
    const hasWeek = cols.indexOf("week_number") !== -1;
    const hasCourse = cols.indexOf("course_id") !== -1;
    const weekDefault = Number(setting("semester.currentWeek", "1")) || 1;

    if (hasLecture && hasWeek && hasCourse) {
      db.exec(`
        INSERT INTO attendance_sessions_new (id, class_id, session_date, lecture_name, week_number, course_id)
        SELECT id, class_id, session_date, COALESCE(lecture_name, ''), COALESCE(week_number, ${weekDefault}), course_id
        FROM attendance_sessions;
      `);
    } else if (hasLecture) {
      db.exec(`
        INSERT INTO attendance_sessions_new (id, class_id, session_date, lecture_name, week_number, course_id)
        SELECT id, class_id, session_date, COALESCE(lecture_name, ''), ${weekDefault}, NULL
        FROM attendance_sessions;
      `);
    } else {
      db.exec(`
        INSERT INTO attendance_sessions_new (id, class_id, session_date, lecture_name, week_number, course_id)
        SELECT id, class_id, session_date, '', ${weekDefault}, NULL
        FROM attendance_sessions;
      `);
    }

    db.exec("DROP TABLE attendance_sessions");
    db.exec("ALTER TABLE attendance_sessions_new RENAME TO attendance_sessions");
    db.exec("DROP INDEX IF EXISTS idx_attendance_session_lecture");
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_session_unique ON attendance_sessions(class_id, session_date, lecture_name, week_number)"
    );
    db.exec("COMMIT");
    setSetting("migrateSessionMultiPerDay", "1");
  } catch (error) {
    db.exec("ROLLBACK");
    console.error("Session table migration failed:", error.message);
    throw error;
  }
}

function qrDeptIndexKey(department, indexNumber) {
  return (
    String(department || "")
      .trim()
      .toLowerCase() + "|" + String(indexNumber || "").trim().toLowerCase()
  );
}

function departmentForClass(classId) {
  const row = db.prepare("SELECT department FROM classes WHERE id = ?").get(classId);
  return row ? String(row.department || "").trim() : "";
}

function findQrPublicIdForDeptIndex(department, indexNumber) {
  const row = db
    .prepare(
      `SELECT s.qr_public_id AS qrPublicId
       FROM students s
       INNER JOIN classes c ON c.id = s.class_id
       WHERE lower(trim(c.department)) = lower(trim(?))
         AND s.index_number = ? COLLATE NOCASE
         AND s.qr_public_id IS NOT NULL AND s.qr_public_id != ''
       LIMIT 1`
    )
    .get(department || "", indexNumber);
  return row ? row.qrPublicId : null;
}

function reassignQrByDepartmentScope() {
  const all = db
    .prepare(
      `SELECT s.id, s.index_number AS idx, c.department AS dept
       FROM students s
       INNER JOIN classes c ON c.id = s.class_id`
    )
    .all();
  const groups = {};
  all.forEach(function (row) {
    const key = qrDeptIndexKey(row.dept, row.idx);
    if (!key.endsWith("|")) {
      if (!groups[key]) groups[key] = crypto.randomUUID();
      db.prepare("UPDATE students SET qr_public_id = ? WHERE id = ?").run(groups[key], row.id);
    }
  });
}

function setting(key, fallback) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, String(value));
}

function seedIfEmpty() {
  const classCount = db.prepare("SELECT COUNT(*) AS n FROM classes").get().n;
  if (classCount > 0) return;
  importState(seedState());
}

function migrateLegacyJsonIfNeeded() {
  if (setting("migratedFromJson", "") === "1") return;
  const classCount = db.prepare("SELECT COUNT(*) AS n FROM classes").get().n;
  if (classCount > 0) {
    setSetting("migratedFromJson", "1");
    return;
  }
  if (!fs.existsSync(legacyJson)) {
    setSetting("migratedFromJson", "1");
    return;
  }
  try {
    const state = JSON.parse(fs.readFileSync(legacyJson, "utf8"));
    importState(state);
    setSetting("migratedFromJson", "1");
    console.log("Migrated data from data/attendance.json into SQLite.");
  } catch (error) {
    console.warn("Could not migrate attendance.json:", error.message);
  }
}

function importState(body) {
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM attendance_records").run();
    db.prepare("DELETE FROM attendance_sessions").run();
    db.prepare("DELETE FROM programme_courses").run();
    db.prepare("DELETE FROM students").run();
    db.prepare("DELETE FROM classes").run();

    const insertClass = db.prepare("INSERT INTO classes (id, code, name, department) VALUES (?, ?, ?, ?)");
    (body.classes || []).forEach(function (course) {
      insertClass.run(course.id, course.code, course.name, course.department || "");
    });

    const insertCourse = db.prepare(
      "INSERT INTO programme_courses (id, class_id, code, name, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    (body.courses || []).forEach(function (course) {
      if (!course || !course.id || !course.classId) return;
      insertCourse.run(
        course.id,
        course.classId,
        course.code,
        course.name,
        course.createdAt || null
      );
    });

    const insertStudent = db.prepare(
      "INSERT INTO students (id, class_id, name, index_number, email, photo, source, qr_public_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    (body.students || []).forEach(function (student) {
      const classDept = db.prepare("SELECT department FROM classes WHERE id = ?").get(student.classId);
      const dept = (classDept && classDept.department) || student.department || "";
      const qrId =
        student.qrPublicId || findQrPublicIdForDeptIndex(dept, student.index) || crypto.randomUUID();
      insertStudent.run(
        student.id,
        student.classId,
        student.name,
        student.index,
        student.email || "",
        student.photo || "",
        student.source || "lecturer",
        qrId,
        student.createdAt || null
      );
    });

    const insertSession = db.prepare(
      "INSERT INTO attendance_sessions (class_id, session_date, lecture_name, week_number) VALUES (?, ?, ?, ?)"
    );
    const insertRecord = db.prepare(
      "INSERT INTO attendance_records (session_id, student_id, scanned_at) VALUES (?, ?, ?)"
    );

    Object.keys(body.sessions || {}).forEach(function (key) {
      const session = body.sessions[key];
      if (!session || !session.classId || !session.date) return;
      const lectureName = normalizeLectureName(session.lectureName || "");
      const weekNum =
        session.weekNumber != null ? session.weekNumber : Number(setting("semester.currentWeek", "1")) || 1;
      const info = insertSession.run(session.classId, session.date, lectureName, weekNum);
      const sessionId = info.lastInsertRowid;
      db.prepare("INSERT OR IGNORE INTO attendance_session_classes (session_id, class_id) VALUES (?, ?)").run(
        sessionId,
        session.classId
      );
      (session.records || []).forEach(function (record) {
        insertRecord.run(sessionId, record.studentId, record.scannedAt);
      });
    });

    if (body.activeClassId) setSetting("activeClassId", body.activeClassId);
    if (body.semester) {
      if (body.semester.totalWeeks != null) setSetting("semester.totalWeeks", body.semester.totalWeeks);
      if (body.semester.currentWeek != null) setSetting("semester.currentWeek", body.semester.currentWeek);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function loadState() {
  openDb();
  const classes = db.prepare("SELECT id, code, name, department FROM classes ORDER BY code").all();
  const studentRows = db
    .prepare(
      "SELECT id, class_id AS classId, name, index_number AS studentIndex, email, photo, source, qr_public_id AS qrPublicId, created_at AS createdAt FROM students"
    )
    .all();
  const students = studentRows.map(function (row) {
    return {
      id: row.id,
      classId: row.classId,
      name: row.name,
      index: row.studentIndex,
      email: row.email,
      photo: row.photo,
      source: row.source,
      qrPublicId: row.qrPublicId,
      createdAt: row.createdAt
    };
  });

  const sessions = {};
  const sessionRows = db
    .prepare(
      "SELECT id AS sessionId, class_id AS classId, session_date AS date, lecture_name AS lectureName, week_number AS weekNumber, course_id AS courseId, closed_at AS closedAt FROM attendance_sessions ORDER BY session_date DESC, id DESC"
    )
    .all();

  const recordsStmt = db.prepare(
    "SELECT student_id AS studentId, scanned_at AS scannedAt FROM attendance_records WHERE session_id = ? ORDER BY scanned_at"
  );
  const classLinksStmt = db.prepare(
    "SELECT class_id AS classId FROM attendance_session_classes WHERE session_id = ?"
  );

  sessionRows.forEach(function (row) {
    const records = recordsStmt.all(row.sessionId);
    const linked = classLinksStmt.all(row.sessionId).map(function (l) {
      return l.classId;
    });
    const classIds = linked.length ? linked : [row.classId];
    const lectureName = normalizeLectureName(row.lectureName || "");
    classIds.forEach(function (classId) {
      const weekNum =
        row.weekNumber != null ? row.weekNumber : Number(setting("semester.currentWeek", "1")) || 1;
      const key = classId + ":" + row.date + ":" + weekNum + ":" + lectureName.toLowerCase();
      sessions[key] = {
        sessionId: row.sessionId,
        classId: classId,
        primaryClassId: row.classId,
        linkedClassIds: classIds,
        date: row.date,
        lectureName: lectureName,
        weekNumber: weekNum,
        courseId: row.courseId || null,
        closedAt: row.closedAt || null,
        records: records
      };
    });
  });

  const courseRows = db
    .prepare(
      "SELECT id, class_id AS classId, code, name, created_at AS createdAt FROM programme_courses ORDER BY code COLLATE NOCASE"
    )
    .all();

  return {
    activeClassId: setting("activeClassId", classes[0] ? classes[0].id : "cs101"),
    classes: classes,
    courses: courseRows,
    students: students,
    sessions: sessions,
    semester: {
      totalWeeks: Number(setting("semester.totalWeeks", "15")) || 15,
      currentWeek: Number(setting("semester.currentWeek", "1")) || 1
    }
  };
}

function saveState(body) {
  openDb();
  importState(body);
  return loadState();
}

function addClass(input) {
  openDb();
  const code = String((input && input.code) || "").trim();
  const name = String((input && input.name) || "").trim();
  if (!code || !name) return { ok: false, error: "Enter programme code and name." };

  const exists = db.prepare("SELECT id FROM classes WHERE code = ? COLLATE NOCASE").get(code);
  if (exists) return { ok: false, error: "That programme code already exists." };

  const baseId = code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "c" + Date.now();
  let id = baseId;
  let suffix = 1;
  while (db.prepare("SELECT id FROM classes WHERE id = ?").get(id)) {
    id = baseId + "-" + suffix;
    suffix += 1;
  }

  const department = String((input && input.department) || "").trim();
  db.prepare("INSERT INTO classes (id, code, name, department) VALUES (?, ?, ?, ?)").run(
    id,
    code,
    name,
    department
  );
  setSetting("activeClassId", id);
  return { ok: true, classId: id, state: loadState() };
}

function updateClass(input) {
  openDb();
  const id = String((input && input.id) || "").trim();
  const code = String((input && input.code) || "").trim();
  const name = String((input && input.name) || "").trim();
  if (!id) return { ok: false, error: "Programme not found." };
  if (!code || !name) return { ok: false, error: "Enter programme code and name." };

  const row = db.prepare("SELECT id FROM classes WHERE id = ?").get(id);
  if (!row) return { ok: false, error: "Programme not found." };

  const duplicate = db
    .prepare("SELECT id FROM classes WHERE code = ? COLLATE NOCASE AND id != ?")
    .get(code, id);
  if (duplicate) return { ok: false, error: "That programme code is already in use." };

  db.prepare("UPDATE classes SET code = ?, name = ? WHERE id = ?").run(code, name, id);
  return { ok: true, classId: id, state: loadState() };
}

function deleteClass(input) {
  openDb();
  const id = String((input && input.id) || "").trim();
  if (!id) return { ok: false, error: "Programme not found." };

  const row = db.prepare("SELECT id FROM classes WHERE id = ?").get(id);
  if (!row) return { ok: false, error: "Programme not found." };

  db.prepare("DELETE FROM classes WHERE id = ?").run(id);

  const remaining = db.prepare("SELECT id FROM classes ORDER BY code LIMIT 1").get();
  setSetting("activeClassId", remaining ? remaining.id : "");

  return { ok: true, state: loadState() };
}

function addStudent(input) {
  openDb();
  const state = loadState();
  const name = String(input.name || "").trim();
  const index = String(input.index || "").trim();
  const classId = input.classId || state.activeClassId || "cs101";
  if (!name || !index) return { ok: false, error: "Enter the student name and index number." };

  const duplicate = db
    .prepare(
      "SELECT id FROM students WHERE class_id = ? AND index_number = ? COLLATE NOCASE AND id != ?"
    )
    .get(classId, index, input.id || "");

  if (duplicate) return { ok: false, error: "That index number is already registered in this class." };

  let student;
  if (input.id) {
    const row = db
      .prepare(
        "SELECT id, class_id AS classId, name, index_number AS studentIndex, email, photo, source, created_at AS createdAt FROM students WHERE id = ?"
      )
      .get(input.id);
    if (!row) return { ok: false, error: "Student record was not found." };
    const photo = input.photo != null && input.photo !== "" ? input.photo : row.photo;
    db.prepare("UPDATE students SET name = ?, index_number = ?, email = ?, photo = ? WHERE id = ?").run(
      name,
      index,
      String(input.email || "").trim(),
      photo,
      input.id
    );
    student = {
      id: row.id,
      classId: row.classId,
      name: name,
      index: index,
      email: String(input.email || "").trim(),
      photo: photo,
      source: row.source,
      createdAt: row.createdAt
    };
  } else {
    const dept = departmentForClass(classId);
    const qrPublicId = findQrPublicIdForDeptIndex(dept, index) || crypto.randomUUID();
    student = {
      id: "s" + Date.now(),
      classId: classId,
      name: name,
      index: index,
      email: String(input.email || "").trim(),
      photo: input.photo || "",
      source: input.source || "lecturer",
      qrPublicId: qrPublicId,
      createdAt: new Date().toISOString()
    };
    db.prepare(
      "INSERT INTO students (id, class_id, name, index_number, email, photo, source, qr_public_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      student.id,
      student.classId,
      student.name,
      student.index,
      student.email,
      student.photo,
      student.source,
      student.qrPublicId,
      student.createdAt
    );
  }

  setSetting("activeClassId", classId);
  return { ok: true, student: student, state: loadState() };
}

function todayDateString() {
  const date = new Date();
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

function normalizeLectureName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

function courseLectureLabel(code, name) {
  const c = String(code || "").trim();
  const n = String(name || "").trim();
  if (c && n) return c + " — " + n;
  return normalizeLectureName(n || c);
}

function programmeCourseById(courseId) {
  return db
    .prepare(
      "SELECT id, class_id AS classId, code, name, created_at AS createdAt FROM programme_courses WHERE id = ?"
    )
    .get(courseId);
}

function addProgrammeCourse(input) {
  openDb();
  const classId = String((input && input.classId) || "").trim();
  const code = String((input && input.code) || "").trim();
  const name = String((input && input.name) || "").trim();
  if (!classId) return { ok: false, error: "Programme not found." };
  if (!code || !name) return { ok: false, error: "Enter course code and name." };

  const programme = db.prepare("SELECT id FROM classes WHERE id = ?").get(classId);
  if (!programme) return { ok: false, error: "Programme not found." };

  const dup = db
    .prepare("SELECT id FROM programme_courses WHERE class_id = ? AND code = ? COLLATE NOCASE")
    .get(classId, code);
  if (dup) return { ok: false, error: "That course code already exists in this programme." };

  const baseId =
    classId +
    "-" +
    code
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  let id = baseId || "course-" + Date.now();
  let suffix = 1;
  while (db.prepare("SELECT id FROM programme_courses WHERE id = ?").get(id)) {
    id = baseId + "-" + suffix;
    suffix += 1;
  }

  const createdAt = new Date().toISOString();
  db.prepare("INSERT INTO programme_courses (id, class_id, code, name, created_at) VALUES (?, ?, ?, ?, ?)").run(
    id,
    classId,
    code,
    name,
    createdAt
  );

  return {
    ok: true,
    courseId: id,
    course: { id: id, classId: classId, code: code, name: name, createdAt: createdAt },
    state: loadState()
  };
}

function resolveLectureForSession(input) {
  const classId = String(input.classId || "").trim();
  const courseId = String(input.courseId || "").trim();
  let lectureName = normalizeLectureName(input.lectureName);
  let resolvedCourseId = courseId || null;

  if (courseId) {
    const row = programmeCourseById(courseId);
    if (!row || row.classId !== classId) {
      return { ok: false, error: "Course not found in this programme." };
    }
    lectureName = courseLectureLabel(row.code, row.name);
    resolvedCourseId = row.id;
  }

  if (!lectureName) {
    return {
      ok: false,
      error: "lecture_name_required",
      message: "Enter the course name or select a registered course."
    };
  }

  const weekNumber =
    input.weekNumber != null && input.weekNumber !== ""
      ? Number(input.weekNumber)
      : Number(setting("semester.currentWeek", "1")) || 1;

  return { ok: true, lectureName: lectureName, weekNumber: weekNumber, courseId: resolvedCourseId };
}

function getOrCreateSessionForClass(classId, sessionDate, lectureName, weekNumber, courseId) {
  const lecture = normalizeLectureName(lectureName);
  const week =
    weekNumber != null && weekNumber !== ""
      ? Number(weekNumber)
      : Number(setting("semester.currentWeek", "1")) || 1;
  const existing = db
    .prepare(
      `SELECT s.id
       FROM attendance_sessions s
       INNER JOIN attendance_session_classes l ON l.session_id = s.id
       WHERE l.class_id = ? AND s.session_date = ? AND s.lecture_name = ? AND s.week_number = ?
       LIMIT 1`
    )
    .get(classId, sessionDate, lecture, week);

  if (existing) return { id: existing.id };

  let sessionId;
  try {
    const info = db
      .prepare(
        "INSERT INTO attendance_sessions (class_id, session_date, lecture_name, week_number, course_id) VALUES (?, ?, ?, ?, ?)"
      )
      .run(classId, sessionDate, lecture, week, courseId || null);
    sessionId = info.lastInsertRowid;
  } catch (error) {
    const msg = String(error && error.message ? error.message : error);
    if (msg.indexOf("UNIQUE constraint failed") !== -1) {
      throw new Error(
        "An attendance session already exists for this programme, date, course, and week. Pick another week or use the existing session."
      );
    }
    throw error;
  }
  db.prepare("INSERT OR IGNORE INTO attendance_session_classes (session_id, class_id) VALUES (?, ?)").run(
    sessionId,
    classId
  );
  return { id: sessionId };
}

function startAttendanceSession(input) {
  openDb();
  const classId = String(input.classId || "").trim();
  if (!classId) return { ok: false, error: "Programme not found." };
  const resolved = resolveLectureForSession(Object.assign({ classId: classId }, input || {}));
  if (!resolved.ok) return resolved;
  if (courseWeekSessionClosed(classId, resolved.lectureName, resolved.weekNumber, resolved.courseId)) {
    return {
      ok: false,
      error: "session_closed",
      message: "Attendance for this week has ended. You cannot take attendance again.",
      state: loadState()
    };
  }
  const sessionDate = todayDateString();
  const existing = findSessionForClass(
    classId,
    sessionDate,
    resolved.lectureName,
    resolved.weekNumber
  );
  if (existing) {
    const meta = db
      .prepare("SELECT closed_at AS closedAt FROM attendance_sessions WHERE id = ?")
      .get(existing.id);
    if (meta && meta.closedAt) {
      return {
        ok: false,
        error: "session_closed",
        message: "Attendance for this week has ended. You cannot take attendance again.",
        state: loadState()
      };
    }
    return {
      ok: true,
      sessionId: existing.id,
      lectureName: resolved.lectureName,
      weekNumber: resolved.weekNumber,
      courseId: resolved.courseId,
      state: loadState()
    };
  }
  const session = getOrCreateSessionForClass(
    classId,
    sessionDate,
    resolved.lectureName,
    resolved.weekNumber,
    resolved.courseId
  );
  return {
    ok: true,
    sessionId: session.id,
    lectureName: resolved.lectureName,
    weekNumber: resolved.weekNumber,
    courseId: resolved.courseId,
    state: loadState()
  };
}

function closeAttendanceSession(input) {
  openDb();
  const classId = String(input.classId || "").trim();
  if (!classId) return { ok: false, error: "Programme not found.", state: loadState() };
  const resolved = resolveLectureForSession(Object.assign({ classId: classId }, input || {}));
  if (!resolved.ok) return Object.assign({ state: loadState() }, resolved);
  const sessionDate = todayDateString();
  let session = findSessionForClass(classId, sessionDate, resolved.lectureName, resolved.weekNumber);
  if (!session) {
    session = getOrCreateSessionForClass(
      classId,
      sessionDate,
      resolved.lectureName,
      resolved.weekNumber,
      resolved.courseId
    );
  }
  const meta = db.prepare("SELECT closed_at AS closedAt FROM attendance_sessions WHERE id = ?").get(session.id);
  if (!meta || !meta.closedAt) {
    db.prepare("UPDATE attendance_sessions SET closed_at = ? WHERE id = ?").run(new Date().toISOString(), session.id);
  }
  return {
    ok: true,
    sessionId: session.id,
    lectureName: resolved.lectureName,
    weekNumber: resolved.weekNumber,
    courseId: resolved.courseId,
    state: loadState()
  };
}

function resolveStudentForScan(input) {
  const qrToken = String(input.qrToken || "").trim();
  const classId = input.classId;
  const index = String(input.index || "").trim();

  if (qrToken) {
    const row = db
      .prepare(
        "SELECT id, class_id AS classId, name, index_number AS studentIndex, email, photo, source, qr_public_id AS qrPublicId, created_at AS createdAt FROM students WHERE qr_public_id = ? LIMIT 1"
      )
      .get(qrToken);
    if (!row) return null;
    return mapStudentRow(row);
  }

  if (classId && index) {
    const row = db
      .prepare(
        "SELECT id, class_id AS classId, name, index_number AS studentIndex, email, photo, source, qr_public_id AS qrPublicId, created_at AS createdAt FROM students WHERE class_id = ? AND index_number = ? COLLATE NOCASE"
      )
      .get(classId, index);
    if (row) return mapStudentRow(row);

    const dept = departmentForClass(classId);
    const deptRow = db
      .prepare(
        `SELECT s.id, s.class_id AS classId, s.name, s.index_number AS studentIndex, s.email, s.photo, s.source,
                s.qr_public_id AS qrPublicId, s.created_at AS createdAt
         FROM students s
         INNER JOIN classes c ON c.id = s.class_id
         WHERE s.index_number = ? COLLATE NOCASE
           AND lower(trim(c.department)) = lower(trim(?))
         LIMIT 1`
      )
      .get(index, dept);
    if (deptRow) return mapStudentRow(deptRow);
  }

  return null;
}

function mapStudentRow(row) {
  return {
    id: row.id,
    classId: row.classId,
    name: row.name,
    index: row.studentIndex,
    email: row.email,
    photo: row.photo,
    source: row.source,
    qrPublicId: row.qrPublicId,
    createdAt: row.createdAt
  };
}

function studentIdsForSharedSession(sessionId, qrPublicId) {
  return db
    .prepare(
      `SELECT s.id
       FROM students s
       INNER JOIN attendance_session_classes l ON l.class_id = s.class_id
       WHERE l.session_id = ? AND s.qr_public_id = ?`
    )
    .all(sessionId, qrPublicId)
    .map(function (r) {
      return r.id;
    });
}

function getSessionDetail(sessionId) {
  openDb();
  const id = Number(sessionId);
  if (!id) return { ok: false, error: "Session not found." };
  const row = db
    .prepare(
      `SELECT s.id AS sessionId, s.class_id AS classId, s.session_date AS date,
              s.lecture_name AS lectureName, s.week_number AS weekNumber
       FROM attendance_sessions s WHERE s.id = ?`
    )
    .get(id);
  if (!row) return { ok: false, error: "Session not found." };

  const records = db
    .prepare(
      `SELECT ar.student_id AS studentId, ar.scanned_at AS scannedAt,
              st.name, st.index_number AS studentIndex, st.email
       FROM attendance_records ar
       INNER JOIN students st ON st.id = ar.student_id
       WHERE ar.session_id = ?
       ORDER BY ar.scanned_at`
    )
    .all(id);

  const classRow = db.prepare("SELECT code, name FROM classes WHERE id = ?").get(row.classId);

  return {
    ok: true,
    session: {
      sessionId: row.sessionId,
      classId: row.classId,
      programmeCode: classRow ? classRow.code : "",
      programmeName: classRow ? classRow.name : "",
      date: row.date,
      lectureName: normalizeLectureName(row.lectureName || ""),
      weekNumber: row.weekNumber,
      records: records
    }
  };
}

function shareSessionClasses(input) {
  openDb();
  const anchorClassId = String(input.anchorClassId || input.classId || "").trim();
  const extra = Array.isArray(input.classIds) ? input.classIds : [];
  const sessionDate = String(input.sessionDate || todayDateString());
  if (!anchorClassId) return { ok: false, error: "anchorClassId is required." };

  const resolved = resolveLectureForSession(Object.assign({ classId: anchorClassId }, input || {}));
  if (!resolved.ok) return resolved;
  const session = getOrCreateSessionForClass(
    anchorClassId,
    sessionDate,
    resolved.lectureName,
    resolved.weekNumber,
    resolved.courseId
  );
  const link = db.prepare("INSERT OR IGNORE INTO attendance_session_classes (session_id, class_id) VALUES (?, ?)");
  extra.forEach(function (cid) {
    const id = String(cid || "").trim();
    if (id && id !== anchorClassId) link.run(session.id, id);
  });

  const linked = db
    .prepare("SELECT class_id AS classId FROM attendance_session_classes WHERE session_id = ?")
    .all(session.id)
    .map(function (r) {
      return r.classId;
    });

  return { ok: true, sessionId: session.id, sessionDate: sessionDate, linkedClassIds: linked, state: loadState() };
}

function courseWeekSessionClosed(classId, lectureName, weekNumber, courseId) {
  const lecture = normalizeLectureName(lectureName);
  const week = Number(weekNumber) || 1;
  let row;
  if (courseId) {
    row = db
      .prepare(
        `SELECT 1 AS hit
         FROM attendance_sessions s
         INNER JOIN attendance_session_classes l ON l.session_id = s.id
         WHERE l.class_id = ? AND s.week_number = ? AND s.course_id = ?
           AND s.closed_at IS NOT NULL AND trim(s.closed_at) != ''
         LIMIT 1`
      )
      .get(classId, week, courseId);
  } else {
    row = db
      .prepare(
        `SELECT 1 AS hit
         FROM attendance_sessions s
         INNER JOIN attendance_session_classes l ON l.session_id = s.id
         WHERE l.class_id = ? AND s.week_number = ? AND s.lecture_name = ?
           AND s.closed_at IS NOT NULL AND trim(s.closed_at) != ''
         LIMIT 1`
      )
      .get(classId, week, lecture);
  }
  return !!row;
}

function findSessionForClass(classId, sessionDate, lectureName, weekNumber) {
  const lecture = normalizeLectureName(lectureName);
  const week =
    weekNumber != null && weekNumber !== ""
      ? Number(weekNumber)
      : Number(setting("semester.currentWeek", "1")) || 1;
  return db
    .prepare(
      `SELECT s.id
       FROM attendance_sessions s
       INNER JOIN attendance_session_classes l ON l.session_id = s.id
       WHERE l.class_id = ? AND s.session_date = ? AND s.lecture_name = ? AND s.week_number = ?
       LIMIT 1`
    )
    .get(classId, sessionDate, lecture, week);
}

function removeAttendanceRecord(input) {
  openDb();
  const classId = String(input.classId || "").trim();
  const studentId = String(input.studentId || "").trim();
  if (!classId || !studentId) return { ok: false, error: "Missing programme or student." };
  const resolved = resolveLectureForSession(Object.assign({ classId: classId }, input || {}));
  if (!resolved.ok) return Object.assign({ state: loadState() }, resolved);
  const session = findSessionForClass(
    classId,
    todayDateString(),
    resolved.lectureName,
    resolved.weekNumber
  );
  if (!session) return { ok: false, error: "No attendance session for today.", state: loadState() };
  db.prepare("DELETE FROM attendance_records WHERE session_id = ? AND student_id = ?").run(session.id, studentId);
  return { ok: true, state: loadState() };
}

function markPresent(input) {
  openDb();
  const scannerClassId = String(input.classId || "").trim();
  const resolved = resolveLectureForSession(Object.assign({ classId: scannerClassId }, input || {}));
  if (!resolved.ok) {
    return Object.assign({ state: loadState() }, resolved);
  }
  const student = resolveStudentForScan(input);
  if (!student) return { ok: false, error: "unknown", state: loadState() };

  if (courseWeekSessionClosed(scannerClassId, resolved.lectureName, resolved.weekNumber, resolved.courseId)) {
    return {
      ok: false,
      error: "session_closed",
      message: "Attendance for this week has ended.",
      state: loadState()
    };
  }

  const sessionDate = todayDateString();
  const session = getOrCreateSessionForClass(
    scannerClassId,
    sessionDate,
    resolved.lectureName,
    resolved.weekNumber,
    resolved.courseId
  );

  const linked = db
    .prepare("SELECT class_id AS classId FROM attendance_session_classes WHERE session_id = ?")
    .all(session.id)
    .map(function (r) {
      return r.classId;
    });

  const enrolledInSession = studentIdsForSharedSession(session.id, student.qrPublicId);
  if (!enrolledInSession.length) {
    return {
      ok: false,
      error: "not_enrolled",
      message: "Student is not enrolled in any course linked to this lecture.",
      state: loadState()
    };
  }

  const canonicalStudentId = enrolledInSession[0];
  const creditedClassIds = db
    .prepare(
      `SELECT DISTINCT s.class_id AS classId
       FROM students s
       INNER JOIN attendance_session_classes l ON l.class_id = s.class_id
       WHERE l.session_id = ? AND s.qr_public_id = ?`
    )
    .all(session.id, student.qrPublicId)
    .map(function (r) {
      return r.classId;
    });

  const existing = db
    .prepare("SELECT scanned_at AS scannedAt FROM attendance_records WHERE session_id = ? AND student_id = ?")
    .get(session.id, canonicalStudentId);

  if (existing) {
    return {
      ok: true,
      duplicate: true,
      student: student,
      creditedClassIds: creditedClassIds,
      linkedClassIds: linked,
      record: { studentId: canonicalStudentId, scannedAt: existing.scannedAt },
      state: loadState()
    };
  }

  const scannedAt = new Date().toISOString();
  db.prepare("INSERT INTO attendance_records (session_id, student_id, scanned_at) VALUES (?, ?, ?)").run(
    session.id,
    canonicalStudentId,
    scannedAt
  );

  return {
    ok: true,
    duplicate: false,
    student: student,
    creditedClassIds: creditedClassIds,
    linkedClassIds: linked,
    record: { studentId: canonicalStudentId, scannedAt: scannedAt },
    state: loadState()
  };
}

// ─── TA Share Tokens ─────────────────────────────────────────────────────────

/**
 * Create a TA access token for a live attendance session.
 * Tokens expire after 12 hours by default (configurable via expiryHours).
 */
function createTaToken(input) {
  openDb();
  const classId = String(input.classId || "").trim();
  const sessionId = Number(input.sessionId);
  if (!classId || !sessionId) return { ok: false, error: "classId and sessionId are required." };

  const session = db.prepare("SELECT id, class_id AS classId, lecture_name AS lectureName, week_number AS weekNumber, course_id AS courseId, closed_at AS closedAt FROM attendance_sessions WHERE id = ?").get(sessionId);
  if (!session) return { ok: false, error: "Session not found." };
  if (session.closedAt) return { ok: false, error: "Session is already closed." };

  const token = crypto.randomUUID() + "-" + crypto.randomBytes(8).toString("hex");
  const now = new Date();
  const expiryHours = Number(input.expiryHours) || 12;
  const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000).toISOString();

  // Reuse existing token if one already exists for this session (idempotent)
  const existing = db.prepare("SELECT token FROM ta_tokens WHERE session_id = ? AND expires_at > ? LIMIT 1").get(sessionId, now.toISOString());
  if (existing) {
    return { ok: true, taToken: existing.token };
  }

  db.prepare(
    "INSERT INTO ta_tokens (token, session_id, class_id, lecture_name, week_number, course_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(token, sessionId, classId, session.lectureName || "", session.weekNumber || 1, session.courseId || null, now.toISOString(), expiresAt);

  return { ok: true, taToken: token };
}

/**
 * Resolve a TA token → session context. Returns null if invalid/expired.
 */
function resolveTaToken(token) {
  openDb();
  if (!token) return null;
  const now = new Date().toISOString();
  const row = db.prepare(
    "SELECT token, session_id AS sessionId, class_id AS classId, lecture_name AS lectureName, week_number AS weekNumber, course_id AS courseId, expires_at AS expiresAt FROM ta_tokens WHERE token = ? AND expires_at > ?"
  ).get(String(token).trim(), now);
  if (!row) return null;
  // Check session not closed
  const session = db.prepare("SELECT closed_at AS closedAt FROM attendance_sessions WHERE id = ?").get(row.sessionId);
  if (!session || session.closedAt) return null;
  return row;
}

/**
 * GET /api/ta/:token — returns session context for a valid TA token.
 */
function getTaSession(token) {
  openDb();
  const ctx = resolveTaToken(token);
  if (!ctx) return { ok: false, error: "invalid_token", message: "This link has expired or the session has ended." };

  const classRow = db.prepare("SELECT id, code, name, department FROM classes WHERE id = ?").get(ctx.classId);
  const records = db.prepare(
    "SELECT ar.student_id AS studentId, ar.scanned_at AS scannedAt, st.name, st.index_number AS studentIndex, st.photo FROM attendance_records ar INNER JOIN students st ON st.id = ar.student_id WHERE ar.session_id = ? ORDER BY ar.scanned_at"
  ).all(ctx.sessionId);

  return {
    ok: true,
    session: {
      sessionId: ctx.sessionId,
      classId: ctx.classId,
      lectureName: normalizeLectureName(ctx.lectureName || ""),
      weekNumber: ctx.weekNumber,
      courseId: ctx.courseId || null,
      programme: classRow ? { code: classRow.code, name: classRow.name } : null,
      records: records
    }
  };
}

module.exports = {
  openDb,
  loadState,
  saveState,
  addClass,
  updateClass,
  deleteClass,
  addStudent,
  markPresent,
  shareSessionClasses,
  getSessionDetail,
  startAttendanceSession,
  closeAttendanceSession,
  addProgrammeCourse,
  courseLectureLabel,
  removeAttendanceRecord,
  createTaToken,
  resolveTaToken,
  getTaSession
};
