export const MUSCLES = [
  "Chest",
  "Shoulders",
  "Triceps",
  "Biceps",
  "Forearms",
  "Back",
  "Traps",
  "Lower Back",
  "Abs",
  "Obliques",
  "Glutes",
  "Quads",
  "Hamstrings",
  "Calves",
  "Hips",
  "Neck",
] as const;
export type Muscle = (typeof MUSCLES)[number];

type Rule = [RegExp, Muscle[]]; // first muscle = primary

// Ordered: the first matching rule wins, so specific names come before generic ones.
// Seed only; users can override per exercise in the app.
const RULES: Rule[] = [
  [/neck/i, ["Neck"]],
  [/wrist curl|crush curl|farmer|dead hang|monkey bars/i, ["Forearms"]],
  [/reverse (barbell|grip) curl|reverse grip curl/i, ["Forearms", "Biceps"]],
  [/skull crusher|tricep|triceps|dips|diamond push|close grip/i, ["Triceps"]],
  [/rear delt|face pull|incline y raise/i, ["Shoulders", "Back"]],
  [/shrug/i, ["Traps"]],
  [/lateral (shoulder )?raise|front (shoulder )?raise|shoulder press|pike push|y raise/i, ["Shoulders"]],
  [/leg curl/i, ["Hamstrings"]],
  [/curl/i, ["Biceps"]],
  [/archer push|decline push|explosive push|wide push|push-?ups?/i, ["Chest", "Triceps"]],
  [/bench press|chest|pec|dumbbell (fly|press)|incline dumbbell press|cable (chest )?fly/i, ["Chest"]],
  [/pull-?\s?up|chin up|pulldown|row|archer pull|pullover|lat /i, ["Back"]],
  [/back extension|superman|romanian|deadlift/i, ["Lower Back", "Hamstrings", "Glutes"]],
  [/side (raise|plank)|russian twist|side swing/i, ["Obliques"]],
  [/abduction|adduction/i, ["Hips"]],
  [/leg curl/i, ["Hamstrings"]],
  [/calf/i, ["Calves"]],
  [/squat|leg press|leg extension|lunge/i, ["Quads", "Glutes"]],
  [/crunch|sit up|situp|knee (raise|tuck)|leg raise|leg lift|plank|flutter|heel tap|v-tap|hollow|dragon flag|l sit|frog stand|cindy/i, ["Abs"]],
];

/** Muscles worked by an exercise name, primary first; [] if no rule matches. */
export function musclesFor(exerciseName: string): Muscle[] {
  const name = exerciseName.replace(/�/g, "'");
  for (const [re, muscles] of RULES) if (re.test(name)) return muscles;
  return [];
}
