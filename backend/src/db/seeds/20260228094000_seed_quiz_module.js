const topicSeed = [
  { name: "NCC History", description: "Foundational history and milestones of NCC." },
  { name: "Organization", description: "NCC structure, wings, and command hierarchy." },
  { name: "Drill", description: "Drill commands and parade fundamentals." },
  { name: "Map Reading", description: "Navigation, bearings, and map interpretation." },
  { name: "Field Craft", description: "Field movement, concealment, and tactical basics." },
  { name: "Weapon Training", description: "Weapon safety and handling principles." },
  { name: "First Aid", description: "Immediate casualty care and emergency response." },
  { name: "Leadership", description: "Leadership communication and responsibility." },
  { name: "Social Service", description: "Civic action and community programs in NCC." },
  { name: "Camp & Exams", description: "NCC camps, certifications, and exam readiness." },
];

const questionTemplates = [
  {
    topic: "NCC History",
    difficulty: "easy",
    question_text: "NCC was formally raised in which year?",
    option_a: "1946",
    option_b: "1948",
    option_c: "1950",
    option_d: "1952",
    correct_option: "B",
    explanation: "NCC was established under the NCC Act in 1948.",
  },
  {
    topic: "Organization",
    difficulty: "easy",
    question_text: "Which wing is represented by navy blue in NCC identity?",
    option_a: "Army Wing",
    option_b: "Air Wing",
    option_c: "Naval Wing",
    option_d: "Medical Wing",
    correct_option: "C",
    explanation: "Navy blue is associated with the Naval Wing.",
  },
  {
    topic: "Drill",
    difficulty: "easy",
    question_text: "The command used to bring a squad to attention is:",
    option_a: "Vishram",
    option_b: "Savdhan",
    option_c: "Dahine Mur",
    option_d: "Tez Chal",
    correct_option: "B",
    explanation: "Savdhan is the standard command for attention.",
  },
  {
    topic: "Map Reading",
    difficulty: "medium",
    question_text: "Contour lines on a map join points of:",
    option_a: "Equal temperature",
    option_b: "Equal distance",
    option_c: "Equal elevation",
    option_d: "Equal magnetic field",
    correct_option: "C",
    explanation: "Contours indicate points at the same elevation above mean sea level.",
  },
  {
    topic: "Field Craft",
    difficulty: "medium",
    question_text: "The best description of camouflage is:",
    option_a: "Fast movement across open terrain",
    option_b: "Blending with surroundings to reduce detection",
    option_c: "Using bright patches to confuse observer",
    option_d: "Only moving at night",
    correct_option: "B",
    explanation: "Camouflage is concealment by matching the environment.",
  },
  {
    topic: "Weapon Training",
    difficulty: "easy",
    question_text: "Before handling any weapon, the first rule is to:",
    option_a: "Assume it is unloaded",
    option_b: "Point towards any wall",
    option_c: "Treat every weapon as loaded",
    option_d: "Keep finger on trigger",
    correct_option: "C",
    explanation: "Universal weapon safety begins by treating every weapon as loaded.",
  },
  {
    topic: "First Aid",
    difficulty: "easy",
    question_text: "For severe external bleeding, immediate first aid is:",
    option_a: "Apply direct pressure",
    option_b: "Give water quickly",
    option_c: "Wash deeply before pressure",
    option_d: "Wait for doctor without action",
    correct_option: "A",
    explanation: "Direct pressure is the first lifesaving intervention for bleeding.",
  },
  {
    topic: "Leadership",
    difficulty: "medium",
    question_text: "A core leadership behavior in NCC is:",
    option_a: "Avoiding accountability",
    option_b: "Clear delegation with responsibility",
    option_c: "Publicly blaming team",
    option_d: "Skipping after-action feedback",
    correct_option: "B",
    explanation: "Effective leaders delegate clearly and hold accountability.",
  },
  {
    topic: "Social Service",
    difficulty: "easy",
    question_text: "Social service activities in NCC primarily build:",
    option_a: "Weapon specialization only",
    option_b: "Civic responsibility",
    option_c: "Exam shortcuts",
    option_d: "Uniform privileges",
    correct_option: "B",
    explanation: "Community engagement develops civic awareness and discipline.",
  },
  {
    topic: "Camp & Exams",
    difficulty: "medium",
    question_text: "In SD/SW, the highest commonly recognized NCC certificate is:",
    option_a: "A Certificate",
    option_b: "B Certificate",
    option_c: "C Certificate",
    option_d: "D Certificate",
    correct_option: "C",
    explanation: "C Certificate is the highest standard NCC certificate in SD/SW.",
  },
  {
    topic: "NCC History",
    difficulty: "medium",
    question_text: "The NCC motto is:",
    option_a: "Service Before Self",
    option_b: "Unity and Discipline",
    option_c: "Duty and Honor",
    option_d: "Nation First Always",
    correct_option: "B",
    explanation: "The official NCC motto is Unity and Discipline.",
  },
  {
    topic: "Organization",
    difficulty: "hard",
    question_text: "A typical formation growth sequence is:",
    option_a: "Company -> Platoon -> Squad",
    option_b: "Squad -> Platoon -> Company",
    option_c: "Platoon -> Company -> Squad",
    option_d: "Section -> Company -> Troop",
    correct_option: "B",
    explanation: "From smaller to larger grouping: squad, platoon, company.",
  },
  {
    topic: "Drill",
    difficulty: "medium",
    question_text: "The command 'Dahine Mur' means:",
    option_a: "Turn left",
    option_b: "Turn right",
    option_c: "About turn",
    option_d: "Stand easy",
    correct_option: "B",
    explanation: "Dahine Mur is the drill command for right turn.",
  },
  {
    topic: "Map Reading",
    difficulty: "hard",
    question_text: "A direction measured clockwise from north is called:",
    option_a: "Grid line",
    option_b: "Declination",
    option_c: "Azimuth",
    option_d: "Reference block",
    correct_option: "C",
    explanation: "Azimuth is an angular direction measured clockwise from north.",
  },
  {
    topic: "Field Craft",
    difficulty: "hard",
    question_text: "In hand signals, a raised vertical arm generally indicates:",
    option_a: "Advance",
    option_b: "Halt",
    option_c: "Enemy sighted",
    option_d: "Regroup left",
    correct_option: "B",
    explanation: "Raised vertical arm is commonly used to signal halt.",
  },
  {
    topic: "Weapon Training",
    difficulty: "medium",
    question_text: "Trigger discipline means:",
    option_a: "Finger on trigger while moving",
    option_b: "Finger off trigger until ready to fire",
    option_c: "Safety catch always off",
    option_d: "Trigger checked after firing only",
    correct_option: "B",
    explanation: "Finger must stay outside trigger guard until intentional firing.",
  },
  {
    topic: "First Aid",
    difficulty: "medium",
    question_text: "For heat stroke, first action is to:",
    option_a: "Make casualty run",
    option_b: "Cool rapidly and seek medical help",
    option_c: "Give heavy meal",
    option_d: "Keep in direct sun",
    correct_option: "B",
    explanation: "Heat stroke is an emergency requiring immediate cooling and support.",
  },
  {
    topic: "Leadership",
    difficulty: "hard",
    question_text: "High quality leadership feedback should be:",
    option_a: "Delayed and general",
    option_b: "Specific and timely",
    option_c: "Public and harsh",
    option_d: "Avoided to preserve morale",
    correct_option: "B",
    explanation: "Specific and timely feedback improves performance.",
  },
  {
    topic: "Social Service",
    difficulty: "medium",
    question_text: "An NCC civic action campaign is intended to improve:",
    option_a: "Only parade scores",
    option_b: "Community resilience",
    option_c: "Only theoretical marks",
    option_d: "Sports rankings only",
    correct_option: "B",
    explanation: "Civic action contributes to community capacity and public welfare.",
  },
  {
    topic: "Camp & Exams",
    difficulty: "hard",
    question_text: "CATC in NCC is primarily focused on:",
    option_a: "Only ceremonial events",
    option_b: "Combined annual structured training",
    option_c: "Only weapon firing",
    option_d: "Only social media campaigns",
    correct_option: "B",
    explanation: "CATC provides integrated annual training exposure.",
  },
  {
    topic: "NCC History",
    difficulty: "hard",
    question_text: "The legal framework for NCC was established by:",
    option_a: "An executive order only",
    option_b: "NCC Act passed by Parliament",
    option_c: "State-level notification",
    option_d: "Judicial ruling",
    correct_option: "B",
    explanation: "NCC was constituted under the NCC Act.",
  },
  {
    topic: "Organization",
    difficulty: "medium",
    question_text: "Joint training between wings primarily improves:",
    option_a: "Inter-service coordination",
    option_b: "Uniform cost reduction",
    option_c: "Only exam pass percentage",
    option_d: "Single-unit isolation",
    correct_option: "A",
    explanation: "Cross-wing participation improves coordination and adaptability.",
  },
  {
    topic: "Drill",
    difficulty: "hard",
    question_text: "Standardized drill practice improves:",
    option_a: "Indiscipline tolerance",
    option_b: "Turnout, bearing, and unit coordination",
    option_c: "Only physical stamina",
    option_d: "None of the above",
    correct_option: "B",
    explanation: "Drill develops synchronization, bearing, and command response.",
  },
  {
    topic: "Map Reading",
    difficulty: "easy",
    question_text: "Map legend is used to:",
    option_a: "Decorate map border",
    option_b: "Explain symbols",
    option_c: "Mark attendance",
    option_d: "Measure pulse rate",
    correct_option: "B",
    explanation: "Legend explains symbols and notations on map sheets.",
  },
  {
    topic: "Camp & Exams",
    difficulty: "easy",
    question_text: "A good timed-MCQ strategy is to:",
    option_a: "Attempt easiest questions first",
    option_b: "Spend equal time on all difficult questions",
    option_c: "Skip reading options",
    option_d: "Randomly choose all answers",
    correct_option: "A",
    explanation: "Prioritizing easier questions maximizes score within time limit.",
  },
];

const variantLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];

exports.seed = async function seed(knex) {
  await knex("quiz_attempt_answers").del();
  await knex("quiz_attempts").del();
  await knex("quiz_mock_test_questions").del();
  await knex("quiz_mock_tests").del();
  await knex("quiz_questions").del();
  await knex("quiz_topics").del();

  const topicsInserted = await knex("quiz_topics")
    .insert(topicSeed)
    .returning(["id", "name"]);

  const topicIdByName = topicsInserted.reduce((acc, row) => {
    acc[row.name] = row.id;
    return acc;
  }, {});

  const questionRows = [];
  for (let index = 0; index < 200; index += 1) {
    const template = questionTemplates[index % questionTemplates.length];
    const variant = variantLabels[Math.floor(index / questionTemplates.length)];

    questionRows.push({
      topic_id: topicIdByName[template.topic],
      difficulty: template.difficulty,
      question_text: `${template.question_text} [Set ${variant}]`,
      option_a: template.option_a,
      option_b: template.option_b,
      option_c: template.option_c,
      option_d: template.option_d,
      correct_option: template.correct_option,
      explanation: `${template.explanation} (Set ${variant})`,
      is_active: true,
    });
  }

  const insertedQuestions = await knex("quiz_questions")
    .insert(questionRows)
    .returning(["id"]);

  const [mockTest] = await knex("quiz_mock_tests")
    .insert({
      title: "NCC Mock Test 1",
      description: "Predefined 50-question mock test for timed practice.",
      total_questions: 50,
      total_marks: 50,
      negative_mark: 0.25,
      duration_minutes: 30,
      is_active: true,
    })
    .returning(["id"]);

  const mockMappings = insertedQuestions.slice(0, 50).map((row, index) => ({
    mock_test_id: mockTest.id,
    question_id: row.id,
    question_order: index + 1,
  }));

  await knex("quiz_mock_test_questions").insert(mockMappings);
};
