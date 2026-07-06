# Academic Transcript Tab — Design Specification
**Project:** Tulsa Job Corps Student Dashboard  
**Feature:** Student Modal — Academic Transcript Tab  
**Version:** 1.0  
**Date:** 2026-07-06  
**Status:** Design Complete / Pre-Development

---

## 1. Overview

The Academic Transcript Tab is a new tab inside the existing student profile
modal on the dashboard. It replaces the Academic Tracker spreadsheet as the
primary interface for viewing and editing student transcript data. The
underlying data remains in the student's named tab inside SS_ACADEMIC — the
dashboard becomes the UI layer on top of that data.

Staff will use this tab to manage courses, hours, credits, start dates, and
completion status. They will never need to open the Academic Tracker
spreadsheet directly.

---

## 2. Where It Lives

The student profile modal currently has no tab structure. This feature adds
tabs to the modal:

| Tab | Contents |
|---|---|
| **Standard View** | Existing student profile data (unchanged) |
| **Academic Transcript** | This feature |
| **TABE Transcript** | TABE scores and history (separate feature) |

The Academic Transcript tab opens when a user clicks "Academic Transcript"
in the modal tab bar.

---

## 3. Data Sources

| Data | Source | Direction |
|---|---|---|
| Student transcript rows | SS_ACADEMIC → student's named tab | Read + Write |
| Course names, categories, IDs | SS_ACADEMIC → Course Catalogue sheet | Read only |
| Standard hours per course | Dashboard master schedule data (already loaded) | Read only |
| Student weekly settings | SS_ACADEMIC → student's named tab (or new Settings tab) | Read + Write |
| TABE data | Existing dashboard pipeline | Read only (separate tab) |

---

## 4. Transcript Tab Layout

### 4.1 Settings Bar (top of tab)

A compact bar above the course list. Controls that drive target date
calculation for all courses on this student.

```
Weekly Hours: [ 20 ]    Active Weeks:  [W1 ✓]  [W2 ✓]  [W3 ✓]  [W4 ✓]
```

- **Weekly Hours** — numeric input, default 20
- **W1/W2/W3/W4** — toggle buttons, represent weeks 1–4 of each month
- Changing either setting instantly recalculates all target dates on the page
- These settings are saved per student back to SS_ACADEMIC

### 4.2 Course List (main body)

Courses are grouped by subject category, not by Year 1 / Year 2 blocks.
Categories display in this order:

1. English
2. Math
3. Science
4. Social Studies
5. Language
6. Fine Arts
7. Electives

Each category renders as a section with a header showing:
- Category name
- Credits earned / credits required (e.g. `3 / 4`)
- Visual progress indicator

Within each category, courses are listed in the order they appear on the
student's transcript sheet.

### 4.3 Course Row (collapsed state)

Each course displays as a single compact row showing:

```
[status icon]  Course Name          Instance   Credits   Target Date / Status
```

**Status icons:**
- ✓ green — Completed
- → blue — In progress (has start date, target date calculated)
- T gray — Transfer / Earned at Other School
- ○ muted — Not started (no start date)

**Target date display:**
- Green pill — target date is in the future
- Red pill — target date has passed (overdue)
- "—" — no start date entered, not calculated
- "Completed" — course is marked done

Clicking anywhere on a course row expands it inline.

### 4.4 Course Row (expanded / edit state)

Clicking a row expands it to show all editable fields. The row does not
navigate away — it expands in place within the list.

**Editable fields:**

| Field | Input Type | Auto-fills From | Notes |
|---|---|---|---|
| Course Name | Searchable dropdown | Course Catalogue | Required |
| Course ID | Text input | Course Catalogue | Auto-fills, editable |
| Category / Subject | Display only | Course Catalogue | Not editable directly |
| Credits | Numeric input | Course Catalogue (units) | Editable |
| Class Hours | Numeric input | Master Schedule data | Editable |
| Start Date | Date picker | — | Required for target date |
| Adjusted Start | Date picker | — | Optional, overrides Start Date |
| Completed | Checkbox | — | Clears target date when checked |
| Earned at Other School | Checkbox | — | Marks as transfer credit |

**Read-only fields in expanded state:**

| Field | Behavior |
|---|---|
| Target Date | Calculates live as hours/dates change. Shows color-coded result. Never manually editable. |
| Class # | Auto-assigned based on position in transcript block |

**Earned at Other School behavior:**
- When checked: hours field grays out, target date clears, course
  renders with "T" transfer icon
- Credit still counts toward category total
- Behaves like completed credit for progress calculations

**Completed behavior:**
- When checked: target date clears, row renders with ✓ icon
- Optionally capture completion date (today by default, editable)

**Save behavior:**
- A "Save" button appears in the expanded row
- On save: writes all fields back to the student's tab in SS_ACADEMIC
- Target date writes back with the rest of the row
- A "Cancel" button discards changes and collapses the row
- Unsaved changes are indicated visually (row border or background shift)

### 4.5 Adding a New Course

An "+ Add Course" button appears at the bottom of each category section
and at the bottom of the full list.

Clicking it appends a new empty expanded row to that category. The teacher:
1. Picks a course name from the dropdown
2. Course ID, category, hours, and credits auto-fill
3. Sets a start date
4. Target date calculates instantly
5. Hits Save

The new course writes to the next available row in the appropriate block
(Block 1: rows 3–26, Block 2: rows 55–77) in SS_ACADEMIC.

### 4.6 Credit Summary Footer

A fixed footer at the bottom of the transcript tab (or sticky at the
bottom of the modal) showing live credit totals:

```
English        3.0 / 4.0   ████████░░
Math           2.5 / 3.0   ████████░
Science        2.0 / 3.0   ██████░░░
Social Studies 2.0 / 3.0   ██████░░░
Language       1.0 / 1.0   ██████████  ✓
Fine Arts      1.0 / 1.0   ██████████  ✓
Electives      5.5 / 8.0   ██████░░░░
```

- Updates live as courses are marked complete or credits are edited
- Only completed courses count toward totals
- Transfer courses count as completed credit

---

## 5. Target Date Engine

The target date calculation is ported directly from the existing
`calculateTargetDate()` function in the Academic Tracker. Logic is
identical — only the execution context changes (client-side JS in the
dashboard instead of server-side Apps Script).

### 5.1 Calculation Rules

- Only runs if: course has hours > 0 AND has a start date AND is not completed
- Uses Adjusted Start if present, otherwise uses Start Date
- Distributes weekly hours across active weekdays in active weeks of the month
- Only counts Monday–Friday
- Skips weeks not marked active in the Settings Bar (W1–W4)
- Walks forward day by day from start date until hours are exhausted
- Result is color coded: green (future), red (past due)

### 5.2 When Target Date Recalculates

- On hours change
- On start date change
- On adjusted start change
- On completed checkbox change
- On weekly hours setting change
- On active weeks setting change
- Target date never recalculates for transfer courses

### 5.3 What Gets Written to the Sheet

On save, target date writes to column K of the student's transcript tab,
same as the existing engine. Color coding is applied to the cell
(green background for on track, red for overdue) to maintain compatibility
with existing sheet-based views.

---

## 6. PDF Export

A "Download Transcript" button in the transcript tab header generates a
PDF that matches the current Master Schedule Builder layout exactly.

### 6.1 PDF Layout

- Mirrors the student's named tab in SS_ACADEMIC
- Block 1: rows 3–26 (Year One courses)
- Block 2: rows 55–77 (Year Two courses)
- All 12 columns: Class #, Course ID, Course Name, Instance, Transfer,
  Subject, Credit, Class Hours, Start Date, Adjusted Start, Target Date,
  Completed
- Credit summary footer at J27:K33
- Student name in header

### 6.2 PDF Generation Method

Uses the existing `generateAllStudentPDFs()` / export logic already in
the Academic Tracker codebase. The dashboard calls a server-side function
passing the student ID, which triggers the export and returns a download
URL or triggers a direct download.

---

## 7. Server-Side Functions Required

These are the new `.gs` functions that need to be added to the dashboard
codebase to support this feature:

| Function | Purpose |
|---|---|
| `getStudentTranscript(studentId)` | Reads all transcript rows from SS_ACADEMIC, returns structured JSON |
| `saveTranscriptRow(studentId, rowData)` | Writes a single course row back to SS_ACADEMIC |
| `addTranscriptRow(studentId, rowData)` | Appends a new course to the next available row |
| `getTranscriptSettings(studentId)` | Reads weekly hours and active weeks for this student |
| `saveTranscriptSettings(studentId, settings)` | Writes weekly hours and active weeks back |
| `getCourseCatalogue()` | Returns full course list with categories and IDs (cached) |
| `exportTranscriptPDF(studentId)` | Triggers PDF generation and returns download URL |

---

## 8. Data Structure

### 8.1 Transcript Row (JSON)

```json
{
  "rowIndex": 3,
  "block": 1,
  "classNumber": 1,
  "courseId": "EN-0003-S1",
  "courseName": "English 1",
  "instance": "S1",
  "transfer": false,
  "subject": "English",
  "credit": 0.5,
  "classHours": 40.5,
  "startDate": "2025-08-15",
  "adjustedStart": null,
  "targetDate": "2025-10-22",
  "completed": true
}
```

### 8.2 Student Settings (JSON)

```json
{
  "weeklyHours": 20,
  "activeWeeks": {
    "w1": true,
    "w2": true,
    "w3": true,
    "w4": false
  }
}
```

### 8.3 Course Catalogue Entry (JSON)

```json
{
  "className": "English 1",
  "category": "English",
  "classId": "EN-0003-S1",
  "standardHours": 40.5,
  "units": 4,
  "lessons": 34
}
```

---

## 9. Migration Notes

- The Academic Tracker spreadsheet continues to function during and after
  this migration. No data moves — the dashboard reads and writes to the
  same tabs the sheet tools use.
- The existing `onEdit` trigger in the Academic Tracker (auto-creates
  student sheets) continues to work independently.
- The existing sidebar tools (Run Target Dates, Run Credits, Health Check)
  continue to work as a fallback during transition.
- Once staff are fully using the dashboard transcript tab, the Academic
  Tracker becomes a read-only backup that nobody needs to open directly.

---

## 10. Out of Scope (This Phase)

These features are noted for future phases and are explicitly not part of
this build:

- Intervention reports (separate feature, Phase 5)
- TABE transcript tab (separate feature)
- Bulk transcript editing across multiple students
- Transcript comparison / historical snapshots
- Student-facing transcript view (student portal)
- Locking / approval workflow for transcript edits

---

## 11. Open Questions

| # | Question | Impact |
|---|---|---|
| 1 | Where do student weekly settings live in SS_ACADEMIC? Currently in PropertiesService keyed by sheet name. Needs a permanent sheet-based home. | Affects `getTranscriptSettings` and `saveTranscriptSettings` |
| 2 | Write-back permissions — does the dashboard's Google account have edit access to SS_ACADEMIC? | Blocks all write functions if not confirmed |
| 3 | Is there a maximum credits required per category that is program-wide, or does it vary per student? | Affects credit summary footer display |

---

*This document represents the complete agreed design for the Academic
Transcript Tab prior to development. Any changes to scope should be
documented here before code is written.*
