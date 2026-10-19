import {
  type AnyPgColumn,
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// user_id references Supabase auth.users(id); RLS policies (user_id = auth.uid())
// are applied in SQL migrations, not declared here.
const userId = () => uuid("user_id").notNull();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(),
    usesReps: boolean("uses_reps").notNull().default(true),
    usesWeight: boolean("uses_weight").notNull().default(true),
    usesDuration: boolean("uses_duration").notNull().default(false),
    muscleGroups: text("muscle_groups").array().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("exercises_user_name_idx").on(t.userId, t.name)],
);

export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    parentId: uuid("parent_id").references((): AnyPgColumn => folders.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("folders_user_idx").on(t.userId), index("folders_parent_idx").on(t.parentId)],
);

export const lists = pgTable(
  "lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    color: text("color"),
    notes: text("notes"),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("lists_user_idx").on(t.userId), index("lists_folder_idx").on(t.folderId)],
);

export const listExercises = pgTable(
  "list_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id").notNull().references(() => lists.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    targetSets: integer("target_sets"),
    targetReps: integer("target_reps"),
    targetWeight: numeric("target_weight"),
    note: text("note"),
    intersetRestS: integer("interset_rest_s"),
  },
  (t) => [
    uniqueIndex("list_exercises_list_exercise_idx").on(t.listId, t.exerciseId),
    index("list_exercises_exercise_idx").on(t.exerciseId),
  ],
);

// Naive local timestamps: Setgraph CSVs carry no timezone, so values are stored as written.
const localTs = (name: string) => timestamp(name, { mode: "string" });

// A session is one workout (Setgraph/Apple Health). Strength sessions get sets attached by time overlap.
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    activityType: text("activity_type").notNull(),
    startedAt: localTs("started_at").notNull(),
    endedAt: localTs("ended_at"),
    durationS: integer("duration_s"),
    calories: numeric("calories"),
    distanceM: numeric("distance_m"),
    source: text("source"), // Setgraph | Fitness | Peloton | ...
    location: text("location"),
    notes: text("notes"),
    metadata: jsonb("metadata"), // parsed "Custom Metadata" key=value pairs
    listId: uuid("list_id").references(() => lists.id, { onDelete: "set null" }),
    sourceKey: text("source_key").notNull(), // activity|start
    sourceHash: text("source_hash").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("sessions_user_source_key_idx").on(t.userId, t.sourceKey),
    index("sessions_user_started_idx").on(t.userId, t.startedAt),
    index("sessions_list_idx").on(t.listId),
  ],
);

export const multisets = pgTable(
  "multisets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // superset | dropset | checkmark | custom
  },
  (t) => [index("multisets_session_idx").on(t.sessionId)],
);

export const sets = pgTable(
  "sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    exerciseId: uuid("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
    // Set CSV has no session column; linked by timestamp falling inside a session window (null if none).
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    performedAt: localTs("performed_at").notNull(),
    reps: numeric("reps"), // fractional reps exist (0.5)
    weightLb: numeric("weight_lb"), // canonical; kg derived for display. 0 = bodyweight
    durationS: integer("duration_s"),
    note: text("note"),
    label: text("label"),
    multisetId: uuid("multiset_id").references(() => multisets.id, { onDelete: "set null" }),
    sourceKey: text("source_key").notNull(), // exercise|performed_at (unique in the sample export)
    sourceHash: text("source_hash").notNull(), // hash of reps/weight/duration/note/label
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("sets_user_source_key_idx").on(t.userId, t.sourceKey),
    index("sets_exercise_time_idx").on(t.exerciseId, t.performedAt),
    index("sets_session_idx").on(t.sessionId),
    index("sets_multiset_idx").on(t.multisetId),
  ],
);

export const imports = pgTable(
  "imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    fileHash: text("file_hash").notNull(),
    stats: jsonb("stats"),
    createdAt: createdAt(),
  },
  (t) => [index("imports_user_idx").on(t.userId)],
);

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("api_tokens_user_idx").on(t.userId)],
);
