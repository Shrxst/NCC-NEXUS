exports.up = async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable("quiz_topics", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.string("name", 255).notNullable().unique();
    t.text("description");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("quiz_questions", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t
      .uuid("topic_id")
      .notNullable()
      .references("id")
      .inTable("quiz_topics")
      .onDelete("RESTRICT");
    t.enu("difficulty", ["easy", "medium", "hard"], {
      useNative: true,
      enumName: "quiz_question_difficulty_enum",
    }).notNullable();
    t.text("question_text").notNullable();
    t.text("option_a").notNullable();
    t.text("option_b").notNullable();
    t.text("option_c").notNullable();
    t.text("option_d").notNullable();
    t.enu("correct_option", ["A", "B", "C", "D"], {
      useNative: true,
      enumName: "quiz_correct_option_enum",
    }).notNullable();
    t.text("explanation").notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.boolean("is_active").notNullable().defaultTo(true);

    t.index(["topic_id"], "idx_quiz_questions_topic_id");
    t.index(["difficulty"], "idx_quiz_questions_difficulty");
    t.index(["difficulty", "is_active"], "idx_quiz_questions_difficulty_active");
  });

  await knex.schema.createTable("quiz_mock_tests", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.string("title", 255).notNullable();
    t.text("description");
    t.integer("total_questions").notNullable();
    t.decimal("total_marks", 8, 2).notNullable();
    t.decimal("negative_mark", 8, 2).notNullable();
    t.integer("duration_minutes").notNullable();
    t.boolean("is_active").notNullable().defaultTo(true);
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("quiz_mock_test_questions", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t
      .uuid("mock_test_id")
      .notNullable()
      .references("id")
      .inTable("quiz_mock_tests")
      .onDelete("CASCADE");
    t
      .uuid("question_id")
      .notNullable()
      .references("id")
      .inTable("quiz_questions")
      .onDelete("RESTRICT");
    t.integer("question_order").notNullable();

    t.unique(["mock_test_id", "question_order"], "uq_quiz_mock_test_questions_order");
    t.unique(["mock_test_id", "question_id"], "uq_quiz_mock_test_questions_question");
    t.index(["mock_test_id", "question_order"], "idx_quiz_mock_test_questions_order");
  });

  await knex.schema.createTable("quiz_attempts", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t
      .integer("user_id")
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");
    t.enu("quiz_type", ["practice", "mock"], {
      useNative: true,
      enumName: "quiz_attempt_type_enum",
    }).notNullable();
    t
      .uuid("mock_test_id")
      .references("id")
      .inTable("quiz_mock_tests")
      .onDelete("SET NULL");
    t.string("level_selected", 32);
    t.timestamp("started_at").notNullable();
    t.timestamp("submitted_at");
    t.integer("duration_seconds").notNullable();
    t.integer("total_questions").notNullable();
    t.integer("correct_count");
    t.integer("incorrect_count");
    t.integer("unattempted_count");
    t.decimal("negative_marks", 8, 2);
    t.decimal("final_score", 8, 2);
    t.decimal("accuracy_percent", 8, 2);
    t.enu("status", ["in_progress", "submitted", "auto_submitted", "failed_due_to_violation"], {
      useNative: true,
      enumName: "quiz_attempt_status_enum",
    }).notNullable().defaultTo("in_progress");
    t.text("violation_reason");
    t.integer("proctor_flags").notNullable().defaultTo(0);
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.index(["user_id", "created_at"], "idx_quiz_attempts_user_created_desc");
    t.index(["quiz_type"], "idx_quiz_attempts_quiz_type");
  });

  await knex.schema.createTable("quiz_attempt_answers", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t
      .uuid("attempt_id")
      .notNullable()
      .references("id")
      .inTable("quiz_attempts")
      .onDelete("CASCADE");
    t
      .uuid("question_id")
      .notNullable()
      .references("id")
      .inTable("quiz_questions")
      .onDelete("RESTRICT");
    t.enu("selected_option", ["A", "B", "C", "D"], {
      useNative: true,
      enumName: "quiz_selected_option_enum",
    });
    t.boolean("is_correct");
    t.decimal("marks_awarded", 8, 2).notNullable().defaultTo(0);
    t.integer("time_taken_seconds");

    t.unique(["attempt_id", "question_id"], "uq_quiz_attempt_answers_attempt_question");
    t.index(["attempt_id"], "idx_quiz_attempt_answers_attempt");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("quiz_attempt_answers");
  await knex.schema.dropTableIfExists("quiz_attempts");
  await knex.schema.dropTableIfExists("quiz_mock_test_questions");
  await knex.schema.dropTableIfExists("quiz_mock_tests");
  await knex.schema.dropTableIfExists("quiz_questions");
  await knex.schema.dropTableIfExists("quiz_topics");

  await knex.raw("DROP TYPE IF EXISTS quiz_selected_option_enum");
  await knex.raw("DROP TYPE IF EXISTS quiz_attempt_status_enum");
  await knex.raw("DROP TYPE IF EXISTS quiz_attempt_type_enum");
  await knex.raw("DROP TYPE IF EXISTS quiz_correct_option_enum");
  await knex.raw("DROP TYPE IF EXISTS quiz_question_difficulty_enum");
};
