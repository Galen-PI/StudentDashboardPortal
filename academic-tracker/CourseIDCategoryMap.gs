/**
 * COURSE_ID_CATEGORY_MAP
 * ------------------------------------------------------------------
 * Hardcoded Course ID -> Transcript Category lookup, replacing the old
 * free-text subject-string matching in TargetDateEngine.calculateCredits().
 *
 * Source: Course Catalogue export (Class Name / Category / Class ID).
 * Generated 2026-07-07 from a full catalogue paste - 1,106 Course IDs,
 * 7 categories, no ID conflicts found during generation.
 *
 * Maintenance:
 *   - Key: Course ID (e.g. 'EN-0003-S1'), Value: Category string.
 *   - Category strings MUST exactly match the categories used elsewhere
 *     in TargetDateEngine (Elective, English, Fine Arts, Language, Math,
 *     Science, Social Studies) since they drive the credit-cap/spillover logic.
 *   - Until the admin UI for mappings exists, add/edit rows directly below.
 *   - Keep entries grouped by category to make hand-editing manageable.
 */
const COURSE_ID_CATEGORY_MAP = {
  // ---- English (16 IDs) ----
  'EN-0001-S1': 'English', // AP English Language and Composition
  'EN-0001-S2': 'English', // AP English Language and Composition
  'EN-0002-S1': 'English', // AP English Literature and Composition
  'EN-0002-S2': 'English', // AP English Literature and Composition
  'EN-0003-S1': 'English', // English 1
  'EN-0003-S2': 'English', // English 1
  'EN-0004-S1': 'English', // English 2
  'EN-0004-S2': 'English', // English 2
  'EN-0005-S1': 'English', // English 3
  'EN-0005-S2': 'English', // English 3
  'EN-0006-S1': 'English', // English 4
  'EN-0006-S2': 'English', // English 4
  'EN-0007-S1': 'English', // IB Language A: Literature
  'EN-0007-S2': 'English', // IB Language A: Literature
  'EN-0008-S1': 'English', // IB Language A: Language and Literature
  'EN-0008-S2': 'English', // IB Language A: Language and Literature

  // ---- Math (54 IDs) ----
  'MA-0001-S1': 'Math', // Pre AP Geometry
  'MA-0001-S2': 'Math', // Pre AP Geometry
  'MA-0002-S1': 'Math', // Advanced / AP / 1B / College-Level
  'MA-0002-S2': 'Math', // Advanced / AP / 1B / College-Level
  'MA-0003-S1': 'Math', // Advanced Studies in Math 1
  'MA-0003-S2': 'Math', // Advanced Studies in Math 1
  'MA-0004-S1': 'Math', // Advanced Studies in Math 2
  'MA-0004-S2': 'Math', // Advanced Studies in Math 2
  'MA-0005-S1': 'Math', // AP Calculus AB
  'MA-0005-S2': 'Math', // AP Calculus AB
  'MA-0006-S1': 'Math', // AP Calculus BC
  'MA-0006-S2': 'Math', // AP Calculus BC
  'MA-0007-S1': 'Math', // AP Precalculus
  'MA-0007-S2': 'Math', // AP Precalculus
  'MA-0008-S1': 'Math', // AP Statistics
  'MA-0008-S2': 'Math', // AP Statistics
  'MA-0009-S1': 'Math', // Calculus
  'MA-0009-S2': 'Math', // Calculus
  'MA-0010-S1': 'Math', // IB Mathematics Applications and 1nterpretation (Standard Level)
  'MA-0010-S2': 'Math', // IB Mathematics Applications and 1nterpretation (Standard Level)
  'MA-0011-S1': 'Math', // IB Mathematics Applications and 1nterpretation (Higher Level)
  'MA-0011-S2': 'Math', // IB Mathematics Applications and 1nterpretation (Higher Level)
  'MA-0012-S1': 'Math', // IB Mathematics Analysis and Approaches (Standard Level)
  'MA-0012-S2': 'Math', // IB Mathematics Analysis and Approaches (Standard Level)
  'MA-0013-S1': 'Math', // IB Mathematics Analysis and Approaches (Higher Level)
  'MA-0013-S2': 'Math', // IB Mathematics Analysis and Approaches (Higher Level)
  'MA-0014-S1': 'Math', // Pre-Calculus
  'MA-0014-S2': 'Math', // Pre-Calculus
  'MA-0015-S1': 'Math', // Trigonometry
  'MA-0015-S2': 'Math', // Trigonometry
  'MA-0016-S1': 'Math', // Statistics and Probability
  'MA-0016-S2': 'Math', // Statistics and Probability
  'MA-0017-S1': 'Math', // Core High School Math
  'MA-0017-S2': 'Math', // Core High School Math
  'MA-0018-S1': 'Math', // Algebra 1
  'MA-0018-S2': 'Math', // Algebra 1
  'MA-0019-S1': 'Math', // Algebra 1A
  'MA-0019-S2': 'Math', // Algebra 1A
  'MA-0020-S1': 'Math', // Algebra 1B
  'MA-0020-S2': 'Math', // Algebra 1B
  'MA-0021-S1': 'Math', // Algebra 2
  'MA-0021-S2': 'Math', // Algebra 2
  'MA-0022-S1': 'Math', // Algebra 3
  'MA-0022-S2': 'Math', // Algebra 3
  'MA-0023-S1': 'Math', // Geometry
  'MA-0023-S2': 'Math', // Geometry
  'MA-0024-S1': 'Math', // Intermediate Algebra
  'MA-0024-S2': 'Math', // Intermediate Algebra
  'MA-0028-S1': 'Math', // Statistics and Probability
  'MA-0028-S2': 'Math', // Statistics and Probability
  'MA-0029-S1': 'Math', // College Career Math Ready
  'MA-0029-S2': 'Math', // College Career Math Ready
  'MA-0030-S1': 'Math', // Mathematics of Personal Finance
  'MA-0030-S2': 'Math', // Mathematics of Personal Finance

  // ---- Science (68 IDs) ----
  'SC-0001-S1': 'Science', // Earth and Space
  'SC-0001-S2': 'Science', // Earth and Space
  'SC-0002-S1': 'Science', // AP Environmental Science
  'SC-0002-S2': 'Science', // AP Environmental Science
  'SC-0003-S1': 'Science', // Astronomy
  'SC-0003-S2': 'Science', // Astronomy
  'SC-0004-S1': 'Science', // Earth & Space
  'SC-0004-S2': 'Science', // Earth & Space
  'SC-0005-S1': 'Science', // Environmental Science
  'SC-0005-S2': 'Science', // Environmental Science
  'SC-0006-S1': 'Science', // Geology
  'SC-0006-S2': 'Science', // Geology
  'SC-0007-S1': 'Science', // Meteorology
  'SC-0007-S2': 'Science', // Meteorology
  'SC-0008-S1': 'Science', // Life Sciences
  'SC-0008-S2': 'Science', // Life Sciences
  'SC-0009-S1': 'Science', // Anatomy & Physiology
  'SC-0009-S2': 'Science', // Anatomy & Physiology
  'SC-0010-S1': 'Science', // AP Biology
  'SC-0010-S2': 'Science', // AP Biology
  'SC-0011-S1': 'Science', // Biology
  'SC-0011-S2': 'Science', // Biology
  'SC-0012-S1': 'Science', // Honors Biology
  'SC-0012-S2': 'Science', // Honors Biology
  'SC-0013-S1': 'Science', // Biology 1B
  'SC-0013-S2': 'Science', // Biology 1B
  'SC-0014-S1': 'Science', // Biology 2
  'SC-0014-S2': 'Science', // Biology 2
  'SC-0015-S1': 'Science', // Biotechnology
  'SC-0015-S2': 'Science', // Biotechnology
  'SC-0016-S1': 'Science', // Pre AP Biology
  'SC-0016-S2': 'Science', // Pre AP Biology
  'SC-0017-S1': 'Science', // Botany
  'SC-0017-S2': 'Science', // Botany
  'SC-0018-S1': 'Science', // Ecology
  'SC-0018-S2': 'Science', // Ecology
  'SC-0019-S1': 'Science', // Forensic Science
  'SC-0019-S2': 'Science', // Forensic Science
  'SC-0020-S1': 'Science', // IB Biology
  'SC-0020-S2': 'Science', // IB Biology
  'SC-0021-S1': 'Science', // Life Science
  'SC-0021-S2': 'Science', // Life Science
  'SC-0022-S1': 'Science', // Microbiology
  'SC-0022-S2': 'Science', // Microbiology
  'SC-0023-S1': 'Science', // Zoology
  'SC-0023-S2': 'Science', // Zoology
  'SC-0024-S1': 'Science', // Physical Science
  'SC-0024-S2': 'Science', // Physical Science
  'SC-0025-S1': 'Science', // Aeronautics
  'SC-0025-S2': 'Science', // Aeronautics
  'SC-0026-S1': 'Science', // AP Chemistry
  'SC-0026-S2': 'Science', // AP Chemistry
  'SC-0027-S1': 'Science', // AP Physics C Electricity and Magnetism
  'SC-0027-S2': 'Science', // AP Physics C Electricity and Magnetism
  'SC-0028-S1': 'Science', // AP Physics C Mechanics
  'SC-0028-S2': 'Science', // AP Physics C Mechanics
  'SC-0029-S1': 'Science', // AP Physics 1 (Algebra-based)
  'SC-0029-S2': 'Science', // AP Physics 1 (Algebra-based)
  'SC-0030-S1': 'Science', // AP Physics 2 (Algebra-based)
  'SC-0030-S2': 'Science', // AP Physics 2 (Algebra-based)
  'SC-0031-S1': 'Science', // Chemistry
  'SC-0031-S2': 'Science', // Chemistry
  'SC-0032-S1': 'Science', // Chemistry 2
  'SC-0032-S2': 'Science', // Chemistry 2
  'SC-0033-S1': 'Science', // IB Chemistry
  'SC-0033-S2': 'Science', // IB Chemistry
  'SC-0034-S1': 'Science', // Physics
  'SC-0034-S2': 'Science', // Physics

  // ---- Social Studies (100 IDs) ----
  'SS-0001-S1': 'Social Studies', // Regional / Cultural Studies
  'SS-0001-S2': 'Social Studies', // Regional / Cultural Studies
  'SS-0002-S1': 'Social Studies', // American Indian Studies
  'SS-0002-S2': 'Social Studies', // American Indian Studies
  'SS-0003-S1': 'Social Studies', // Anthropology
  'SS-0003-S2': 'Social Studies', // Anthropology
  'SS-0004-S1': 'Social Studies', // Asian History
  'SS-0004-S2': 'Social Studies', // Asian History
  'SS-0005-S1': 'Social Studies', // Black History
  'SS-0005-S2': 'Social Studies', // Black History
  'SS-0006-S1': 'Social Studies', // History of Religion
  'SS-0006-S2': 'Social Studies', // History of Religion
  'SS-0007-S1': 'Social Studies', // Local History
  'SS-0007-S2': 'Social Studies', // Local History
  'SS-0008-S1': 'Social Studies', // Military History
  'SS-0008-S2': 'Social Studies', // Military History
  'SS-0009-S1': 'Social Studies', // World Cultures
  'SS-0009-S2': 'Social Studies', // World Cultures
  'SS-0010-S1': 'Social Studies', // World History
  'SS-0010-S2': 'Social Studies', // World History
  'SS-0011-S1': 'Social Studies', // Ancient and Medieval History
  'SS-0011-S2': 'Social Studies', // Ancient and Medieval History
  'SS-0012-S1': 'Social Studies', // AP European History
  'SS-0012-S2': 'Social Studies', // AP European History
  'SS-0013-S1': 'Social Studies', // AP World History
  'SS-0013-S2': 'Social Studies', // AP World History
  'SS-0014-S1': 'Social Studies', // European History
  'SS-0014-S2': 'Social Studies', // European History
  'SS-0015-S1': 'Social Studies', // Modern World History
  'SS-0015-S2': 'Social Studies', // Modern World History
  'SS-0016-S1': 'Social Studies', // 20th Century Totalitarianism
  'SS-0016-S2': 'Social Studies', // 20th Century Totalitarianism
  'SS-0017-S1': 'Social Studies', // U.S. History & Oklahoma History
  'SS-0017-S2': 'Social Studies', // U.S. History & Oklahoma History
  'SS-0018-S1': 'Social Studies', // AP United States History
  'SS-0018-S2': 'Social Studies', // AP United States History
  'SS-0019-S1': 'Social Studies', // US History
  'SS-0019-S2': 'Social Studies', // US History
  'SS-0020-S1': 'Social Studies', // US Government
  'SS-0020-S2': 'Social Studies', // US Government
  'SS-0021-S1': 'Social Studies', // AP United States Government and Politics
  'SS-0021-S2': 'Social Studies', // AP United States Government and Politics
  'SS-0022-S1': 'Social Studies', // Oklahoma History
  'SS-0022-S2': 'Social Studies', // Oklahoma History
  'SS-0023-S1': 'Social Studies', // American Government
  'SS-0023-S2': 'Social Studies', // American Government
  'SS-0024-S1': 'Social Studies', // Civics
  'SS-0024-S2': 'Social Studies', // Civics
  'SS-0025-S1': 'Social Studies', // Political Science
  'SS-0025-S2': 'Social Studies', // Political Science
  'SS-0026-S1': 'Social Studies', // Problems of Democracy
  'SS-0026-S2': 'Social Studies', // Problems of Democracy
  'SS-0027-S1': 'Social Studies', // AP Comparative Government and Politics
  'SS-0027-S2': 'Social Studies', // AP Comparative Government and Politics
  'SS-0028-S1': 'Social Studies', // Economics
  'SS-0028-S2': 'Social Studies', // Economics
  'SS-0029-S1': 'Social Studies', // AP Macroeconomics
  'SS-0029-S2': 'Social Studies', // AP Macroeconomics
  'SS-0030-S1': 'Social Studies', // AP Microeconomics
  'SS-0030-S2': 'Social Studies', // AP Microeconomics
  'SS-0031-S1': 'Social Studies', // IB Economics
  'SS-0031-S2': 'Social Studies', // IB Economics
  'SS-0032-S1': 'Social Studies', // Geography
  'SS-0032-S2': 'Social Studies', // Geography
  'SS-0033-S1': 'Social Studies', // Human Geography
  'SS-0033-S2': 'Social Studies', // Human Geography
  'SS-0034-S1': 'Social Studies', // AP Human Geography
  'SS-0034-S2': 'Social Studies', // AP Human Geography
  'SS-0035-S1': 'Social Studies', // World Geography
  'SS-0035-S2': 'Social Studies', // World Geography
  'SS-0036-S1': 'Social Studies', // IB Geography
  'SS-0036-S2': 'Social Studies', // IB Geography
  'SS-0037-S1': 'Social Studies', // IB Social Sciences
  'SS-0037-S2': 'Social Studies', // IB Social Sciences
  'SS-0038-S1': 'Social Studies', // IB History
  'SS-0038-S2': 'Social Studies', // IB History
  'SS-0039-S1': 'Social Studies', // IB Global Politics
  'SS-0039-S2': 'Social Studies', // IB Global Politics
  'SS-0040-S1': 'Social Studies', // IB Social and Cultural Anthropology
  'SS-0040-S2': 'Social Studies', // IB Social and Cultural Anthropology
  'SS-0041-S1': 'Social Studies', // IB World Religion
  'SS-0041-S2': 'Social Studies', // IB World Religion
  'SS-0042-S1': 'Social Studies', // AP African American Studies
  'SS-0042-S2': 'Social Studies', // AP African American Studies
  'SS-0043-S1': 'Social Studies', // AP Comparative Government and Politics
  'SS-0043-S2': 'Social Studies', // AP Comparative Government and Politics
  'SS-0044-S1': 'Social Studies', // AP European History
  'SS-0044-S2': 'Social Studies', // AP European History
  'SS-0045-S1': 'Social Studies', // AP Human Geography
  'SS-0045-S2': 'Social Studies', // AP Human Geography
  'SS-0046-S1': 'Social Studies', // AP Macroeconomics
  'SS-0046-S2': 'Social Studies', // AP Macroeconomics
  'SS-0047-S1': 'Social Studies', // AP Microeconomics
  'SS-0047-S2': 'Social Studies', // AP Microeconomics
  'SS-0048-S1': 'Social Studies', // AP United States Government and Politics
  'SS-0048-S2': 'Social Studies', // AP United States Government and Politics
  'SS-0049-S1': 'Social Studies', // AP United States History
  'SS-0049-S2': 'Social Studies', // AP United States History
  'SS-0050-S1': 'Social Studies', // AP World History
  'SS-0050-S2': 'Social Studies', // AP World History

  // ---- Fine Arts (286 IDs) ----
  'FA-0001-S1': 'Fine Arts', // Ballet 1
  'FA-0001-S2': 'Fine Arts', // Ballet 1
  'FA-0002-S1': 'Fine Arts', // Ballet 2
  'FA-0002-S2': 'Fine Arts', // Ballet 2
  'FA-0003-S1': 'Fine Arts', // Ballet 3
  'FA-0003-S2': 'Fine Arts', // Ballet 3
  'FA-0004-S1': 'Fine Arts', // Ballet 4
  'FA-0004-S2': 'Fine Arts', // Ballet 4
  'FA-0005-S1': 'Fine Arts', // Color Guard
  'FA-0005-S2': 'Fine Arts', // Color Guard
  'FA-0006-S1': 'Fine Arts', // Dance Appreciation
  'FA-0006-S2': 'Fine Arts', // Dance Appreciation
  'FA-0007-S1': 'Fine Arts', // Dance for Musical Theatre
  'FA-0007-S2': 'Fine Arts', // Dance for Musical Theatre
  'FA-0008-S1': 'Fine Arts', // Dance 1
  'FA-0008-S2': 'Fine Arts', // Dance 1
  'FA-0009-S1': 'Fine Arts', // Dance 2
  'FA-0009-S2': 'Fine Arts', // Dance 2
  'FA-0010-S1': 'Fine Arts', // Dance 3
  'FA-0010-S2': 'Fine Arts', // Dance 3
  'FA-0011-S1': 'Fine Arts', // Dance 4
  'FA-0011-S2': 'Fine Arts', // Dance 4
  'FA-0012-S1': 'Fine Arts', // Dance Improvisation & Composition
  'FA-0012-S2': 'Fine Arts', // Dance Improvisation & Composition
  'FA-0013-S1': 'Fine Arts', // Dance Performance and Production
  'FA-0013-S2': 'Fine Arts', // Dance Performance and Production
  'FA-0014-S1': 'Fine Arts', // Modern Dance 1
  'FA-0014-S2': 'Fine Arts', // Modern Dance 1
  'FA-0015-S1': 'Fine Arts', // Modern Dance 2
  'FA-0015-S2': 'Fine Arts', // Modern Dance 2
  'FA-0016-S1': 'Fine Arts', // Modern Dance 3
  'FA-0016-S2': 'Fine Arts', // Modern Dance 3
  'FA-0017-S1': 'Fine Arts', // Modern Dance 4
  'FA-0017-S2': 'Fine Arts', // Modern Dance 4
  'FA-0018-S1': 'Fine Arts', // Hip Hop 1
  'FA-0018-S2': 'Fine Arts', // Hip Hop 1
  'FA-0019-S1': 'Fine Arts', // Hip Hop 2
  'FA-0019-S2': 'Fine Arts', // Hip Hop 2
  'FA-0020-S1': 'Fine Arts', // Jazz 1
  'FA-0020-S2': 'Fine Arts', // Jazz 1
  'FA-0021-S1': 'Fine Arts', // Jazz 2
  'FA-0021-S2': 'Fine Arts', // Jazz 2
  'FA-0022-S1': 'Fine Arts', // Jazz 3
  'FA-0022-S2': 'Fine Arts', // Jazz 3
  'FA-0023-S1': 'Fine Arts', // Jazz 4
  'FA-0023-S2': 'Fine Arts', // Jazz 4
  'FA-0024-S1': 'Fine Arts', // Tap 1
  'FA-0024-S2': 'Fine Arts', // Tap 1
  'FA-0025-S1': 'Fine Arts', // Tap 2
  'FA-0025-S2': 'Fine Arts', // Tap 2
  'FA-0026-S1': 'Fine Arts', // Acting 1
  'FA-0026-S2': 'Fine Arts', // Acting 1
  'FA-0027-S1': 'Fine Arts', // Acting 2
  'FA-0027-S2': 'Fine Arts', // Acting 2
  'FA-0028-S1': 'Fine Arts', // Acting 3
  'FA-0028-S2': 'Fine Arts', // Acting 3
  'FA-0029-S1': 'Fine Arts', // Acting 4
  'FA-0029-S2': 'Fine Arts', // Acting 4
  'FA-0030-S1': 'Fine Arts', // Drama 1
  'FA-0030-S2': 'Fine Arts', // Drama 1
  'FA-0031-S1': 'Fine Arts', // Drama 2
  'FA-0031-S2': 'Fine Arts', // Drama 2
  'FA-0032-S1': 'Fine Arts', // Drama 3
  'FA-0032-S2': 'Fine Arts', // Drama 3
  'FA-0033-S1': 'Fine Arts', // Drama 4
  'FA-0033-S2': 'Fine Arts', // Drama 4
  'FA-0034-S1': 'Fine Arts', // Speech and Competitive Acting 1
  'FA-0034-S2': 'Fine Arts', // Speech and Competitive Acting 2
  'FA-0035-S1': 'Fine Arts', // Technical Theatre 1
  'FA-0035-S2': 'Fine Arts', // Technical Theatre 1
  'FA-0036-S1': 'Fine Arts', // Technical Theatre 2
  'FA-0036-S2': 'Fine Arts', // Technical Theatre 2
  'FA-0037-S1': 'Fine Arts', // Technical Theatre 3
  'FA-0037-S2': 'Fine Arts', // Technical Theatre 3
  'FA-0038-S1': 'Fine Arts', // Technical Theatre 4
  'FA-0038-S2': 'Fine Arts', // Technical Theatre 4
  'FA-0039-S1': 'Fine Arts', // Vocal Production/Theatre
  'FA-0039-S2': 'Fine Arts', // Vocal Production/Theatre
  'FA-0040-S1': 'Fine Arts', // Humanities 1 (Drama/Theatre Emphasis)
  'FA-0040-S2': 'Fine Arts', // Humanities 1 (Drama/Theatre Emphasis)
  'FA-0041-S1': 'Fine Arts', // Media Arts
  'FA-0041-S2': 'Fine Arts', // Media Arts
  'FA-0042-S1': 'Fine Arts', // Animation 1
  'FA-0042-S2': 'Fine Arts', // Animation 1
  'FA-0043-S1': 'Fine Arts', // Animation 2
  'FA-0043-S2': 'Fine Arts', // Animation 2
  'FA-0044-S1': 'Fine Arts', // Film 1
  'FA-0044-S2': 'Fine Arts', // Film 1
  'FA-0045-S1': 'Fine Arts', // Film 2
  'FA-0045-S2': 'Fine Arts', // Film 2
  'FA-0046-S1': 'Fine Arts', // Graphic Design Form 1
  'FA-0046-S2': 'Fine Arts', // Graphic Design Form 1
  'FA-0047-S1': 'Fine Arts', // Graphic Design Form 2
  'FA-0047-S2': 'Fine Arts', // Graphic Design Form 2
  'FA-0048-S1': 'Fine Arts', // Graphic Design Form 3
  'FA-0048-S2': 'Fine Arts', // Graphic Design Form 3
  'FA-0049-S1': 'Fine Arts', // Graphic Design Form 4
  'FA-0049-S2': 'Fine Arts', // Graphic Design Form 4
  'FA-0050-S1': 'Fine Arts', // Media Arts Comprehensive
  'FA-0050-S2': 'Fine Arts', // Media Arts Comprehensive
  'FA-0051-S1': 'Fine Arts', // Photography 1
  'FA-0051-S2': 'Fine Arts', // Photography 1
  'FA-0052-S1': 'Fine Arts', // Photography 2
  'FA-0052-S2': 'Fine Arts', // Photography 2
  'FA-0053-S1': 'Fine Arts', // Photography 3
  'FA-0053-S2': 'Fine Arts', // Photography 3
  'FA-0054-S1': 'Fine Arts', // Photography 4
  'FA-0054-S2': 'Fine Arts', // Photography 4
  'FA-0055-S1': 'Fine Arts', // Video & Audio Production 1
  'FA-0055-S2': 'Fine Arts', // Video & Audio Production 1
  'FA-0056-S1': 'Fine Arts', // Video & Audio Production 2
  'FA-0056-S2': 'Fine Arts', // Video & Audio Production 2
  'FA-0057-S1': 'Fine Arts', // Music
  'FA-0057-S2': 'Fine Arts', // Music
  'FA-0058-S1': 'Fine Arts', // AP Music Theory
  'FA-0058-S2': 'Fine Arts', // AP Music Theory
  'FA-0059-S1': 'Fine Arts', // Applied Music
  'FA-0059-S2': 'Fine Arts', // Applied Music
  'FA-0060-S1': 'Fine Arts', // Instrumental
  'FA-0060-S2': 'Fine Arts', // Instrumental
  'FA-0061-S1': 'Fine Arts', // Band 1
  'FA-0061-S2': 'Fine Arts', // Band 1
  'FA-0062-S1': 'Fine Arts', // Band 2
  'FA-0062-S2': 'Fine Arts', // Band 2
  'FA-0063-S1': 'Fine Arts', // Band 3
  'FA-0063-S2': 'Fine Arts', // Band 3
  'FA-0064-S1': 'Fine Arts', // Band 4
  'FA-0064-S2': 'Fine Arts', // Band 4
  'FA-0065-S1': 'Fine Arts', // Culturally Influenced Ensemble
  'FA-0065-S2': 'Fine Arts', // Culturally Influenced Ensemble
  'FA-0066-S1': 'Fine Arts', // General Music
  'FA-0066-S2': 'Fine Arts', // General Music
  'FA-0067-S1': 'Fine Arts', // Guitar
  'FA-0067-S2': 'Fine Arts', // Guitar
  'FA-0068-S1': 'Fine Arts', // IB Music
  'FA-0068-S2': 'Fine Arts', // IB Music
  'FA-0069-S1': 'Fine Arts', // Jazz Band 1
  'FA-0069-S2': 'Fine Arts', // Jazz Band 1
  'FA-0070-S1': 'Fine Arts', // Jazz Band 2
  'FA-0070-S2': 'Fine Arts', // Jazz Band 2
  'FA-0071-S1': 'Fine Arts', // Jazz Band 3
  'FA-0071-S2': 'Fine Arts', // Jazz Band 3
  'FA-0072-S1': 'Fine Arts', // Jazz Band 4
  'FA-0072-S2': 'Fine Arts', // Jazz Band 4
  'FA-0073-S1': 'Fine Arts', // Music Appreciation
  'FA-0073-S2': 'Fine Arts', // Music Appreciation
  'FA-0074-S1': 'Fine Arts', // Music History
  'FA-0074-S2': 'Fine Arts', // Music History
  'FA-0075-S1': 'Fine Arts', // Music Immersive Experience
  'FA-0075-S2': 'Fine Arts', // Music Immersive Experience
  'FA-0076-S1': 'Fine Arts', // Music Theory
  'FA-0076-S2': 'Fine Arts', // Music Theory
  'FA-0077-S1': 'Fine Arts', // Orchestra 1
  'FA-0077-S2': 'Fine Arts', // Orchestra 1
  'FA-0078-S1': 'Fine Arts', // Orchestra 2
  'FA-0078-S2': 'Fine Arts', // Orchestra 2
  'FA-0079-S1': 'Fine Arts', // Orchestra 3
  'FA-0079-S2': 'Fine Arts', // Orchestra 3
  'FA-0080-S1': 'Fine Arts', // Orchestra 4
  'FA-0080-S2': 'Fine Arts', // Orchestra 4
  'FA-0081-S1': 'Fine Arts', // Piano
  'FA-0081-S2': 'Fine Arts', // Piano
  'FA-0082-S1': 'Fine Arts', // Show Choir 1
  'FA-0082-S2': 'Fine Arts', // Show Choir 1
  'FA-0083-S1': 'Fine Arts', // Show Choir 2
  'FA-0083-S2': 'Fine Arts', // Show Choir 2
  'FA-0084-S1': 'Fine Arts', // Show Choir 3
  'FA-0084-S2': 'Fine Arts', // Show Choir 3
  'FA-0085-S1': 'Fine Arts', // Show Choir 4
  'FA-0085-S2': 'Fine Arts', // Show Choir 4
  'FA-0086-S1': 'Fine Arts', // Vocal Music 1
  'FA-0086-S2': 'Fine Arts', // Vocal Music 1
  'FA-0087-S1': 'Fine Arts', // Vocal Music 2
  'FA-0087-S2': 'Fine Arts', // Vocal Music 2
  'FA-0088-S1': 'Fine Arts', // Vocal Music 3
  'FA-0088-S2': 'Fine Arts', // Vocal Music 3
  'FA-0089-S1': 'Fine Arts', // Vocal Music 4
  'FA-0089-S2': 'Fine Arts', // Vocal Music 4
  'FA-0090-S1': 'Fine Arts', // Vocal Productions/Theater
  'FA-0090-S2': 'Fine Arts', // Vocal Productions/Theater
  'FA-0091-S1': 'Fine Arts', // Humanities 1 (Music Emphasis)
  'FA-0091-S2': 'Fine Arts', // Humanities 1 (Music Emphasis)
  'FA-0092-S1': 'Fine Arts', // Humanities 2 (Music Emphasis)
  'FA-0092-S2': 'Fine Arts', // Humanities 2 (Music Emphasis)
  'FA-0093-S1': 'Fine Arts', // Intro to Art
  'FA-0093-S2': 'Fine Arts', // Intro to Art
  'FA-0094-S1': 'Fine Arts', // Art 1
  'FA-0094-S2': 'Fine Arts', // Art 1
  'FA-0095-S1': 'Fine Arts', // Art 2
  'FA-0095-S2': 'Fine Arts', // Art 2
  'FA-0096-S1': 'Fine Arts', // Art 3
  'FA-0096-S2': 'Fine Arts', // Art 3
  'FA-0097-S1': 'Fine Arts', // Art 4
  'FA-0097-S2': 'Fine Arts', // Art 4
  'FA-0098-S1': 'Fine Arts', // Art Appreciation
  'FA-0098-S2': 'Fine Arts', // Art Appreciation
  'FA-0099-S1': 'Fine Arts', // Art History
  'FA-0099-S2': 'Fine Arts', // Art History
  'FA-0100-S1': 'Fine Arts', // Digital Art 1
  'FA-0100-S2': 'Fine Arts', // Digital Art 1
  'FA-0101-S1': 'Fine Arts', // AP 2-D Art and Design
  'FA-0101-S2': 'Fine Arts', // AP 2-D Art and Design
  'FA-0102-S1': 'Fine Arts', // AP 3-D Art and Design
  'FA-0102-S2': 'Fine Arts', // AP 3-D Art and Design
  'FA-0103-S1': 'Fine Arts', // AP Art History
  'FA-0103-S2': 'Fine Arts', // AP Art History
  'FA-0104-S1': 'Fine Arts', // AP Studio Art Drawing
  'FA-0104-S2': 'Fine Arts', // AP Studio Art Drawing
  'FA-0105-S1': 'Fine Arts', // IB Arts (Standard Level)
  'FA-0105-S2': 'Fine Arts', // IB Arts (Standard Level)
  'FA-0106-S1': 'Fine Arts', // IB Arts (Higher Level)
  'FA-0106-S2': 'Fine Arts', // IB Arts (Higher Level)
  'FA-0107-S1': 'Fine Arts', // Ceramics/Pottery 1
  'FA-0107-S2': 'Fine Arts', // Ceramics/Pottery 1
  'FA-0108-S1': 'Fine Arts', // Ceramics/Pottery 2
  'FA-0108-S2': 'Fine Arts', // Ceramics/Pottery 2
  'FA-0109-S1': 'Fine Arts', // Ceramics/Pottery 3
  'FA-0109-S2': 'Fine Arts', // Ceramics/Pottery 3
  'FA-0110-S1': 'Fine Arts', // Ceramics/Pottery 4
  'FA-0110-S2': 'Fine Arts', // Ceramics/Pottery 4
  'FA-0111-S1': 'Fine Arts', // Sculpture 1
  'FA-0111-S2': 'Fine Arts', // Sculpture 1
  'FA-0112-S1': 'Fine Arts', // Sculpture 2
  'FA-0112-S2': 'Fine Arts', // Sculpture 2
  'FA-0113-S1': 'Fine Arts', // Sculpture 3
  'FA-0113-S2': 'Fine Arts', // Sculpture 3
  'FA-0114-S1': 'Fine Arts', // Sculpture 4
  'FA-0114-S2': 'Fine Arts', // Sculpture 4
  'FA-0115-S1': 'Fine Arts', // Studio Art 3-D
  'FA-0115-S2': 'Fine Arts', // Studio Art 3-D
  'FA-0116-S1': 'Fine Arts', // Studio Art 3-D Design
  'FA-0116-S2': 'Fine Arts', // Studio Art 3-D Design
  'FA-0117-S1': 'Fine Arts', // Drawing 1
  'FA-0117-S2': 'Fine Arts', // Drawing 1
  'FA-0118-S1': 'Fine Arts', // Drawing 2
  'FA-0118-S2': 'Fine Arts', // Drawing 2
  'FA-0119-S1': 'Fine Arts', // Drawing 3
  'FA-0119-S2': 'Fine Arts', // Drawing 3
  'FA-0120-S1': 'Fine Arts', // Drawing 4
  'FA-0120-S2': 'Fine Arts', // Drawing 4
  'FA-0121-S1': 'Fine Arts', // Painting 1
  'FA-0121-S2': 'Fine Arts', // Painting 1
  'FA-0122-S1': 'Fine Arts', // Painting 2
  'FA-0122-S2': 'Fine Arts', // Painting 2
  'FA-0123-S1': 'Fine Arts', // Painting 3
  'FA-0123-S2': 'Fine Arts', // Painting 3
  'FA-0124-S1': 'Fine Arts', // Painting 4
  'FA-0124-S2': 'Fine Arts', // Painting 4
  'FA-0125-S1': 'Fine Arts', // Photography 1
  'FA-0125-S2': 'Fine Arts', // Photography 1
  'FA-0126-S1': 'Fine Arts', // Photography 2
  'FA-0126-S2': 'Fine Arts', // Photography 2
  'FA-0127-S1': 'Fine Arts', // Photography 3
  'FA-0127-S2': 'Fine Arts', // Photography 3
  'FA-0128-S1': 'Fine Arts', // Photography 4
  'FA-0128-S2': 'Fine Arts', // Photography 4
  'FA-0129-S1': 'Fine Arts', // Media Production
  'FA-0129-S2': 'Fine Arts', // Media Production
  'FA-0130-S1': 'Fine Arts', // Jewelry and Metals 1
  'FA-0130-S2': 'Fine Arts', // Jewelry and Metals 1
  'FA-0131-S1': 'Fine Arts', // Jewelry and Metals 2
  'FA-0131-S2': 'Fine Arts', // Jewelry and Metals 2
  'FA-0132-S1': 'Fine Arts', // Folk/Other Art Forms
  'FA-0132-S2': 'Fine Arts', // Folk/Other Art Forms
  'FA-0133-S1': 'Fine Arts', // Folk Art 1
  'FA-0133-S2': 'Fine Arts', // Folk Art 1
  'FA-0134-S1': 'Fine Arts', // Folk Art 2
  'FA-0134-S2': 'Fine Arts', // Folk Art 2
  'FA-0135-S1': 'Fine Arts', // Folk Art 3
  'FA-0135-S2': 'Fine Arts', // Folk Art 3
  'FA-0136-S1': 'Fine Arts', // Folk Art 4
  'FA-0136-S2': 'Fine Arts', // Folk Art 4
  'FA-0137-S1': 'Fine Arts', // Humanities 1 (Visual Art Emphasis)
  'FA-0137-S2': 'Fine Arts', // Humanities 1 (Visual Art Emphasis)
  'FA-0138-S1': 'Fine Arts', // Humanities 2 (Visual Art Emphasis)
  'FA-0138-S2': 'Fine Arts', // Humanities 2 (Visual Art Emphasis)
  'FA-0139-S1': 'Fine Arts', // 3D Studio Art
  'FA-0139-S2': 'Fine Arts', // 3D Studio Art
  'FA-0140-S1': 'Fine Arts', // Vocal 1
  'FA-0140-S2': 'Fine Arts', // Vocal 1
  'FA-0141-S1': 'Fine Arts', // Vocal 2
  'FA-0141-S2': 'Fine Arts', // Vocal 2
  'FA-0142-S1': 'Fine Arts', // Vocal 3
  'FA-0142-S2': 'Fine Arts', // Vocal 3
  'FA-0143-S1': 'Fine Arts', // Vocal 4
  'FA-0143-S2': 'Fine Arts', // Vocal 4

  // ---- Language (246 IDs) ----
  'LA-0001-S1': 'Language', // AP Seminar
  'LA-0001-S2': 'Language', // AP Seminar
  'LA-0002-S1': 'Language', // AP Research
  'LA-0002-S2': 'Language', // AP Research
  'LA-0003-S1': 'Language', // IB Theory of Knowledge
  'LA-0003-S2': 'Language', // IB Theory of Knowledge
  'LA-0004-S1': 'Language', // AP Chinese Language and Culture
  'LA-0004-S2': 'Language', // AP Chinese Language and Culture
  'LA-0005-S1': 'Language', // AP French Language and Culture
  'LA-0005-S2': 'Language', // AP French Language and Culture
  'LA-0006-S1': 'Language', // AP German Language and Culture
  'LA-0006-S2': 'Language', // AP German Language and Culture
  'LA-0007-S1': 'Language', // AP 1talian Language and Culture
  'LA-0007-S2': 'Language', // AP 1talian Language and Culture
  'LA-0008-S1': 'Language', // AP Japanese Language and Culture
  'LA-0008-S2': 'Language', // AP Japanese Language and Culture
  'LA-0009-S1': 'Language', // AP Latin
  'LA-0009-S2': 'Language', // AP Latin
  'LA-0010-S1': 'Language', // AP Spanish Language and Culture
  'LA-0010-S2': 'Language', // AP Spanish Language and Culture
  'LA-0011-S1': 'Language', // AP Spanish Literature and Culture
  'LA-0011-S2': 'Language', // AP Spanish Literature and Culture
  'LA-0012-S1': 'Language', // World Languages Modern
  'LA-0012-S2': 'Language', // World Languages Modern
  'LA-0013-S1': 'Language', // Chinese 1
  'LA-0013-S2': 'Language', // Chinese 1
  'LA-0014-S1': 'Language', // Chinese 2
  'LA-0014-S2': 'Language', // Chinese 2
  'LA-0015-S1': 'Language', // Chinese 3
  'LA-0015-S2': 'Language', // Chinese 3
  'LA-0016-S1': 'Language', // Chinese 4
  'LA-0016-S2': 'Language', // Chinese 4
  'LA-0017-S1': 'Language', // French 1
  'LA-0017-S2': 'Language', // French 1
  'LA-0018-S1': 'Language', // French 2
  'LA-0018-S2': 'Language', // French 2
  'LA-0019-S1': 'Language', // French 3
  'LA-0019-S2': 'Language', // French 3
  'LA-0020-S1': 'Language', // French 4
  'LA-0020-S2': 'Language', // French 4
  'LA-0021-S1': 'Language', // German 1
  'LA-0021-S2': 'Language', // German 1
  'LA-0022-S1': 'Language', // German 2
  'LA-0022-S2': 'Language', // German 2
  'LA-0023-S1': 'Language', // German 3
  'LA-0023-S2': 'Language', // German 3
  'LA-0024-S1': 'Language', // German 4
  'LA-0024-S2': 'Language', // German 4
  'LA-0025-S1': 'Language', // Italian 1
  'LA-0025-S2': 'Language', // Italian 1
  'LA-0026-S1': 'Language', // Italian 2
  'LA-0026-S2': 'Language', // Italian 2
  'LA-0027-S1': 'Language', // Japanese 1
  'LA-0027-S2': 'Language', // Japanese 1
  'LA-0028-S1': 'Language', // Japanese 2
  'LA-0028-S2': 'Language', // Japanese 2
  'LA-0029-S1': 'Language', // Japanese 3
  'LA-0029-S2': 'Language', // Japanese 3
  'LA-0030-S1': 'Language', // Japanese 4
  'LA-0030-S2': 'Language', // Japanese 4
  'LA-0031-S1': 'Language', // Russian 1
  'LA-0031-S2': 'Language', // Russian 1
  'LA-0032-S1': 'Language', // Russian 2
  'LA-0032-S2': 'Language', // Russian 2
  'LA-0033-S1': 'Language', // Russian 3
  'LA-0033-S2': 'Language', // Russian 3
  'LA-0034-S1': 'Language', // Russian 4
  'LA-0034-S2': 'Language', // Russian 4
  'LA-0035-S1': 'Language', // Spanish 1
  'LA-0035-S2': 'Language', // Spanish 1
  'LA-0036-S1': 'Language', // Spanish 2
  'LA-0036-S2': 'Language', // Spanish 2
  'LA-0037-S1': 'Language', // Spanish 3
  'LA-0037-S2': 'Language', // Spanish 3
  'LA-0038-S1': 'Language', // Spanish 4
  'LA-0038-S2': 'Language', // Spanish 4
  'LA-0039-S1': 'Language', // Turkish 1
  'LA-0039-S2': 'Language', // Turkish 1
  'LA-0040-S1': 'Language', // Turkish 2
  'LA-0040-S2': 'Language', // Turkish 2
  'LA-0041-S1': 'Language', // Other World Language (OSDE Approval)
  'LA-0041-S2': 'Language', // Other World Language (OSDE Approval)
  'LA-0042-S1': 'Language', // IB World Languages
  'LA-0042-S2': 'Language', // IB World Languages
  'LA-0043-S1': 'Language', // IB Chinese Language A: Literature
  'LA-0043-S2': 'Language', // IB Chinese Language A: Literature
  'LA-0044-S1': 'Language', // IB Chinese Language B
  'LA-0044-S2': 'Language', // IB Chinese Language B
  'LA-0045-S1': 'Language', // IB French Language A: Literature
  'LA-0045-S2': 'Language', // IB French Language A: Literature
  'LA-0046-S1': 'Language', // IB French Language B
  'LA-0046-S2': 'Language', // IB French Language B
  'LA-0047-S1': 'Language', // IB German Language A: Literature
  'LA-0047-S2': 'Language', // IB German Language A: Literature
  'LA-0048-S1': 'Language', // IB German Language B
  'LA-0048-S2': 'Language', // IB German Language B
  'LA-0049-S1': 'Language', // IB Japanese Language A: Literature
  'LA-0049-S2': 'Language', // IB Japanese Language A: Literature
  'LA-0050-S1': 'Language', // IB Japanese Language B
  'LA-0050-S2': 'Language', // IB Japanese Language B
  'LA-0051-S1': 'Language', // IB Spanish Language A: Literature
  'LA-0051-S2': 'Language', // IB Spanish Language A: Literature
  'LA-0052-S1': 'Language', // IB Spanish Language B
  'LA-0052-S2': 'Language', // IB Spanish Language B
  'LA-0053-S1': 'Language', // IB Latin
  'LA-0053-S2': 'Language', // IB Latin
  'LA-0054-S1': 'Language', // Native American Languages
  'LA-0054-S2': 'Language', // Native American Languages
  'LA-0055-S1': 'Language', // Arapaho 1
  'LA-0055-S2': 'Language', // Arapaho 1
  'LA-0056-S1': 'Language', // Arapaho 2
  'LA-0056-S2': 'Language', // Arapaho 2
  'LA-0057-S1': 'Language', // Arapaho 3
  'LA-0057-S2': 'Language', // Arapaho 3
  'LA-0058-S1': 'Language', // Arapaho 4
  'LA-0058-S2': 'Language', // Arapaho 4
  'LA-0059-S1': 'Language', // Cherokee 1
  'LA-0059-S2': 'Language', // Cherokee 1
  'LA-0060-S1': 'Language', // Cherokee 2
  'LA-0060-S2': 'Language', // Cherokee 2
  'LA-0061-S1': 'Language', // Cherokee 3
  'LA-0061-S2': 'Language', // Cherokee 3
  'LA-0062-S1': 'Language', // Cherokee 4
  'LA-0062-S2': 'Language', // Cherokee 4
  'LA-0063-S1': 'Language', // Chickasaw 1
  'LA-0063-S2': 'Language', // Chickasaw 1
  'LA-0064-S1': 'Language', // Chickasaw 2
  'LA-0064-S2': 'Language', // Chickasaw 2
  'LA-0065-S1': 'Language', // Chickasaw 3
  'LA-0065-S2': 'Language', // Chickasaw 3
  'LA-0066-S1': 'Language', // Chickasaw 4
  'LA-0066-S2': 'Language', // Chickasaw 4
  'LA-0067-S1': 'Language', // Choctaw 1
  'LA-0067-S2': 'Language', // Choctaw 1
  'LA-0068-S1': 'Language', // Choctaw 2
  'LA-0068-S2': 'Language', // Choctaw 2
  'LA-0069-S1': 'Language', // Choctaw 3
  'LA-0069-S2': 'Language', // Choctaw 3
  'LA-0070-S1': 'Language', // Choctaw 4
  'LA-0070-S2': 'Language', // Choctaw 4
  'LA-0071-S1': 'Language', // Comanche 1
  'LA-0071-S2': 'Language', // Comanche 1
  'LA-0072-S1': 'Language', // Comanche 2
  'LA-0072-S2': 'Language', // Comanche 2
  'LA-0073-S1': 'Language', // Comanche 3
  'LA-0073-S2': 'Language', // Comanche 3
  'LA-0074-S1': 'Language', // Comanche 4
  'LA-0074-S2': 'Language', // Comanche 4
  'LA-0075-S1': 'Language', // Kiowa 1
  'LA-0075-S2': 'Language', // Kiowa 1
  'LA-0076-S1': 'Language', // Kiowa 2
  'LA-0076-S2': 'Language', // Kiowa 2
  'LA-0077-S1': 'Language', // Kiowa 3
  'LA-0077-S2': 'Language', // Kiowa 3
  'LA-0078-S1': 'Language', // Kiowa 4
  'LA-0078-S2': 'Language', // Kiowa 4
  'LA-0079-S1': 'Language', // Maskoke-Seminole 1
  'LA-0079-S2': 'Language', // Maskoke-Seminole 1
  'LA-0080-S1': 'Language', // Maskoke-Seminole 2
  'LA-0080-S2': 'Language', // Maskoke-Seminole 2
  'LA-0081-S1': 'Language', // Maskoke-Seminole 3
  'LA-0081-S2': 'Language', // Maskoke-Seminole 3
  'LA-0082-S1': 'Language', // Maskoke-Seminole 4
  'LA-0082-S2': 'Language', // Maskoke-Seminole 4
  'LA-0083-S1': 'Language', // Mvskoke 1
  'LA-0083-S2': 'Language', // Mvskoke 1
  'LA-0084-S1': 'Language', // Mvskoke 2
  'LA-0084-S2': 'Language', // Mvskoke 2
  'LA-0085-S1': 'Language', // Mvskoke 3
  'LA-0085-S2': 'Language', // Mvskoke 3
  'LA-0086-S1': 'Language', // Mvskoke 4
  'LA-0086-S2': 'Language', // Mvskoke 4
  'LA-0087-S1': 'Language', // Osage 1
  'LA-0087-S2': 'Language', // Osage 1
  'LA-0088-S1': 'Language', // Osage 2
  'LA-0088-S2': 'Language', // Osage 2
  'LA-0089-S1': 'Language', // Osage 3
  'LA-0089-S2': 'Language', // Osage 3
  'LA-0090-S1': 'Language', // Osage 4
  'LA-0090-S2': 'Language', // Osage 4
  'LA-0091-S1': 'Language', // Pawnee 1
  'LA-0091-S2': 'Language', // Pawnee 1
  'LA-0092-S1': 'Language', // Pawnee 2
  'LA-0092-S2': 'Language', // Pawnee 2
  'LA-0093-S1': 'Language', // Pawnee 3
  'LA-0093-S2': 'Language', // Pawnee 3
  'LA-0094-S1': 'Language', // Pawnee 4
  'LA-0094-S2': 'Language', // Pawnee 4
  'LA-0095-S1': 'Language', // Sauk 1
  'LA-0095-S2': 'Language', // Sauk 1
  'LA-0096-S1': 'Language', // Sauk 2
  'LA-0096-S2': 'Language', // Sauk 2
  'LA-0097-S1': 'Language', // Sauk 3
  'LA-0097-S2': 'Language', // Sauk 3
  'LA-0098-S1': 'Language', // Sauk 4
  'LA-0098-S2': 'Language', // Sauk 4
  'LA-0099-S1': 'Language', // Potawatomi 1
  'LA-0099-S2': 'Language', // Potawatomi 1
  'LA-0100-S1': 'Language', // Potawatomi 2
  'LA-0100-S2': 'Language', // Potawatomi 2
  'LA-0101-S1': 'Language', // Classical Languages
  'LA-0101-S2': 'Language', // Classical Languages
  'LA-0102-S1': 'Language', // Greek 1
  'LA-0102-S2': 'Language', // Greek 1
  'LA-0103-S1': 'Language', // Greek 2
  'LA-0103-S2': 'Language', // Greek 2
  'LA-0104-S1': 'Language', // Latin 1
  'LA-0104-S2': 'Language', // Latin 1
  'LA-0105-S1': 'Language', // Latin 2
  'LA-0105-S2': 'Language', // Latin 2
  'LA-0106-S1': 'Language', // Latin 3
  'LA-0106-S2': 'Language', // Latin 3
  'LA-0107-S1': 'Language', // Latin 4
  'LA-0107-S2': 'Language', // Latin 4
  'LA-0108-S1': 'Language', // IB Latin
  'LA-0108-S2': 'Language', // IB Latin
  'LA-0109-S1': 'Language', // Heritage
  'LA-0109-S2': 'Language', // Heritage
  'LA-0110-S1': 'Language', // Heritage Spanish 1
  'LA-0110-S2': 'Language', // Heritage Spanish 1
  'LA-0111-S1': 'Language', // Heritage Spanish 2
  'LA-0111-S2': 'Language', // Heritage Spanish 2
  'LA-0112-S1': 'Language', // American Sign Language (ASL)
  'LA-0112-S2': 'Language', // American Sign Language (ASL)
  'LA-0113-S1': 'Language', // American Sign Language 1
  'LA-0113-S2': 'Language', // American Sign Language 1
  'LA-0114-S1': 'Language', // American Sign Language 2
  'LA-0114-S2': 'Language', // American Sign Language 2
  'LA-0115-S1': 'Language', // American Sign Language 3
  'LA-0115-S2': 'Language', // American Sign Language 3
  'LA-0116-S1': 'Language', // American Sign Language 4
  'LA-0116-S2': 'Language', // American Sign Language 4
  'LA-0117-S1': 'Language', // Advanced Programming
  'LA-0117-S2': 'Language', // Advanced Programming
  'LA-0118-S1': 'Language', // Computer Science 1
  'LA-0118-S2': 'Language', // Computer Science 1
  'LA-0119-S1': 'Language', // Computer Science 2
  'LA-0119-S2': 'Language', // Computer Science 2
  'LA-0120-S1': 'Language', // Computer Applications
  'LA-0120-S2': 'Language', // Computer Applications
  'LA-0121-S1': 'Language', // Desktops Publishing
  'LA-0121-S2': 'Language', // Desktops Publishing
  'LA-0122-S1': 'Language', // Introduction to Information Technology
  'LA-0122-S2': 'Language', // Introduction to Information Technology
  'LA-0123-S1': 'Language', // Fundamentals of Technology
  'LA-0123-S2': 'Language', // Fundamentals of Technology

  // ---- Elective (336 IDs) ----
  'EL-0001-S1': 'Elective', // Intro to Spreadsheets
  'EL-0001-S2': 'Elective', // Intro to Spreadsheets
  'EL-0002-S1': 'Elective', // Financial Literacy
  'EL-0002-S2': 'Elective', // Financial Literacy
  'EL-0003-S1': 'Elective', // Reading Intervention
  'EL-0003-S2': 'Elective', // Reading Intervention
  'EL-0004-S1': 'Elective', // Advanced Writing
  'EL-0004-S2': 'Elective', // Advanced Writing
  'EL-0005-S1': 'Elective', // American Literature
  'EL-0005-S2': 'Elective', // American Literature
  'EL-0006-S1': 'Elective', // Applied Communications
  'EL-0006-S2': 'Elective', // Applied Communications
  'EL-0007-S1': 'Elective', // Creative Writing
  'EL-0007-S2': 'Elective', // Creative Writing
  'EL-0008-S1': 'Elective', // English Language Arts Remediation
  'EL-0008-S2': 'Elective', // English Language Arts Remediation
  'EL-0009-S1': 'Elective', // English Learners
  'EL-0009-S2': 'Elective', // English Learners
  'EL-0010-S1': 'Elective', // Journalism 1
  'EL-0010-S2': 'Elective', // Journalism 1
  'EL-0011-S1': 'Elective', // Jounralism 2
  'EL-0011-S2': 'Elective', // Jounralism 2
  'EL-0012-S1': 'Elective', // Jounralism 3
  'EL-0012-S2': 'Elective', // Jounralism 3
  'EL-0013-S1': 'Elective', // Jounralism 4
  'EL-0013-S2': 'Elective', // Jounralism 4
  'EL-0014-S1': 'Elective', // Library Science
  'EL-0014-S2': 'Elective', // Library Science
  'EL-0015-S1': 'Elective', // Mythology
  'EL-0015-S2': 'Elective', // Mythology
  'EL-0016-S1': 'Elective', // Newspaper
  'EL-0016-S2': 'Elective', // Newspaper
  'EL-0017-S1': 'Elective', // Reading
  'EL-0017-S2': 'Elective', // Reading
  'EL-0018-S1': 'Elective', // Reading Remediation
  'EL-0018-S2': 'Elective', // Reading Remediation
  'EL-0019-S1': 'Elective', // World Literature
  'EL-0019-S2': 'Elective', // World Literature
  'EL-0020-S1': 'Elective', // Yearbook
  'EL-0020-S2': 'Elective', // Yearbook
  'EL-0021-S1': 'Elective', // Family and Consumer Sciences
  'EL-0021-S2': 'Elective', // Family and Consumer Sciences
  'EL-0022-S1': 'Elective', // Family and Consumer Sciences 1
  'EL-0022-S2': 'Elective', // Family and Consumer Sciences 1
  'EL-0023-S1': 'Elective', // Family and Consumer Sciences 2
  'EL-0023-S2': 'Elective', // Family and Consumer Sciences 2
  'EL-0024-S1': 'Elective', // Family and Consumer Sciences 3
  'EL-0024-S2': 'Elective', // Family and Consumer Sciences 3
  'EL-0025-S1': 'Elective', // Family and Consumer Sciences 4
  'EL-0025-S2': 'Elective', // Family and Consumer Sciences 4
  'EL-0026-S1': 'Elective', // Family Relations/Marriage and Family
  'EL-0026-S2': 'Elective', // Family Relations/Marriage and Family
  'EL-0027-S1': 'Elective', // Flag Corps/Drill Team
  'EL-0027-S2': 'Elective', // Flag Corps/Drill Team
  'EL-0028-S1': 'Elective', // Humanities
  'EL-0028-S2': 'Elective', // Humanities
  'EL-0029-S1': 'Elective', // Competitive Athletics 1
  'EL-0029-S2': 'Elective', // Competitive Athletics 1
  'EL-0030-S1': 'Elective', // Cardio Conditioning 1
  'EL-0030-S2': 'Elective', // Cardio Conditioning 1
  'EL-0031-S1': 'Elective', // Health
  'EL-0031-S2': 'Elective', // Health
  'EL-0032-S1': 'Elective', // Healthy Living
  'EL-0032-S2': 'Elective', // Healthy Living
  'EL-0033-S1': 'Elective', // Lifetime Fitness 1
  'EL-0033-S2': 'Elective', // Lifetime Fitness 1
  'EL-0034-S1': 'Elective', // Lifetime Fitness 2
  'EL-0034-S2': 'Elective', // Lifetime Fitness 2
  'EL-0035-S1': 'Elective', // Lifetime Fitness A
  'EL-0035-S2': 'Elective', // Lifetime Fitness A
  'EL-0036-S1': 'Elective', // Lifetime Fitness B
  'EL-0036-S2': 'Elective', // Lifetime Fitness B
  'EL-0037-S1': 'Elective', // PE
  'EL-0037-S2': 'Elective', // PE
  'EL-0038-S1': 'Elective', // Weights 1
  'EL-0038-S2': 'Elective', // Weights 1
  'EL-0039-S1': 'Elective', // Walking and Jogging
  'EL-0039-S2': 'Elective', // Walking and Jogging
  'EL-0040-S1': 'Elective', // Study Skills
  'EL-0040-S2': 'Elective', // Study Skills
  'EL-0041-S1': 'Elective', // Industrial Arts / Technology Education
  'EL-0041-S2': 'Elective', // Industrial Arts / Technology Education
  'EL-0042-S1': 'Elective', // Architecture 1
  'EL-0042-S2': 'Elective', // Architecture 1
  'EL-0043-S1': 'Elective', // Auto Mechanics 1
  'EL-0043-S2': 'Elective', // Auto Mechanics 1
  'EL-0044-S1': 'Elective', // Auto Mechanics 2
  'EL-0044-S2': 'Elective', // Auto Mechanics 2
  'EL-0045-S1': 'Elective', // Communications 1
  'EL-0045-S2': 'Elective', // Communications 1
  'EL-0046-S1': 'Elective', // Communications 2
  'EL-0046-S2': 'Elective', // Communications 2
  'EL-0047-S1': 'Elective', // Construction 1
  'EL-0047-S2': 'Elective', // Construction 1
  'EL-0048-S1': 'Elective', // Construction 2
  'EL-0048-S2': 'Elective', // Construction 2
  'EL-0049-S1': 'Elective', // Drafting 1
  'EL-0049-S2': 'Elective', // Drafting 1
  'EL-0050-S1': 'Elective', // Drafting 2
  'EL-0050-S2': 'Elective', // Drafting 2
  'EL-0051-S1': 'Elective', // Drafting 3
  'EL-0051-S2': 'Elective', // Drafting 3
  'EL-0052-S1': 'Elective', // Drafting 4
  'EL-0052-S2': 'Elective', // Drafting 4
  'EL-0053-S1': 'Elective', // General Technology 1
  'EL-0053-S2': 'Elective', // General Technology 1
  'EL-0054-S1': 'Elective', // General Technology 2
  'EL-0054-S2': 'Elective', // General Technology 2
  'EL-0055-S1': 'Elective', // General Technology 3
  'EL-0055-S2': 'Elective', // General Technology 3
  'EL-0056-S1': 'Elective', // General Technology 4
  'EL-0056-S2': 'Elective', // General Technology 4
  'EL-0057-S1': 'Elective', // Manufacturing 1
  'EL-0057-S2': 'Elective', // Manufacturing 1
  'EL-0058-S1': 'Elective', // Manufacturing 2
  'EL-0058-S2': 'Elective', // Manufacturing 2
  'EL-0059-S1': 'Elective', // Materials and Processes
  'EL-0059-S2': 'Elective', // Materials and Processes
  'EL-0060-S1': 'Elective', // Mechanical Power Systems
  'EL-0060-S2': 'Elective', // Mechanical Power Systems
  'EL-0061-S1': 'Elective', // Metal Technology 1
  'EL-0061-S2': 'Elective', // Metal Technology 1
  'EL-0062-S1': 'Elective', // Metal Technology 2
  'EL-0062-S2': 'Elective', // Metal Technology 2
  'EL-0063-S1': 'Elective', // Printing 1
  'EL-0063-S2': 'Elective', // Printing 1
  'EL-0064-S1': 'Elective', // Small Engines
  'EL-0064-S2': 'Elective', // Small Engines
  'EL-0065-S1': 'Elective', // Transportation and Power 1
  'EL-0065-S2': 'Elective', // Transportation and Power 1
  'EL-0066-S1': 'Elective', // Transportation and Power 2
  'EL-0066-S2': 'Elective', // Transportation and Power 2
  'EL-0067-S1': 'Elective', // Wood Technology 1
  'EL-0067-S2': 'Elective', // Wood Technology 1
  'EL-0068-S1': 'Elective', // Wood Technology 2
  'EL-0068-S2': 'Elective', // Wood Technology 2
  'EL-0069-S1': 'Elective', // Wood Technology 3
  'EL-0069-S2': 'Elective', // Wood Technology 3
  'EL-0070-S1': 'Elective', // Wood Technology 4
  'EL-0070-S2': 'Elective', // Wood Technology 4
  'EL-0071-S1': 'Elective', // Pre-Algebra
  'EL-0071-S2': 'Elective', // Pre-Algebra
  'EL-0072-S1': 'Elective', // Career / Applied / Consumer Math
  'EL-0072-S2': 'Elective', // Career / Applied / Consumer Math
  'EL-0073-S1': 'Elective', // College Career Math Ready
  'EL-0073-S2': 'Elective', // College Career Math Ready
  'EL-0074-S1': 'Elective', // Consumer Math
  'EL-0074-S2': 'Elective', // Consumer Math
  'EL-0075-S1': 'Elective', // Mathematics of Finance
  'EL-0075-S2': 'Elective', // Mathematics of Finance
  'EL-0076-S1': 'Elective', // Applied Math 1
  'EL-0076-S2': 'Elective', // Applied Math 1
  'EL-0077-S1': 'Elective', // Applied Math 2
  'EL-0077-S2': 'Elective', // Applied Math 2
  'EL-0078-S1': 'Elective', // General Math
  'EL-0078-S2': 'Elective', // General Math
  'EL-0079-S1': 'Elective', // Math Remediation
  'EL-0079-S2': 'Elective', // Math Remediation
  'EL-0080-S1': 'Elective', // Electronics
  'EL-0080-S2': 'Elective', // Electronics
  'EL-0081-S1': 'Elective', // General Science
  'EL-0081-S2': 'Elective', // General Science
  'EL-0082-S1': 'Elective', // Agriscience
  'EL-0082-S2': 'Elective', // Agriscience
  'EL-0083-S1': 'Elective', // Pre-Biology 1
  'EL-0083-S2': 'Elective', // Pre-Biology 1
  'EL-0084-S1': 'Elective', // Principles of Technology
  'EL-0084-S2': 'Elective', // Principles of Technology
  'EL-0085-S1': 'Elective', // Psychology
  'EL-0085-S2': 'Elective', // Psychology
  'EL-0086-S1': 'Elective', // AP Psychology
  'EL-0086-S2': 'Elective', // AP Psychology
  'EL-0087-S1': 'Elective', // IB Psychology
  'EL-0087-S2': 'Elective', // IB Psychology
  'EL-0088-S1': 'Elective', // Sociology
  'EL-0088-S2': 'Elective', // Sociology
  'EL-0089-S1': 'Elective', // Current Issues & Events
  'EL-0089-S2': 'Elective', // Current Issues & Events
  'EL-0090-S1': 'Elective', // International Problems
  'EL-0090-S2': 'Elective', // International Problems
  'EL-0091-S1': 'Elective', // Problems of Democracy
  'EL-0091-S2': 'Elective', // Problems of Democracy
  'EL-0092-S1': 'Elective', // Philosophy
  'EL-0092-S2': 'Elective', // Philosophy
  'EL-0093-S1': 'Elective', // IB Philosophy
  'EL-0093-S2': 'Elective', // IB Philosophy
  'EL-0094-S1': 'Elective', // Criminology
  'EL-0094-S2': 'Elective', // Criminology
  'EL-0095-S1': 'Elective', // Street Law
  'EL-0095-S2': 'Elective', // Street Law
  'EL-0096-S1': 'Elective', // Consumer Law
  'EL-0096-S2': 'Elective', // Consumer Law
  'EL-0098-S1': 'Elective', // ASL
  'EL-0098-S2': 'Elective', // ASL
  'EL-0099-S1': 'Elective', // Native American Language
  'EL-0099-S2': 'Elective', // Native American Language
  'EL-0100-S1': 'Elective', // AP Seminar
  'EL-0100-S2': 'Elective', // AP Seminar
  'EL-0101-S1': 'Elective', // AP Research
  'EL-0101-S2': 'Elective', // AP Research
  'EL-0102-S1': 'Elective', // Business Computer Technology
  'EL-0102-S2': 'Elective', // Business Computer Technology
  'EL-0103-S1': 'Elective', // IB Theory of Knowledge
  'EL-0103-S2': 'Elective', // IB Theory of Knowledge
  'EL-0104-S1': 'Elective', // Academic Achievement
  'EL-0104-S2': 'Elective', // Academic Achievement
  'EL-0105-S1': 'Elective', // Academic Commitment to Education (ACE)
  'EL-0105-S2': 'Elective', // Academic Commitment to Education (ACE)
  'EL-0106-S1': 'Elective', // Academic Team
  'EL-0106-S2': 'Elective', // Academic Team
  'EL-0107-S1': 'Elective', // Character Education
  'EL-0107-S2': 'Elective', // Character Education
  'EL-0108-S1': 'Elective', // Communication Skills
  'EL-0108-S2': 'Elective', // Communication Skills
  'EL-0109-S1': 'Elective', // Critical Thinking Skills
  'EL-0109-S2': 'Elective', // Critical Thinking Skills
  'EL-0110-S1': 'Elective', // Driver Education
  'EL-0110-S2': 'Elective', // Driver Education
  'EL-0111-S1': 'Elective', // Internship 1
  'EL-0111-S2': 'Elective', // Internship 1
  'EL-0112-S1': 'Elective', // Internship 2
  'EL-0112-S2': 'Elective', // Internship 2
  'EL-0113-S1': 'Elective', // JROTC
  'EL-0113-S2': 'Elective', // JROTC
  'EL-0114-S1': 'Elective', // JROTC 2
  'EL-0114-S2': 'Elective', // JROTC 2
  'EL-0115-S1': 'Elective', // AFJROTC
  'EL-0115-S2': 'Elective', // AFJROTC
  'EL-0116-S1': 'Elective', // Leadership
  'EL-0116-S2': 'Elective', // Leadership
  'EL-0117-S1': 'Elective', // Life Skills
  'EL-0117-S2': 'Elective', // Life Skills
  'EL-0118-S1': 'Elective', // Safety Education
  'EL-0118-S2': 'Elective', // Safety Education
  'EL-0119-S1': 'Elective', // Service Learning
  'EL-0119-S2': 'Elective', // Service Learning
  'EL-0120-S1': 'Elective', // General Religious Studies
  'EL-0120-S2': 'Elective', // General Religious Studies
  'EL-0121-S1': 'Elective', // Religion & Theology
  'EL-0121-S2': 'Elective', // Religion & Theology
  'EL-0122-S1': 'Elective', // Law Enforcement
  'EL-0122-S2': 'Elective', // Law Enforcement
  'EL-0123-S1': 'Elective', // ACT Prep
  'EL-0123-S2': 'Elective', // ACT Prep
  'EL-0124-S1': 'Elective', // SAT Prep
  'EL-0124-S2': 'Elective', // SAT Prep
  'EL-0125-S1': 'Elective', // PSAT Prep
  'EL-0125-S2': 'Elective', // PSAT Prep
  'EL-0126-S1': 'Elective', // NMQT Prep
  'EL-0126-S2': 'Elective', // NMQT Prep
  'EL-0127-S1': 'Elective', // Aviation Technology 1
  'EL-0127-S2': 'Elective', // Aviation Technology 1
  'EL-0128-S1': 'Elective', // Aviation Technology 2
  'EL-0128-S2': 'Elective', // Aviation Technology 2
  'EL-0129-S1': 'Elective', // Aviation Technology 3
  'EL-0129-S2': 'Elective', // Aviation Technology 3
  'EL-0130-S1': 'Elective', // Aviation Technology 4
  'EL-0130-S2': 'Elective', // Aviation Technology 4
  'EL-0131-S1': 'Elective', // FACS
  'EL-0131-S2': 'Elective', // FACS
  'EL-0132-S1': 'Elective', // Trade Completion**
  'EL-0132-S2': 'Elective', // Trade Completion**
  'EL-0133-S1': 'Elective', // Career Planning and Development A
  'EL-0133-S2': 'Elective', // Career Planning and Development A
  'EL-0134-S1': 'Elective', // Career Planning and Development B
  'EL-0134-S2': 'Elective', // Career Planning and Development B
  'EL-0135-S1': 'Elective', // Intro to STEM
  'EL-0135-S2': 'Elective', // Intro to STEM
  'EL-0136-S1': 'Elective', // African American Studies
  'EL-0136-S2': 'Elective', // African American Studies
  'EL-0137-S1': 'Elective', // Child Development
  'EL-0137-S2': 'Elective', // Child Development
  'EL-0138-S1': 'Elective', // Animal Science
  'EL-0138-S2': 'Elective', // Animal Science
  'EL-0139-S1': 'Elective', // Touch System Data Entry
  'EL-0139-S2': 'Elective', // Touch System Data Entry
  'EL-0140-S1': 'Elective', // Career Preperations
  'EL-0140-S2': 'Elective', // Career Preperations
  'EL-0141-S1': 'Elective', // Pathway Elective 1**
  'EL-0141-S2': 'Elective', // Pathway Elective 1**
  'EL-0142-S1': 'Elective', // Pathway Elective 2**
  'EL-0142-S2': 'Elective', // Pathway Elective 2**
  'EL-0143-S1': 'Elective', // Pathway Elective 3**
  'EL-0143-S2': 'Elective', // Pathway Elective 3**
  'EL-0144-S1': 'Elective', // Pathway Elective 4**
  'EL-0144-S2': 'Elective', // Pathway Elective 4**
  'EL-0145-S1': 'Elective', // Pathway Elective 5**
  'EL-0145-S2': 'Elective', // Pathway Elective 5**
  'EL-0146-S1': 'Elective', // American Sign Language
  'EL-0146-S2': 'Elective', // American Sign Language
  'EL-0147-S1': 'Elective', // Introduction to Power Technology
  'EL-0147-S2': 'Elective', // Introduction to Power Technology
  'EL-0149-S1': 'Elective', // Digital Infromation Technology
  'EL-0149-S2': 'Elective', // Digital Infromation Technology
  'EL-0150-S1': 'Elective', // Prep for College & Careers
  'EL-0150-S2': 'Elective', // Prep for College & Careers
  'EL-0151-S1': 'Elective', // Human Growth and Development
  'EL-0151-S2': 'Elective', // Human Growth and Development
  'EL-0153-S1': 'Elective', // Principles of Law
  'EL-0153-S2': 'Elective', // Principles of Law
  'EL-0154-S1': 'Elective', // Advisory
  'EL-0154-S2': 'Elective', // Advisory
  'EL-0155-S1': 'Elective', // ICAP 1
  'EL-0155-S2': 'Elective', // ICAP 1
  'EL-0156-S1': 'Elective', // ICAP 2
  'EL-0156-S2': 'Elective', // ICAP 2
  'EL-0157-S1': 'Elective', // Forensic Science
  'EL-0157-S2': 'Elective', // Forensic Science
  'EL-0158-S1': 'Elective', // Chemistry of Food and Medicine
  'EL-0158-S2': 'Elective', // Chemistry of Food and Medicine
  'EL-0159-S1': 'Elective', // English Enrichment
  'EL-0159-S2': 'Elective', // English Enrichment
  'EL-0160-S1': 'Elective', // Academic Success
  'EL-0160-S2': 'Elective', // Academic Success
  'EL-0161-S1': 'Elective', // Culinary Basics
  'EL-0161-S2': 'Elective', // Culinary Basics
  'EL-0162-S1': 'Elective', // Orientation to College
  'EL-0162-S2': 'Elective', // Orientation to College
  'EL-0163-S1': 'Elective', // Earlth World History
  'EL-0163-S2': 'Elective', // Earlth World History
  'EL-0164-S1': 'Elective', // Math Enrichment
  'EL-0164-S2': 'Elective', // Math Enrichment
  'EL-0165-S1': 'Elective', // Competitive Athletics 2
  'EL-0165-S2': 'Elective', // Competitive Athletics 2
  'EL-0166-S1': 'Elective', // Weights 2
  'EL-0166-S2': 'Elective', // Weights 2
  'EL-0167-S1': 'Elective', // PE 2
  'EL-0167-S2': 'Elective', // PE 2
  'EL-0168-S1': 'Elective', // Nursing Assistant
  'EL-0168-S2': 'Elective', // Nursing Assistant
  'EL-0169-S1': 'Elective', // E-Sports
  'EL-0169-S2': 'Elective', // E-Sports
  'EL-0170-S1': 'Elective', // Public Speaking
  'EL-0170-S2': 'Elective', // Public Speaking
  'EL-0171-S1': 'Elective', // General English
  'EL-0171-S2': 'Elective', // General English

};
